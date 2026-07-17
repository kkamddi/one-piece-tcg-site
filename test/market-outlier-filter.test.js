import test from 'node:test';
import assert from 'node:assert/strict';

import {
  auditFilteredDailyCoverage,
  buildFilteredDailyRows
} from '../lib/market-outlier-filter.js';

const group = (date, prices) => ({
  source: 'snkrdunk',
  apparel_id: 1,
  locale: 'JP',
  code: 'TEST-001',
  condition_key: 'psa10',
  point_date: date,
  prices
});

test('does not select the lowest cluster from a wide first-day price spread', () => {
  const rows = buildFilteredDailyRows([
    group('2024-11-29', [10415, 99000, 101000, 103000]),
    group('2024-12-01', [74000]),
    group('2024-12-05', [78000]),
    group('2024-12-10', [82000]),
    group('2026-07-10', [170000]),
    group('2026-07-11', [174601])
  ]);

  assert.deepEqual(rows.map((row) => row.point_date), [
    '2024-11-29',
    '2024-12-01',
    '2024-12-05',
    '2024-12-10',
    '2026-07-10',
    '2026-07-11'
  ]);
  assert.equal(rows[0].median_price_jpy, 100000);
  assert.equal(rows[0].trade_count, 4);
  assert.equal(rows.at(-1).median_price_jpy, 174601);
});

test('removes an unsupported single-trade opening price from the local regime', () => {
  const rows = buildFilteredDailyRows([
    group('2025-12-14', [247489]),
    group('2025-12-15', [91262]),
    group('2025-12-18', [97964]),
    group('2025-12-22', [103120]),
    group('2025-12-23', [103120])
  ]);

  assert.deepEqual(rows.map((row) => row.point_date), [
    '2025-12-15',
    '2025-12-18',
    '2025-12-22',
    '2025-12-23'
  ]);
});

test('removes an isolated bundle-like spike between stable trading days', () => {
  const rows = buildFilteredDailyRows([
    group('2025-01-01', [100]),
    group('2025-01-02', [105]),
    group('2025-01-03', [1000]),
    group('2025-01-04', [110])
  ]);

  assert.deepEqual(rows.map((row) => row.point_date), [
    '2025-01-01',
    '2025-01-02',
    '2025-01-04'
  ]);
});

test('waits for confirmation before accepting a new isolated latest spike', () => {
  const rows = buildFilteredDailyRows([
    group('2025-01-01', [100]),
    group('2025-01-02', [105]),
    group('2025-02-15', [1000])
  ]);

  assert.deepEqual(rows.map((row) => row.point_date), ['2025-01-01', '2025-01-02']);
});

test('accepts a same-day regime change confirmed by consistent multiple trades', () => {
  const rows = buildFilteredDailyRows([
    group('2025-01-01', [100]),
    group('2025-02-15', [980, 1020])
  ]);

  assert.deepEqual(rows.map((row) => row.point_date), ['2025-01-01', '2025-02-15']);
  assert.equal(rows.at(-1).median_price_jpy, 1000);
});

test('keeps a sustained real drop instead of treating it as a transient outlier', () => {
  const rows = buildFilteredDailyRows([
    group('2025-01-01', [100]),
    group('2025-01-02', [102]),
    group('2025-01-03', [60]),
    group('2025-01-04', [58]),
    group('2025-01-05', [62])
  ]);

  assert.deepEqual(rows.map((row) => row.median_price_jpy), [100, 102, 60, 58, 62]);
});

test('preserves a supported launch premium and its later market correction', () => {
  const rows = buildFilteredDailyRows([
    group('2026-03-04', [350000, 360000, 355000]),
    group('2026-03-05', [348000, 352000]),
    group('2026-03-07', [340000]),
    group('2026-03-12', [205000]),
    group('2026-03-14', [198000]),
    group('2026-03-16', [202000])
  ]);

  assert.deepEqual(rows.map((row) => row.median_price_jpy), [355000, 350000, 340000, 205000, 198000, 202000]);
});

test('rejects a collection that collapses many raw trades into one daily point', () => {
  const rawRows = Array.from({ length: 15 }, (_, index) => ({
    condition_key: 'psa10',
    point_date: `2025-01-${String(index + 1).padStart(2, '0')}`,
    trade_count: 50,
    source_count: 50
  }));
  const audit = auditFilteredDailyCoverage(rawRows, [{
    condition_key: 'psa10',
    point_date: '2025-01-01',
    trade_count: 1
  }]);

  assert.equal(audit.valid, false);
  assert.deepEqual(audit.conditions[0].reasons, [
    'too-few-accepted-days',
    'low-day-retention',
    'low-trade-retention'
  ]);
});

test('allows sparse history when the collector retained all available days', () => {
  const rows = [
    { condition_key: 'psa10', point_date: '2025-01-01', trade_count: 1, source_count: 1 },
    { condition_key: 'psa10', point_date: '2025-01-10', trade_count: 1, source_count: 1 }
  ];

  assert.equal(auditFilteredDailyCoverage(rows, rows).valid, true);
});
