import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPrices } from '../extensions/card-pone/prices.js';
import { recognitionContact } from '../extensions/card-pone/contact.js';
beforeEach(() => { globalThis.chrome = { runtime: { id: 'test', sendMessage: async () => ({ member: true, memberId: 'test-member' }) } }; });
afterEach(() => { delete globalThis.chrome; });

test('price requests omit credentials, referrer and screenshot data', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://www.optcgkorea.com/api/market?summary=trade-latest&apparelIds=108050');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.body, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ basis: 'snkrdunk_latest_trade_day_median', items: [] });
  });
  const result = await fetchPrices(108050, new AbortController().signal);
  assert.equal(result.single, null);
  assert.equal(result.psa10, null);
});

test('HTTP failure can be retried without preserving a previous price', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? new Response('', { status: 503 })
    : Response.json({ basis: 'snkrdunk_latest_trade_day_median', items: [{ apparelId: 1, aPriceJpy: 123 }] }));
  const signal = new AbortController().signal;
  await assert.rejects(fetchPrices(1, signal), /price_unavailable/);
  assert.equal((await fetchPrices(1, signal)).single, 123);
});

test('cancel and malformed responses remain errors rather than zero prices', async t => {
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    options.signal.throwIfAborted();
    return new Response('not-json');
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchPrices(1, controller.signal), { name: 'AbortError' });
  await assert.rejects(fetchPrices(1, new AbortController().signal), SyntaxError);
});

test('contact only drafts an email with version and candidate identity', () => {
  const link = new URL(recognitionContact('0.1.10', [{ code: 'P-110', locale: 'JP', screenshot: 'PRIVATE_IMAGE', url: 'PRIVATE_PAGE' }]));
  assert.equal(link.protocol, 'mailto:');
  assert.equal(link.pathname, 'optkr26@gmail.com');
  assert.match(link.searchParams.get('body'), /P-110 \(JP\)/);
  assert.ok(!link.href.includes('PRIVATE'));
});
