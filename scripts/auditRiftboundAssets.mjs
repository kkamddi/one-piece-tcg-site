import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { RIFTBOUND_SET_PRODUCTS } from '../src/data/riftbound-set-products.js';
import { getRiftboundCategories } from '../src/riftbound-catalog.js';

const assets = new Map();
const ids = new Set();
const editions = [];
function addAsset(url, id) {
  assert.equal(new URL(url).protocol, 'https:');
  const references = assets.get(url) || [];
  references.push(id);
  assets.set(url, references);
}
for (const [locale, suffix] of [['EN', ''], ['CN', '-cn'], ['KR', '-kr']]) {
  const snapshot = JSON.parse(await readFile(new URL(`../src/data/riftbound-preview${suffix}.json`, import.meta.url), 'utf8'));
  const setIds = new Set(snapshot.sets.map((set) => set.id));
  assert.equal(setIds.size, snapshot.sets.length);
  assert.deepEqual(getRiftboundCategories(snapshot.sets).flatMap((group) => group.sets.map((set) => set.id)).sort(), [...setIds].sort());
  for (const card of snapshot.cards) {
    assert.ok(!ids.has(card.id), `Duplicate ID: ${card.id}`);
    ids.add(card.id);
    assert.ok(card.id.startsWith(`riftbound:${locale}:`), card.id);
    assert.ok(setIds.has(card.set), card.id);
    assert.ok(card.name && card.code && Number.isFinite(card.number), card.id);
    addAsset(card.image, card.id);
  }
  const products = RIFTBOUND_SET_PRODUCTS[locale] || {};
  for (const [set, product] of Object.entries(products)) addAsset(product.image, `${locale}:${set}:packaging`);
  editions.push({ locale, cards: snapshot.cards.length, sets: [...setIds], missingPackaging: [...setIds].filter((id) => !products[id]) });
}

const report = { checkedAt: new Date().toISOString(), editions, cards: ids.size, uniqueAssetUrls: assets.size, imagesChecked: false, failures: [] };
const productsOnly = process.argv.includes('--products');
if (process.argv.includes('--images')) {
  const queue = [...assets].filter(([, references]) => !productsOnly || references.some((id) => id.endsWith(':packaging')));
  report.imageCheckScope = productsOnly ? 'packaging' : 'all';
  report.checkedAssetUrls = queue.length;
  let checked = 0;
  async function inspect(url) {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`Unexpected content type: ${type}`);
    if (response.headers.get('content-length') === '0') throw new Error('Empty image');
  }
  async function worker() {
    while (queue.length) {
      const [url, references] = queue.shift();
      let error;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await inspect(url); error = null; break; }
        catch (failure) { error = failure.message; }
      }
      if (error) report.failures.push({ url, references, error });
      checked++;
      if (checked % 250 === 0) console.log(`Checked ${checked}/${assets.size} image URLs`);
    }
  }
  // Bound traffic to the official image hosts; do not launch one request per card at once.
  await Promise.all(Array.from({ length: 4 }, worker));
  report.imagesChecked = true;
}
await writeFile(new URL(`../artifacts/riftbound-${productsOnly ? 'product-' : ''}asset-audit.json`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, failures: report.failures.slice(0, 10), failureCount: report.failures.length }, null, 2));
if (report.failures.length) process.exitCode = 1;
