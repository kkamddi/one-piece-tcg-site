import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { verifyMember, openMemberLogin, readMemberAccessToken, requireMember } from '../extensions/card-pone/member.js';
import { fetchPrices } from '../extensions/card-pone/prices.js';

const compiled = await build({ entryPoints: ['api/extension-member.js'], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'mock-auth', setup(b) {
    b.onResolve({ filter: /supabase-admin\.js$/ }, () => ({ path: 'auth', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabaseAdmin = globalThis.admin;' }));
  } }]
});
async function apiResult({ user, error, token = 'synthetic-token', method = 'GET', configured = true, throws = false } = {}) {
  let calls = 0;
  const context = { module: { exports: {} }, admin: configured ? { auth: { getUser: async () => {
    calls++; if (throws) throw Error('private backend details'); return { data: { user }, error };
  } } } : null };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(x) { this.body = x; return this; } };
  await context.module.exports.default({ method, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  assert.equal(res.headers['Cache-Control'], 'no-store, private');
  return { ...res, calls };
}
test('server requires verified non-anonymous membership, never trusting client metadata', async () => {
  for (const user of [null, {}, { id: 'guest', is_anonymous: true }]) assert.equal((await apiResult({ user })).code, 401);
  for (const error of [{ status: 401 }, { code: 'session_expired' }, { code: 'user_not_found' }]) assert.equal((await apiResult({ error })).code, 401);
  const missing = await apiResult({ token: '' }); assert.equal(missing.code, 401); assert.equal(missing.calls, 0);
  const ok = await apiResult({ user: { id: 'member', email: 'not-returned@example.test', user_metadata: { admin: false } } });
  assert.equal(ok.code, 200); assert.equal(JSON.stringify(ok.body), '{"member":true,"memberId":"member"}');
});
test('backend failure and unsupported methods fail closed without leaking details', async () => {
  for (const options of [{ configured: false }, { throws: true }, { error: { status: 503 } }, { error: { status: 429 } }]) {
    const res = await apiResult(options); assert.equal(res.code, 503); assert.equal(res.body.error, 'auth_unavailable');
  }
  assert.equal((await apiResult({ method: 'POST' })).code, 405);
});
function browser({ token = 'synthetic-token', url = 'https://www.optcgkorea.com/portfolio', tab = 10 } = {}) {
  return {
    storage: { session: { get: async () => ({ cardPoneMemberTab: tab }), set: async () => {} } },
    tabs: { get: async id => { assert.equal(id, 10); return { url }; }, create: async ({ url }) => { assert.equal(url, 'https://www.optcgkorea.com/portfolio'); return { id: 10 }; } },
    scripting: { executeScript: async args => { assert.equal(args.world, 'ISOLATED'); assert.deepEqual(args.target, { tabId: 10, frameIds: [0] }); return [{ frameId: 0, result: token }]; } }
  };
}
test('only extension-created site tab is used and only authentication endpoint receives token', async () => {
  const api = browser(); let stored;
  api.storage.session.set = async x => { stored = x; };
  await openMemberLogin(api); assert.deepEqual(stored, { cardPoneMemberTab: 10 });
  const result = await verifyMember(api, async (url, options) => {
    assert.equal(url, 'https://www.optcgkorea.com/api/extension-member');
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    return Response.json({ member: true, memberId: 'member' });
  });
  assert.deepEqual(result, { member: true, memberId: 'member' });
});
test('absent login, wrong origin and missing session cannot make authenticated requests', async () => {
  for (const args of [{ tab: undefined }, { tab: null }, { url: 'https://www.optcgkorea.com.evil.test/' }, { token: null }]) {
    if (args.tab === undefined) args.tab = null;
    await assert.rejects(verifyMember(browser(args), async () => { assert.fail('must not fetch'); }));
  }
});
test('HTTP failures, HTML fallback and logout during verification are denied', async () => {
  for (const request of [async () => new Response('', { status: 401 }), async () => new Response('', { status: 503 }), async () => new Response('<html>'), async () => Response.json({ member: false }), async () => { throw Error('offline'); }]) await assert.rejects(verifyMember(browser(), request));
  const api = browser(); let calls = 0;
  api.scripting.executeScript = async () => [{ frameId: 0, result: ++calls === 1 ? 'synthetic-token' : null }];
  await assert.rejects(verifyMember(api, async () => Response.json({ member: true, memberId: 'member' })));
});
test('site session reader ignores expired and malformed data, never returns refresh token', () => {
  const read = session => vm.runInNewContext(`(${readMemberAccessToken.toString()})()`, {
    location: { origin: 'https://www.optcgkorea.com' }, localStorage: { getItem: () => session }, Date
  });
  assert.equal(read('{'), null); assert.equal(read(JSON.stringify({ access_token: 'test', expires_at: 1 })), null);
  assert.equal(read(JSON.stringify({ access_token: 'test', expires_at: Date.now() / 1000 + 100, refresh_token: 'never-return' })), 'test');
});
test('price fetch is blocked without membership and discards account-switch responses', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.chrome = { runtime: { id: 'test', sendMessage: async () => ({ member: false }) } };
    globalThis.fetch = async () => { assert.fail('no price request without member'); };
    await assert.rejects(fetchPrices(1, new AbortController().signal));
    let checks = 0;
    chrome.runtime.sendMessage = async () => ({ member: true, memberId: ++checks === 1 ? 'a' : 'b' });
    globalThis.fetch = async () => Response.json({ basis: 'snkrdunk_latest_trade_day_median', items: [] });
    await assert.rejects(fetchPrices(1, new AbortController().signal), /member_changed/);
  } finally { globalThis.fetch = original; delete globalThis.chrome; }
  await assert.rejects(requireMember());
});
test('background and panel enforce membership before capture and recognition', async () => {
  const bg = await readFile('extensions/card-pone/background.js', 'utf8');
  const panel = await readFile('extensions/card-pone/panel.jsx', 'utf8');
  assert.ok(bg.indexOf('try { await verifyMember(chrome); }') < bg.indexOf('const capture = await captureCard'));
  assert.ok(panel.indexOf('const identity = await requireMember()') < panel.indexOf('const found = await recognizeForLab'));
  assert.match(panel, /disabled=\{busy \|\| !member\}/);
});

test('real message listener rejects non-panel senders and never captures for a nonmember', async () => {
  let listener; let captured = 0;
  const api = browser({ token: null });
  api.runtime = { id: 'test-member', getURL: file => `chrome-extension://test-member/${file}`, onMessage: { addListener: fn => { listener = fn; } } };
  api.action = { onClicked: { addListener() {} } };
  api.sidePanel = { setPanelBehavior: async () => {}, open: async () => {} };
  api.tabs.query = async () => [{ id: 1, windowId: 3, url: 'https://example.test/card' }];
  api.tabs.captureVisibleTab = async () => { captured++; };
  globalThis.chrome = api;
  try {
    await import('../extensions/card-pone/background.js?member-test');
    assert.equal(listener({ type: 'card-pone-member-check' }, { id: 'foreign', url: 'https://example.test' }, () => assert.fail('wrong sender')), undefined);
    const res = await new Promise(resolve => listener({ type: 'card-pone-scan', windowId: 3 }, { id: api.runtime.id, url: api.runtime.getURL('panel.html') }, resolve));
    assert.equal(res.code, 'MEMBER_REQUIRED'); assert.equal(captured, 0);
  } finally { delete globalThis.chrome; }
});

test('member route is explicitly registered and excluded from shared cache', async () => {
  const source = await readFile('functions/api/[[path]].js', 'utf8');
  const route = source.slice(source.indexOf('function routeApi('), source.indexOf('async function loadHandler('));
  const result = vm.runInNewContext(`${route}; ({ route: routeApi(['extension-member']), ttl: getPublicCacheTtl({method:'GET',headers:new Headers()}, {key:'extensionMember'}, new URL('https://example.test/api/extension-member')) })`, { Headers, URL });
  assert.equal(result.route.key, 'extensionMember'); assert.equal(result.ttl, 0);
  assert.ok(source.includes("import('../../api/extension-member.js')"));
});
