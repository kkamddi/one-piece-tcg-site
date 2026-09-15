import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { prepareCatalog } from './prepareRiftboundD1.mjs';

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const database = process.env.RIFTBOUND_D1_DATABASE_ID;
if (!token || !account || !database) throw new Error('Cloudflare D1 deployment credentials are required');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`;
async function query(sql, params = []) {
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || !data.success || data.result.some((result) => !result.success)) throw new Error(`D1 query failed (${response.status}): ${data.errors?.map((error) => error.code).join(',') || 'unknown'}`);
  return data.result[0].results;
}
function importFile(file) {
  const result = spawnSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'optcgkorea-public-shadow', '--remote', '--file', file], { stdio: 'inherit', timeout: 180000 });
  if (result.error || result.status !== 0) throw new Error('Riftbound D1 import failed');
}

const { sql, editions } = await prepareCatalog();
const tables = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='riftbound_catalog_editions'");
if (!tables.length) importFile('migrations/d1/0008_riftbound_catalog.sql');
const current = await query('SELECT locale, revision FROM riftbound_catalog_editions');
if (editions.some((edition) => !current.some((row) => row.locale === edition.locale && row.revision === edition.revision))) {
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/riftbound-d1-seed.sql', sql);
  importFile('artifacts/riftbound-d1-seed.sql');
} else {
  console.log('Riftbound revisions unchanged; no import needed.');
}

// Compare full public payloads, not just counts, before publishing the D1-backed UI.
for (const { locale, revision, snapshot, products } of editions) {
  const [edition] = await query('SELECT revision, card_count, metadata_json FROM riftbound_catalog_editions WHERE locale=?', [locale]);
  assert.equal(edition.revision, revision);
  assert.equal(edition.card_count, snapshot.cards.length);
  const { sets: expectedSets, cards: expectedCards, ...metadata } = snapshot;
  assert.deepEqual(JSON.parse(edition.metadata_json), metadata);
  const sets = await query('SELECT set_json, product_json FROM riftbound_catalog_sets WHERE locale=? ORDER BY sort_order', [locale]);
  assert.deepEqual(sets.map((row) => JSON.parse(row.set_json)), expectedSets);
  assert.deepEqual(Object.fromEntries(sets.filter((row) => row.product_json).map((row) => [JSON.parse(row.set_json).id, JSON.parse(row.product_json)])), products);
  const cards = [];
  let cursor = '';
  for (let page = 0; page < 100; page += 1) {
    const rows = await query('SELECT id, card_json, sort_order FROM riftbound_catalog_cards WHERE locale=? AND id>? ORDER BY id LIMIT 200', [locale, cursor]);
    for (const row of rows) assert.equal(expectedCards[row.sort_order]?.id, row.id);
    cards.push(...rows.map((row) => JSON.parse(row.card_json)));
    if (rows.length < 200) break;
    cursor = rows.at(-1).id;
  }
  assert.deepEqual(cards, [...expectedCards].sort((a, b) => a.id < b.id ? -1 : 1));
  console.log(`${locale}: verified ${cards.length} cards, ${sets.length} sets, revision ${revision}`);
}
