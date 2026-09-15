import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { prepareCatalog } from './prepareRiftboundD1.mjs';
import handler from '../api/riftbound.js';
import { loadRiftboundCatalog } from '../src/api/riftbound.js';

const { sql, editions } = await prepareCatalog();
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;');
db.exec(await readFile(new URL('../migrations/d1/0008_riftbound_catalog.sql', import.meta.url), 'utf8'));
db.exec(sql);
const binding = {
  prepare(query) { return { bind(...values) { return { query, values }; } }; },
  async batch(statements) { return statements.map(({ query, values }) => ({ results: db.prepare(query).all(...values) })); }
};
async function request(query = {}, method = 'GET', env = { OPTCG_PUBLIC_D1: binding }) {
  const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, query }, res, env);
  return res;
}
const fetcher = async (url) => {
  const result = await request(Object.fromEntries(new URL(url, 'https://local.test').searchParams));
  return { ok: result.statusCode === 200, status: result.statusCode, json: async () => result.body };
};

test('D1 import preserves every ID, complete payload, set and product image', () => {
  assert.equal(db.prepare('SELECT count(*) AS n FROM riftbound_catalog_cards').get().n, 2472);
  for (const { locale, snapshot, products } of editions) {
    const rows = db.prepare('SELECT card_json FROM riftbound_catalog_cards WHERE locale=? ORDER BY id').all(locale);
    assert.deepEqual(rows.map((row) => JSON.parse(row.card_json)), [...snapshot.cards].sort((a, b) => a.id < b.id ? -1 : 1));
    const sets = db.prepare('SELECT set_json, product_json FROM riftbound_catalog_sets WHERE locale=? ORDER BY sort_order').all(locale);
    assert.deepEqual(sets.map((row) => JSON.parse(row.set_json)), snapshot.sets);
    assert.deepEqual(Object.fromEntries(sets.filter((row) => row.product_json).map((row) => [JSON.parse(row.set_json).id, JSON.parse(row.product_json)])), products);
  }
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('reimport is idempotent and does not rewrite unchanged cards', () => {
  const before = db.prepare('SELECT total_changes() AS n').get().n;
  db.exec(sql);
  assert.equal(db.prepare('SELECT total_changes() AS n').get().n, before);
});

test('pagination uses the locale/id index', () => {
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT card_json FROM riftbound_catalog_cards WHERE locale=? AND id>? ORDER BY id LIMIT ?').all('EN', '', 201);
  assert.ok(plan.some((row) => row.detail.includes('idx_riftbound_cards_locale_id')));
  assert.ok(!plan.some((row) => row.detail.includes('SCAN')));
});

test('API/client pagination returns each complete edition without mixed locales', async () => {
  for (const { locale, snapshot, revision } of editions) {
    const data = await loadRiftboundCatalog(locale, { fetcher });
    assert.equal(data.revision, revision);
    assert.equal(data.storage, 'd1');
    assert.deepEqual(data.cards, snapshot.cards);
  }
});

test('API rejects writes and malformed queries, and reports unavailable D1', async () => {
  assert.equal((await request({}, 'POST')).statusCode, 405);
  assert.equal((await request({ locale: 'JP' })).statusCode, 400);
  assert.equal((await request({ locale: 'KR', cursor: 'riftbound:EN:1' })).statusCode, 400);
  assert.equal((await request({ revision: "'; DROP TABLE cards;--" })).statusCode, 400);
  assert.equal((await request({}, 'GET', {})).statusCode, 503);
  assert.equal((await request({}, 'GET', { OPTCG_PUBLIC_D1: { batch() { throw new Error('secret'); }, prepare: binding.prepare } })).body.error, 'catalog_unavailable');
  assert.equal((await request({ revision: '0'.repeat(64) })).statusCode, 409);
});

test('client rejects incomplete, duplicate and changing pages', async () => {
  const base = (await request({ locale: 'KR' })).body;
  const fake = (data) => async () => ({ ok: true, json: async () => data });
  await assert.rejects(loadRiftboundCatalog('KR', { fetcher: fake({ ...base, total: 5 }) }), /Incomplete/);
  await assert.rejects(loadRiftboundCatalog('KR', { fetcher: fake({ ...base, cards: [base.cards[0], base.cards[0]] }) }), /identity/);
  await assert.rejects(loadRiftboundCatalog('KR', { fetcher: fake({ ...base, nextCursor: 'invalid' }) }), /cursor/);
  let calls = 0;
  await assert.rejects(loadRiftboundCatalog('KR', { fetcher: async () => ({ ok: true, json: async () => ++calls === 1 ? { ...base, cards: base.cards.slice(0, 2), order: base.order.slice(0, 2), nextCursor: base.cards[1].id } : { ...base, revision: '0'.repeat(64), cards: base.cards.slice(2) } }) }), /changed/);
});

test('client forwards cancellation and never reads bundled snapshots as fallback', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadRiftboundCatalog('EN', { signal: controller.signal, fetcher: async (url, options) => { assert.equal(options.signal, controller.signal); options.signal.throwIfAborted(); } }), { name: 'AbortError' });
  const source = await readFile(new URL('../src/RiftboundCatalog.jsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('riftbound-preview.json'));
  assert.ok(source.includes('const COLLECTION_ENABLED = false'));
});

test('client recovers from a cached old revision only once', async () => {
  const base = (await request({ locale: 'KR' })).body;
  let calls = 0;
  const data = await loadRiftboundCatalog('KR', { fetcher: async (url) => {
    if (++calls === 1) return { ok: false, status: 409, json: async () => ({ revision: base.revision }) };
    assert.equal(new URL(url, 'https://local.test').searchParams.get('revision'), base.revision);
    return { ok: true, json: async () => base };
  } });
  assert.equal(data.cards.length, 4);
  await assert.rejects(loadRiftboundCatalog('KR', { fetcher: async () => ({ ok: false, status: 409, json: async () => ({ revision: base.revision }) }) }), /changed/);
});
