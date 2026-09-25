import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadReferenceData, resilientReferenceReader } from '../extensions/card-pone/reference-data.js';

function fixture() {
  const body = JSON.stringify({ version: 3, items: [{ apparelId: 1, code: 'P-110', locale: 'JP' }] });
  const hash = createHash('sha256').update(body).digest('hex');
  const manifest = { schema: 1, indexVersion: 3, revision: hash, files: { 'catalog.json': hash } };
  const stored = new Map(), calls = [];
  const cacheStorage = { open: async () => ({ match: async url => stored.get(url)?.clone(), put: async (url, value) => stored.set(url, value), keys: async () => [...stored.keys()].map(url => ({ url })), delete: async request => stored.delete(request.url) }) };
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return new Response(url.endsWith('manifest.json') ? JSON.stringify(manifest) : body);
  };
  return { manifest, calls, fetcher, cacheStorage };
}
test('references reuse hash-addressed cached files and send no captured data or credentials', async () => {
  const f = fixture();
  const signal = new AbortController().signal;
  assert.equal((await loadReferenceData(signal, f)).market.length, 1);
  await loadReferenceData(signal, f);
  assert.equal(f.calls.filter(call => call.url.includes('catalog.json')).length, 1);
  for (const { options } of f.calls) {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined);
  }
});
test('unknown paths and mismatched file hashes fail closed', async () => {
  const signal = new AbortController().signal;
  const f = fixture();
  f.manifest.files['../../private'] = 'a'.repeat(64);
  await assert.rejects(loadReferenceData(signal, f), /reference_path_invalid/);
  const g = fixture();
  g.manifest.files['catalog.json'] = 'b'.repeat(64);
  await assert.rejects(loadReferenceData(signal, g), /reference_integrity_failed/);
});

test('a mid-scan remote failure switches this scan to packaged references', async () => {
  let remoteCalls = 0;
  const requests = [];
  const remote = { readIndex: async () => { remoteCalls += 1; throw new Error('reference_integrity_failed'); } };
  const read = resilientReferenceReader(remote, new AbortController().signal, {
    baseUrl: 'chrome-extension://test/card-scan/',
    fetcher: async url => { requests.push(url); return Response.json({ version: 3, items: [{ key: 'packaged' }] }); }
  });
  assert.equal((await read('index-JP')).items[0].key, 'packaged');
  await read('JP/OP14-084');
  await read('index-EN');
  assert.equal(remoteCalls, 1);
  assert.deepEqual(requests, ['index-JP', 'JP/OP14-084', 'index-EN'].map(file => `chrome-extension://test/card-scan/${file}.json`));
});

test('healthy remote data remains preferred; cancellation never triggers fallback', async () => {
  const controller = new AbortController();
  const value = { version: 3, items: [] };
  const read = resilientReferenceReader({ readIndex: async () => value }, controller.signal, {
    baseUrl: 'chrome-extension://test/card-scan/', fetcher: () => { throw new Error('unexpected_local_fetch'); }
  });
  assert.equal(await read('index-JP'), value);
  controller.abort();
  await assert.rejects(read('index-JP'), { name: 'AbortError' });
});

test('packaged fallback validates paths, version and availability', async () => {
  const options = { baseUrl: 'chrome-extension://test/card-scan/', fetcher: async () => Response.json({ version: 2, items: [] }) };
  const read = resilientReferenceReader(null, new AbortController().signal, options);
  await assert.rejects(read('../private'), /reference_path_invalid/);
  await assert.rejects(read('index-JP'), /bundled_reference_invalid/);
  const missing = resilientReferenceReader(null, new AbortController().signal, { ...options, fetcher: async () => new Response('', { status: 404 }) });
  await assert.rejects(missing('index-EN'), /bundled_reference_unavailable/);
});
