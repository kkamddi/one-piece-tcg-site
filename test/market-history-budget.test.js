import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import * as tradeDates from '../lib/market-trade-date.js';
import * as outlierFilter from '../lib/market-outlier-filter.js';
import * as indexChain from '../lib/market-index-chain.js';

// Load the actual modules in isolation: no production credentials, network or CLI entrypoint.
async function loadModule(path, exports, env = {}) {
  let source = await fs.readFile(new URL(path, import.meta.url), 'utf8');
  if (path.includes('backfillSnkrdunk')) {
    const entrypoint = source.lastIndexOf('\nmain().catch(');
    assert.ok(entrypoint > 0);
    source = source.slice(0, entrypoint);
  }
  const context = vm.createContext({ process: { env }, console, Date, URL, URLSearchParams });
  const module = new vm.SourceTextModule(source + '\n' + exports, { context });
  const unexpected = () => { throw new Error('Unexpected external operation'); };
  const dependencies = {
    'node:fs/promises': { appendFile: unexpected },
    'node:fs': { default: { existsSync: () => false } },
    '../src/data/market-cards.js': { default: [] },
    '../src/data/card-market-links.js': { default: {} },
    './market.js': { collectMarketSnapshot: unexpected },
    '../lib/market-trade-date.js': tradeDates,
    '../lib/market-outlier-filter.js': outlierFilter,
    '../lib/market-index-chain.js': indexChain,
    '../lib/r2-json-cache.js': { invalidateR2Json: async () => false, readThroughR2Json: unexpected },
  };
  await module.link((specifier) => {
    const values = dependencies[specifier];
    assert.ok(values, specifier);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

async function collector(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE market_recent_trades (
    source TEXT, apparel_id INTEGER, locale TEXT, code TEXT, condition_key TEXT,
    trade_date TEXT, trade_date_text TEXT, price_amount_jpy INTEGER, price_text TEXT,
    first_seen_at TEXT, last_seen_at TEXT, raw_payload_json TEXT,
    UNIQUE(source, apparel_id, condition_key, trade_date_text, price_amount_jpy)
  )`);
  const calls = [];
  const binding = {
    prepare(sql) {
      return { bind(...params) {
        return { async run() {
          const result = db.prepare(sql).run(...params);
          calls.push({ sql, changes: Number(result.changes) });
          return { meta: { changes: Number(result.changes) } };
        } };
      } };
    },
  };
  const module = await loadModule('../api/market-collector.js', 'export { ingestHistoryPayload };', { DB: binding });
  const date = new Date().toISOString().slice(0, 10);
  const ingest = (overrides = {}) => module.ingestHistoryPayload({ apparelId: 123, code: 'OP01-001', history: [
    { date, dateText: date + ' 12:00', condition: 'PSA10', priceJpy: 1000, priceText: 'JPY 1000', ...overrides },
  ] }, { updateDailyPoints: false });
  return { db, calls, ingest };
}

test('new trades are inserted once and identical raw trades cause zero changed rows', async (t) => {
  const { db, calls, ingest } = await collector(t);
  assert.equal((await ingest()).tradesStored, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].changes, 1);
  const before = db.prepare('SELECT * FROM market_recent_trades').get();
  calls.length = 0;
  assert.equal((await ingest()).tradesStored, 0);
  assert.equal(calls.reduce((sum, call) => sum + call.changes, 0), 0);
  assert.deepEqual(db.prepare('SELECT * FROM market_recent_trades').get(), before);
});

test('changed raw metadata and corrected dates still update existing trades', async (t) => {
  const { db, calls, ingest } = await collector(t);
  await ingest();
  db.exec("UPDATE market_recent_trades SET trade_date = '2000-01-01', raw_payload_json = NULL");
  calls.length = 0;
  await ingest();
  assert.equal(calls.reduce((sum, call) => sum + call.changes, 0), 1);
  assert.notEqual(db.prepare('SELECT trade_date FROM market_recent_trades').get().trade_date, '2000-01-01');
  assert.ok(db.prepare('SELECT raw_payload_json FROM market_recent_trades').get().raw_payload_json);
});

test('listing UID duplicates are not deleted, but corrected listing identities replace the old trade', async (t) => {
  const { db, calls, ingest } = await collector(t);
  await ingest({ listingUid: 'listing-1' });
  calls.length = 0;
  await ingest({ listingUid: 'listing-1' });
  assert.equal(calls.reduce((sum, call) => sum + call.changes, 0), 0);
  await ingest({ listingUid: 'listing-1', priceJpy: 2000, priceText: 'JPY 2000' });
  const rows = db.prepare('SELECT price_amount_jpy FROM market_recent_trades').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_amount_jpy, 2000);
});

async function backfill(pages, overrides = {}) {
  const requested = [];
  const saved = [];
  const module = await loadModule('../scripts/backfillSnkrdunkSoldListings.js', `
    export { backfillTradingHistoryItem };
    export function setDependencies(fetchPage, finalize) {
      fetchTradingHistoriesPage = fetchPage;
      finalizeAggregateHistory = finalize;
    }
  `);
  module.setDependencies(async (id, page) => {
    requested.push(page);
    assert.ok(pages[page - 1], 'Unexpected extra page ' + page);
    return pages[page - 1];
  }, async (item, buckets, history) => saved.push({ buckets, history }));
  const result = await module.backfillTradingHistoryItem({ apparelId: 123 }, {
    tradingHistoryMaxPages: 2, tradingHistoryRecoveryMaxPages: 5, tradingHistoryPerPage: 2,
    aggregateMode: true, requireCompleteDailyWindow: true, allowedConditions: new Set(['psa10']),
    dailyCutoffDate: '2026-09-03', recentRawCutoffDate: '2026-09-03', delayMs: 0,
    ...overrides,
  });
  return { result, requested, saved };
}

const row = (date = '2026-09-05') => ({ date, condition: 'PSA10', priceText: 'JPY 1000' });
const full = () => [row(), row()];

test('complete cards stop within the base allowance without recovery calls', async () => {
  const { result, requested, saved } = await backfill([full(), [row()]]);
  assert.deepEqual(requested, [1, 2]);
  assert.equal(result.recoveryPagesFetched, 0);
  assert.equal(result.dailyWindowComplete, true);
  assert.equal(saved.length, 1);
});

test('only capped cards continue from the next page and persist one complete aggregate', async () => {
  const { result, requested, saved } = await backfill([full(), full(), [row(), row('2026-09-02')]]);
  assert.deepEqual(requested, [1, 2, 3]);
  assert.equal(result.recoveryPagesFetched, 1);
  assert.equal(result.dailyWindowComplete, true);
  assert.equal(result.capped, false);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].history.length, 5);
});

test('recovery is bounded and incomplete aggregates never overwrite stored data', async () => {
  const { result, requested, saved } = await backfill(Array.from({ length: 5 }, full));
  assert.equal(requested.length, 5);
  assert.equal(result.recoveryPagesFetched, 3);
  assert.equal(result.dailyWindowComplete, false);
  assert.equal(result.capped, true);
  assert.equal(saved.length, 0);
});

test('critical profile does not permit extra pages', async () => {
  const { result, requested, saved } = await backfill([full()], {
    tradingHistoryMaxPages: 1, tradingHistoryRecoveryMaxPages: 1,
  });
  assert.deepEqual(requested, [1]);
  assert.equal(result.recoveryPagesFetched, 0);
  assert.equal(result.capped, true);
  assert.equal(saved.length, 0);
});

test('workflows without a recovery allowance keep their existing page limit', async () => {
  const { result, requested } = await backfill([full(), full()], { tradingHistoryRecoveryMaxPages: undefined });
  assert.deepEqual(requested, [1, 2]);
  assert.equal(result.capped, true);
});
