import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInitialPriceFormationSeries,
  buildEqualWeightedMarketIndex
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
  assert.deepEqual(admissionDatePoints.map((point) => point.componentIndexValue), [200, 100]);
  assert.deepEqual(built.dataComponents.map((component) => 100 * component.series[0].price / component.basePrice), [100, 100]);
  assertEqualWeightedMarketIndex(built);
});

test('includes a new component at 100 in the equal-weight sector average', () => {
  const built = build([{ apparelId: 1 }, { apparelId: 2 }], [
    row(1, '2025-01-01', 100),
    row(1, '2025-01-02', 120),
    row(2, '2025-01-02', 50),
    row(2, '2025-01-03', 55)
  ]);

  assert.equal(built.indexPoints.find((point) => point.date === '2025-01-01').value, 100);
  assert.equal(built.indexPoints.find((point) => point.date === '2025-01-02').value, 110);
  assert.equal(built.indexPoints.find((point) => point.date === '2025-01-03').value, 115);
  assert.equal(built.admissions[0].valueBeforeAdmission, 120);
  assert.equal(built.admissions[0].valueAfterAdmission, 110);
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

test('independent audit rejects a sector value that does not match the component arithmetic mean', () => {
  const built = build([{ apparelId: 1 }], [row(1, '2025-01-01', 100)]);
  built.indexPoints[0].value = 150;
  const audit = auditEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, false);
  assert.equal(audit.indexFormulaViolations.length, 1);
});

test('independent audit allows the arithmetic mean to change when a component is admitted', () => {
  const built = build([{ apparelId: 1 }, { apparelId: 2 }], [
    row(1, '2025-01-01', 100),
    row(2, '2025-01-02', 100)
  ]);
  const audit = auditEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, true);
  assert.equal(built.admissions[0].valueBeforeAdmission, 100);
  assert.equal(built.admissions[0].valueAfterAdmission, 100);
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

test('uses the median of the first three actual trading-day medians', () => {
  const prices = [247489, 91262, 97964, 103120, 103120, 128901];
  const dates = ['2025-12-14', '2025-12-15', '2025-12-18', '2025-12-22', '2025-12-23', '2025-12-24'];
  const series = prices.map((price, index) => ({
    date: dates[index],
    price
  }));
  const baseline = buildInitialPriceFormationSeries(series, { endDate: '2026-07-16' });

  assert.equal(baseline.firstObservedPrice, 247489);
  assert.equal(baseline.baselinePrice, 97964);
  assert.equal(baseline.baselineDate, '2025-12-18');
  assert.deepEqual(baseline.series.map(({ date, price }) => ({ date, price })), [
    { date: '2025-12-18', price: 97964 },
    { date: '2025-12-22', price: 103120 },
    { date: '2025-12-23', price: 103120 },
    { date: '2025-12-24', price: 128901 }
  ]);
});

test('uses the source first-three median for the baseline and filters the later path separately', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 728159 }]), [
    row(728159, '2025-12-14', 247489),
    row(728159, '2025-12-15', 91262),
    row(728159, '2025-12-18', 97964),
    row(728159, '2025-12-22', 103120),
    row(728159, '2025-12-23', 103120)
  ]);

  const component = built.dataComponents[0];
  assert.equal(component.sourceFirstObservedPrice, 247489);
  assert.equal(component.acceptedFirstObservedPrice, 91262);
  assert.equal(component.basePrice, 97964);
  assert.equal(component.firstDate, '2025-12-18');
  assert.equal(component.ignoredObservationCount, 1);
});

test('preserves a supported launch premium when the market drops on the third trading day', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 822600 }]), [
    { ...row(822600, '2026-06-15', 1285536), trade_count: 1 },
    { ...row(822600, '2026-06-17', 1209310), trade_count: 3 },
    { ...row(822600, '2026-06-18', 431365), trade_count: 1 },
    { ...row(822600, '2026-06-28', 488870), trade_count: 3 },
    { ...row(822600, '2026-06-29', 517545), trade_count: 3 }
  ]);

  const component = built.dataComponents[0];
  assert.equal(component.basePrice, 1209310);
  assert.equal(component.firstDate, '2026-06-18');
  assert.ok(built.componentPoints.at(-1).componentIndexValue < 50);
});

test('admits a component when the third actual trading day confirms the baseline', () => {
  const rows = [100, 110, 120, 130, 140].map((price, index) => ({
    ...row(1, `2025-12-${String(index + 1).padStart(2, '0')}`, price),
    trade_count: 1
  }));
  rows.push(row(1, '2026-02-01', 180));
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), rows, { endDate: '2026-02-01' });

  assert.equal(built.baseDate, '2025-12-03');
  assert.equal(built.dataComponents[0].basePrice, 110);
  assert.equal(built.componentPoints[0].componentIndexValue, 100);
  assert.ok(Math.abs(built.componentPoints.at(-1).componentIndexValue - 163.6364) < 0.001);
  assertEqualWeightedMarketIndex(built);
});

test('does not form a baseline without three actual trading days', () => {
  const rows = [
    row(1, '2025-01-01', 100),
    row(1, '2025-01-15', 400)
  ];
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), rows, { endDate: '2025-06-01' });

  assert.deepEqual(built.dataComponents, []);
  assert.equal(built.excludedComponents.length, 1);
  assert.equal(built.excludedComponents[0].sourceObservationCount, 2);
  assert.equal(built.excludedComponents[0].observationCount, 2);
  assert.equal(built.excludedComponents[0].reason, 'insufficient-initial-trading-days');
});

test('does not accept high same-day volume without independent trading days', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), [
    { ...row(1, '2025-01-01', 100), trade_count: 20 },
    row(1, '2025-02-15', 120)
  ], { endDate: '2025-03-01' });

  assert.deepEqual(built.dataComponents, []);
  assert.equal(built.excludedComponents[0].observationCount, 2);
  assert.equal(built.excludedComponents[0].tradeCount, 21);
});

test('does not wait for a fixed calendar window after three stable trading days', () => {
  const rows = [
    { ...row(1, '2025-01-01', 100), trade_count: 2 },
    { ...row(1, '2025-01-02', 110), trade_count: 2 },
    { ...row(1, '2025-01-03', 120), trade_count: 1 }
  ];
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), rows, { endDate: '2025-01-20' });

  assert.equal(built.baseDate, '2025-01-03');
  assert.equal(built.dataComponents[0].basePrice, 110);
});

test('does not rewrite a confirmed first-three-day baseline when later trades arrive', () => {
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

  assert.equal(before.baselineDate, '2025-01-10');
  assert.equal(before.baselinePrice, 110);
  assert.equal(after.baselineDate, before.baselineDate);
  assert.equal(after.baselinePrice, before.baselinePrice);
});

test('preserves a real sustained move larger than twenty percent', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), [
    row(1, '2025-01-01', 100),
    row(1, '2025-01-02', 105),
    row(1, '2025-01-03', 110),
    row(1, '2025-01-04', 60),
    row(1, '2025-01-05', 58),
    row(1, '2025-01-06', 62)
  ]);

  const transition = built.componentPoints.find((point) => point.date === '2025-01-04');
  assert.equal(transition.price, 60);
  assert.ok(transition.componentIndexValue < 60);
  assertEqualWeightedMarketIndex(built);
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
