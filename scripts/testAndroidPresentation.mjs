import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const modal = ast.program.body.find(node => node.id?.name === 'RenewPriceAlertModal');
const message = modal.body.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'pushDeniedMessage').init;

function findFunction(node, name) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'FunctionDeclaration' && node.id?.name === name) return node;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findFunction(child, name);
      if (found) return found;
    }
  }
  return null;
}

test('logout cleans push before local signout and never reports success on failure', async () => {
  const handler = findFunction(ast, 'handleLogout');
  assert.ok(handler);
  for (const failure of ['', 'push', 'signout']) {
    const calls = [];
    const context = {
      authUser: { id: 'example-user' },
      async disableDevicePushNotifications() { calls.push('push'); if (failure === 'push') throw new Error('offline'); },
      supabase: { auth: { async signOut(options) {
        assert.equal(options.scope, 'local');
        calls.push('signout');
        return { error: failure === 'signout' ? new Error('offline') : null };
      } } },
      setAuthUser() { calls.push('clear-user'); }, setAccountOpen() { calls.push('close'); },
      window: { alert() { calls.push('error'); } }
    };
    vm.runInNewContext(source.slice(handler.start, handler.end), context);
    await context.handleLogout();
    assert.deepEqual(calls, failure === 'push' ? ['push', 'error'] : failure === 'signout'
      ? ['push', 'signout', 'error'] : ['push', 'signout', 'clear-user', 'close']);
  }
});

test('push denial guidance matches Android or browser settings', () => {
  for (const platform of ['android', 'web']) {
    const text = vm.runInNewContext(source.slice(message.start, message.end), { Capacitor: { getPlatform: () => platform } });
    assert.ok(text.includes(platform === 'android' ? 'Android 설정' : '사이트 설정'));
    if (platform === 'android') assert.ok(!text.includes('브라우저'));
  }
});

let supplyImage;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXElement' && node.openingElement.attributes.some(attr => attr.name?.name === 'className' && source.slice(attr.start, attr.end).includes('renew-news-supply-image'))) supplyImage = node;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(visit);
    else if (child && typeof child === 'object') visit(child);
  }
}
visit(ast.program.body.find(node => node.id?.name === 'RenewNews'));
assert.ok(supplyImage);
const { code } = await transform(`globalThis.result = (${source.slice(supplyImage.start, supplyImage.end)});`, { loader: 'jsx' });

test('Android supplies avoid blocked embeds while web retains previews', () => {
  for (const platform of ['android', 'web']) {
    const context = {
      Capacitor: { getPlatform: () => platform },
      item: { title: 'Card sleeve', embedSrc: 'https://example.test/preview' },
      React: { createElement: (type, props, ...children) => ({ type, props, children }) }
    };
    vm.runInNewContext(code, context);
    assert.equal(context.result.props.className.includes('has-embed'), platform === 'web');
    assert.equal(context.result.children[0]?.type === 'iframe', platform === 'web');
    if (platform === 'android') assert.equal(context.result.children[0], 'Ca');
  }
});

test('Android does not render advertising and affiliate components', async () => {
  for (const name of ['RenewSuppliesModal', 'CoupangPartnerBanners', 'RenewPartnerAdSection', 'RenewHomePromoBanner', 'RenewAdInquiry']) {
    const node = ast.program.body.find(node => node.id?.name === name);
    const { code: componentCode } = await transform(source.slice(node.start, node.end), { loader: 'jsx' });
    const context = { Capacitor: { getPlatform: () => 'android' }, useBodyScrollLock() {}, PARTNER_SHOPS_VISIBLE: true };
    vm.runInNewContext(`${componentCode}\nresult = ${name}({});`, context);
    assert.equal(context.result, null, name);
  }
});

test('Android excludes supplies filters and content, including saved routes', () => {
  const news = ast.program.body.find(node => node.id?.name === 'RenewNews');
  const declarations = news.body.body.flatMap(node => node.declarations || []);
  const state = declarations.find(node => node.id.type === 'ArrayPattern' && node.id.elements[0].name === 'newsFilter').init;
  const visible = declarations.find(node => node.id.name === 'showSupplies').init;
  const storage = declarations.find(node => node.id.name === 'isCardStorageGuide').init;
  for (const isAndroid of [true, false]) {
    const context = { isAndroid, isJp: false, newsFilter: 'supplies', initialPath: '/news/supplies', savedViewState: { newsFilter: 'supplies' }, initialSection: 'supplies', NEWS_FILTERS: [{ id: 'supplies' }], useState: init => init() };
    assert.equal(vm.runInNewContext(source.slice(state.start, state.end), context), isAndroid ? 'guide' : 'supplies');
    assert.equal(vm.runInNewContext(source.slice(visible.start, visible.end), context), !isAndroid);
    assert.equal(vm.runInNewContext(source.slice(storage.start, storage.end), context), isAndroid);
  }
});

test('Android uses a non-referral market URL and disables public review controls', () => {
  const link = ast.program.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'SNKRDUNK_MARKET_URL').init;
  const insights = ast.program.body.find(node => node.id?.name === 'RenewLeaderInsightsModal');
  const reviews = insights.body.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'reviewsEnabled').init;
  for (const platform of ['android', 'web']) {
    const context = { Capacitor: { getPlatform: () => platform } };
    const href = vm.runInNewContext(source.slice(link.start, link.end), context);
    assert.equal(href.includes('/invitation/'), platform === 'web');
    assert.equal(vm.runInNewContext(source.slice(reviews.start, reviews.end), context), platform === 'web');
  }
  const guardedClasses = new Set();
  function inspect(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ConditionalExpression' && node.test.name === 'reviewsEnabled') {
      for (const attr of node.consequent.openingElement?.attributes || []) {
        if (attr.name?.name === 'className') guardedClasses.add(attr.value.value);
      }
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(inspect);
      else if (child && typeof child === 'object') inspect(child);
    }
  }
  inspect(insights);
  assert.ok(guardedClasses.has('renew-leader-review-form'));
  assert.ok(guardedClasses.has('renew-leader-review-list'));
});
