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

async function backfillJp(responses, overrides = {}) {
  const saved = [];
  const requested = [];
  const module = await loadModule('../scripts/backfillSnkrdunkSoldListings.js', `
    export { backfillJpTradingHistoryItem };
    export function setJpDependencies(catalogId, fetchTrades, finalize) {
      fetchProductCatalogId = catalogId;
      fetchJpTradingHistory = fetchTrades;
      finalizeJpHistory = finalize;
    }
  `);
  module.setJpDependencies(async () => 780929, async (id, condition, variantId = 0) => {
    requested.push(`${condition}:${variantId}`);
    const response = responses[condition] || {};
    return (variantId ? response.singles : response.all) || response.all || { trades: [], points: [], oneCardVariantId: 0 };
  }, async (item, dailyRows, chartedConditions, history) => saved.push({ dailyRows, chartedConditions, history }));
  const result = await module.backfillJpTradingHistoryItem({ apparelId: 676003 }, {
    aggregateMode: true, allowedConditions: new Set(['a', 'psa10']),
    dailyCutoffDate: '2026-10-01', recentRawCutoffDate: '2026-10-01', delayMs: 0,
    ...overrides,
  });
  return { result, saved, requested };
}

const jpTrade = (soldAt, price, title = 'PSA10', label = '1枚') => ({ soldAt, price, title, label });
// Chart points are stamped at midnight JST.
const jpPoint = (day, price) => ({ timestamp: Date.parse(`${day}T00:00:00+09:00`), price });

test('the daily price is SNKRDUNK chart value in yen, asked again for single cards when bundles are listed', async () => {
  const { result, saved, requested } = await backfillJp({
    a: {
      all: { trades: [jpTrade('2026-10-05T03:00:00Z', 1900000, 'A'), jpTrade('2026-10-05T04:00:00Z', 2000, 'A', '4枚')], points: [], oneCardVariantId: 9248047 },
      singles: { trades: [jpTrade('2026-10-05T03:00:00Z', 1900000, 'A'), jpTrade('2026-10-05T05:00:00Z', 1700000, 'A')], points: [jpPoint('2026-09-20', 1500000), jpPoint('2026-10-05', 1800000)] },
    },
    psa10: { all: { trades: [jpTrade('2026-10-07T03:00:00Z', 2798000)], points: [jpPoint('2026-10-07', 2798000)], oneCardVariantId: 9248047 } },
  });
  assert.deepEqual(requested, ['a:0', 'a:9248047', 'psa10:0']);
  assert.equal(result.historySource, 'jp-trading-history');
  // Array.from builds the array in this realm; the module runs in its own vm context.
  const rows = Array.from(saved[0].dailyRows, (row) => [row.condition_key, row.point_date, row.median_price_jpy, row.min_price_jpy, row.max_price_jpy, row.trade_count]);
  assert.deepEqual(rows, [
    ['a', '2026-10-05', 1800000, 1700000, 1900000, 2],
    ['psa10', '2026-10-07', 2798000, 2798000, 2798000, 1],
  ], 'days before the window are left alone');
  const prices = Array.from(saved[0].history, (trade) => `${trade.conditionKey}:${trade.priceJpy}`).sort();
  assert.deepEqual(prices, ['a:1700000', 'a:1900000', 'psa10:2798000']);
});

test('with 20 listed trades the counts are only known from the day after the oldest one', async () => {
  const busy = Array.from({ length: 20 }, (_, index) => jpTrade(`2026-10-${String(14 - Math.floor(index / 5)).padStart(2, '0')}T03:00:00Z`, 1000 + index));
  const points = ['2026-10-03', '2026-10-11', '2026-10-12'].map((day) => jpPoint(day, 1000));
  const { result, saved } = await backfillJp({ psa10: { all: { trades: busy, points } } });
  assert.equal(result.capped, true);
  const counts = Object.fromEntries(Array.from(saved[0].dailyRows, (row) => [row.point_date, row.trade_count]));
  assert.deepEqual(counts, { '2026-10-03': null, '2026-10-11': null, '2026-10-12': 5 });
});

async function finalizeJp(dailyRows, chartedConditions, storedRows, overrides = {}) {
  const queries = [];
  const module = await loadModule('../scripts/backfillSnkrdunkSoldListings.js', `
    export { finalizeJpHistory };
    export function setQuery(fn) { queryD1 = fn; }
  `);
  module.setQuery(async (sql, params) => {
    queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    return sql.trim().startsWith('select') ? storedRows : [];
  });
  const result = { historyPosted: 0, tradesSeen: 0, tradesStored: 0 };
  await module.finalizeJpHistory({ apparelId: 676003 }, dailyRows, new Set(chartedConditions), [], result, {
    dailyCutoffDate: '2000-01-01', replaceDailyWindow: true, ...overrides,
  });
  return { result, queries };
}

const dailyRow = (condition, day, price, count = null) => ({
  source: 'snkrdunk', apparel_id: 676003, locale: 'JP', code: '', condition_key: condition, point_date: day,
  median_price_jpy: price, min_price_jpy: price, max_price_jpy: price, trade_count: count, source_count: count,
});
const storedRow = (condition, day, price, count) => ({
  condition_key: condition, point_date: day, median_price_jpy: price, min_price_jpy: price, max_price_jpy: price, trade_count: count, source_count: count,
});

test('stored days SNKRDUNK does not list are removed, unknown counts are kept, unchanged days are not written', async () => {
  const { result, queries } = await finalizeJp(
    [dailyRow('a', '2026-08-01', 2300000), dailyRow('a', '2026-10-05', 1900000, 1)],
    ['a'],
    [storedRow('a', '2026-08-01', 2269830, 3), storedRow('a', '2026-09-13', 2139620, 1), storedRow('a', '2026-10-05', 1900000, 1)],
  );
  assert.equal(result.audit.priceChangedRows, 1);
  assert.equal(result.audit.unchangedRows, 1);
  assert.equal(result.audit.missingCandidateRows, 1);
  const insert = queries.find((query) => query.sql.startsWith('insert'));
  assert.ok(insert.params.includes('2026-08-01') && !insert.params.includes('2026-10-05'));
  assert.equal(insert.params[insert.params.indexOf('2026-08-01') + 4], 3, 'stored trade count is kept');
  const [removeDay, removeConverted] = queries.filter((query) => query.sql.startsWith('delete'));
  assert.deepEqual(Array.from(removeDay.params), [676003, 'a', '2026-09-13']);
  assert.match(removeConverted.sql, /from market_recent_trades .*price_text like '%₩%'/);
  assert.deepEqual(Array.from(removeConverted.params), [676003, 'a']);
});

test('a dry run only audits and a condition without chart points keeps its stored days', async () => {
  const { result, queries } = await finalizeJp([dailyRow('psa10', '2026-10-07', 2798000, 1)], ['psa10'], [], { dryRun: true });
  assert.equal(result.audit.missingStoredRows, 1);
  assert.equal(queries.length, 1);
  assert.ok(!queries[0].params.includes('a'), 'only charted conditions are read and pruned');
});
