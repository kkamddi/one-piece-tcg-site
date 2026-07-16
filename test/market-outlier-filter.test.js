import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFilteredDailyRows } from '../lib/market-outlier-filter.js';

const group = (date, prices) => ({
  source: 'snkrdunk',
  apparel_id: 1,
  locale: 'JP',
  code: 'TEST-001',
  condition_key: 'psa10',
  point_date: date,
  prices
});

test('keeps a confirmed sustained price regime after an isolated low opening trade', () => {
  const rows = buildFilteredDailyRows([
    group('2024-11-29', [10415]),
    group('2024-12-01', [74000]),
    group('2024-12-05', [78000]),
    group('2024-12-10', [82000]),
    group('2026-07-11', [174601])
  ]);

  assert.deepEqual(rows.map((row) => row.point_date), [
    '2024-11-29',
    '2024-12-01',
    '2024-12-05',
    '2024-12-10',
    '2026-07-11'
  ]);
  assert.equal(rows.at(-1).median_price_jpy, 174601);
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
