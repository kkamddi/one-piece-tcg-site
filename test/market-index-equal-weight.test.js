import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInitialPriceFormationSeries,
  buildEqualWeightedMarketIndex,
  clampObservedPriceMoves
} from '../lib/market-index-chain.js';
import {
  assertEqualWeightedMarketIndex,
  auditEqualWeightedMarketIndex
} from '../lib/market-index-audit.js';

const config = (components) => ({
  code: 'test',
  name: 'Test Index',
  baseValue: 100,
  components
});

const row = (apparelId, pointDate, price) => ({
  apparel_id: apparelId,
  point_date: pointDate,
  median_price_jpy: price
});

const build = (components, rows, options = {}) => buildEqualWeightedMarketIndex(
  config(components),
  rows,
  {
    initialFormationWindowDays: 1,
    minimumInitialTradingDays: 1,
    minimumInitialTradeCount: 1,
    ...options
  }
);

test('starts the sector at 100 on the earliest component first-trade date', () => {
  const built = build([{ apparelId: 1 }, { apparelId: 2 }], [
    row(1, '2024-02-02', 50),
    row(1, '2025-01-01', 100),
    row(2, '2025-01-01', 100)
  ]);

  assert.equal(built.baseDate, '2024-02-02');
  assert.equal(built.indexPoints[0].date, '2024-02-02');
  assert.equal(built.indexPoints[0].value, 100);
  const admissionDatePoints = built.componentPoints.filter((point) => point.date === '2025-01-01');
  assert.deepEqual(admissionDatePoints.map((point) => point.componentIndexValue), [120, 100]);
  assert.deepEqual(built.dataComponents.map((component) => 100 * component.series[0].price / component.basePrice), [100, 100]);
  assertEqualWeightedMarketIndex(built);
});

test('admits a new component without moving the sector on the admission day', () => {
  const built = build([{ apparelId: 1 }, { apparelId: 2 }], [
    row(1, '2025-01-01', 100),
    row(1, '2025-01-02', 120),
    row(2, '2025-01-02', 50),
    row(2, '2025-01-03', 55)
  ]);

  assert.equal(built.indexPoints.find((point) => point.date === '2025-01-01').value, 100);
  assert.equal(built.indexPoints.find((point) => point.date === '2025-01-02').value, 120);
  assert.equal(built.indexPoints.find((point) => point.date === '2025-01-03').value, 125.4545);
  assert.equal(built.admissions[0].valueBeforeAdmission, 120);
  assert.equal(built.admissions[0].valueAfterAdmission, 120);
  const entrant = built.componentPoints.find((point) => point.apparelId === 2 && point.date === '2025-01-02');
  assert.equal(entrant.componentIndexValue, 100);
  assertEqualWeightedMarketIndex(built);
});

test('does not rewrite prior points when a future trade and component are appended', () => {
  const components = [{ apparelId: 1 }, { apparelId: 2 }];
  const initialRows = [row(1, '2024-12-01', 100), row(1, '2025-01-03', 110)];
  const before = build(components, initialRows, { endDate: '2025-01-05' });
  const after = build(components, [
    ...initialRows,
    row(1, '2025-01-10', 150),
    row(2, '2025-01-10', 200)
  ], { endDate: '2025-01-10' });

  const stableFields = (points) => points.map(({ date, value, activeCount }) => ({ date, value, activeCount }));
  assert.deepEqual(
    stableFields(after.indexPoints.filter((point) => point.date <= before.endDate)),
    stableFields(before.indexPoints)
  );
});

test('carries the prior target and limits an observed one-day outlier causally', () => {
  const series = clampObservedPriceMoves([
    { date: '2025-01-01', price: 100 },
    { date: '2025-01-02', price: 1000 },
    { date: '2025-01-03', price: 100 }
  ]);
  assert.deepEqual(series.map((point) => point.price), [100, 120, 100]);
});

test('independent audit rejects a sector value that does not match the component sum and divisor', () => {
  const built = build([{ apparelId: 1 }], [row(1, '2025-01-01', 100)]);
  built.indexPoints[0].value = 150;
  const audit = auditEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, false);
  assert.equal(audit.indexFormulaViolations.length, 1);
});

test('independent audit rejects an admission jump', () => {
  const built = build([{ apparelId: 1 }, { apparelId: 2 }], [
    row(1, '2025-01-01', 100),
    row(2, '2025-01-02', 100)
  ]);
  built.admissions[0].valueAfterAdmission += 1;
  const audit = auditEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, false);
  assert.equal(audit.admissionViolations.length, 1);
});

test('accepts an intentionally empty sector without creating fake points', () => {
  const built = build([], []);
  const audit = assertEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, true);
  assert.equal(audit.noData, true);
  assert.deepEqual(built.indexPoints, []);
});

test('is deterministic for the same complete history', () => {
  const rows = [
    row(1, '2024-01-01', 100),
    row(1, '2025-01-02', 105),
    row(2, '2025-01-03', 200),
    row(2, '2025-01-05', 210)
  ];
  const first = build([{ apparelId: 1 }, { apparelId: 2 }], rows);
  const second = build([{ apparelId: 1 }, { apparelId: 2 }], rows);
  assert.deepEqual(second, first);
});

test('uses the median of the bounded 30-day formation window instead of a first-day outlier', () => {
  const prices = [247489, 91262, 97964, 103120, 103120, 128901, 139110, 131994, 138181, 149525, 151000];
  const dates = ['2025-12-14', '2025-12-15', '2025-12-18', '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-25', '2025-12-29', '2025-12-31', '2026-01-02', '2026-01-11'];
  const series = prices.map((price, index) => ({
    date: dates[index],
    price
  }));
  const baseline = buildInitialPriceFormationSeries(series, { endDate: '2026-07-16' });

  assert.equal(baseline.firstObservedPrice, 247489);
  assert.equal(baseline.baselinePrice, 131994);
  assert.equal(baseline.baselineDate, '2026-01-12');
  assert.deepEqual(baseline.series, [{ date: '2026-01-12', price: 131994 }]);
});

test('admits a component at 100 only after its 30-day formation window closes', () => {
  const rows = [100, 110, 120, 130, 140].map((price, index) => ({
    ...row(1, `2025-12-${String(index + 1).padStart(2, '0')}`, price),
    trade_count: 1
  }));
  rows.push(row(1, '2026-02-01', 180));
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), rows, { endDate: '2026-02-01' });

  assert.equal(built.baseDate, '2025-12-30');
  assert.equal(built.dataComponents[0].basePrice, 120);
  assert.equal(built.componentPoints[0].componentIndexValue, 100);
  assert.ok(Math.abs(built.componentPoints.at(-1).componentIndexValue - 120) < 0.001);
  assertEqualWeightedMarketIndex(built);
});

test('does not fill a launch baseline with sparse trades from later months', () => {
  const rows = [
    row(1, '2025-01-01', 100),
    row(1, '2025-01-15', 110),
    row(1, '2025-03-01', 200),
    row(1, '2025-04-01', 220),
    row(1, '2025-05-01', 240)
  ];
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), rows, { endDate: '2025-06-01' });

  assert.deepEqual(built.dataComponents, []);
  assert.equal(built.excludedComponents.length, 1);
  assert.equal(built.excludedComponents[0].observationCount, 2);
  assert.equal(built.excludedComponents[0].reason, 'insufficient-initial-formation-data');
});

test('does not accept high same-day volume without independent trading days', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), [
    { ...row(1, '2025-01-01', 100), trade_count: 20 },
    row(1, '2025-02-15', 120)
  ], { endDate: '2025-03-01' });

  assert.deepEqual(built.dataComponents, []);
  assert.equal(built.excludedComponents[0].observationCount, 1);
  assert.equal(built.excludedComponents[0].tradeCount, 20);
});

test('waits for the full formation window even when minimum trades arrive early', () => {
  const rows = [
    { ...row(1, '2025-01-01', 100), trade_count: 2 },
    { ...row(1, '2025-01-02', 110), trade_count: 2 },
    { ...row(1, '2025-01-03', 120), trade_count: 1 }
  ];
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), rows, { endDate: '2025-01-20' });

  assert.deepEqual(built.dataComponents, []);
  assert.equal(built.excludedComponents[0].reason, 'initial-formation-window-open');
});

test('does not rewrite a closed formation baseline when later trades arrive', () => {
  const initial = [
    { date: '2025-01-01', price: 100, tradeCount: 2 },
    { date: '2025-01-05', price: 110, tradeCount: 2 },
    { date: '2025-01-10', price: 120, tradeCount: 1 }
  ];
  const before = buildInitialPriceFormationSeries(initial, { endDate: '2025-02-01' });
  const after = buildInitialPriceFormationSeries([
    ...initial,
    { date: '2025-02-15', price: 200, tradeCount: 3 }
  ], { endDate: '2025-03-01' });

  assert.equal(before.baselineDate, '2025-01-30');
  assert.equal(before.baselinePrice, 110);
  assert.equal(after.baselineDate, before.baselineDate);
  assert.equal(after.baselinePrice, before.baselinePrice);
});

test('stops the index at the latest observed trading day by default', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), [
    { ...row(1, '2025-01-01', 100), trade_count: 2 },
    { ...row(1, '2025-01-05', 110), trade_count: 2 },
    { ...row(1, '2025-01-10', 120), trade_count: 1 },
    row(1, '2025-02-15', 150)
  ]);

  assert.equal(built.endDate, '2025-02-15');
  assert.equal(built.indexPoints.at(-1).date, '2025-02-15');
  assertEqualWeightedMarketIndex(built);
});
