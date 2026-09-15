import assert from 'node:assert/strict';
import { prepareCatalog } from './prepareRiftboundD1.mjs';
import { loadRiftboundCatalog } from '../src/api/riftbound.js';

const base = process.argv[2] || 'http://127.0.0.1:4184';
const endpoint = new URL('/api/riftbound', base).href;
const { editions } = await prepareCatalog();
for (const { locale, snapshot, products, revision } of editions) {
  const data = await loadRiftboundCatalog(locale, { endpoint, signal: AbortSignal.timeout(60000) });
  assert.equal(data.revision, revision);
  assert.deepEqual(data.cards, snapshot.cards);
  assert.deepEqual(data.sets, snapshot.sets);
  assert.deepEqual(data.products, products);
  console.log(`${locale}: D1 API verified ${data.cards.length} full card payloads and original order`);
}
for (const [query, method, expected] of [['?locale=JP', 'GET', 400], ['', 'POST', 405], ['?locale=EN&revision=' + '0'.repeat(64), 'GET', 409]]) {
  const response = await fetch(endpoint + query, { method, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, expected);
}
console.log('Invalid edition, read-only endpoint and revision guard verified.');
