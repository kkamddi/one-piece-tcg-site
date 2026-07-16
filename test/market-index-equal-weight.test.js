import test from 'node:test';
import assert from 'node:assert/strict';

import {
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

test('starts the sector at 100 on the earliest component first-trade date', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }, { apparelId: 2 }]), [
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
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }, { apparelId: 2 }]), [
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
  const before = buildEqualWeightedMarketIndex(config(components), initialRows, { endDate: '2025-01-05' });
  const after = buildEqualWeightedMarketIndex(config(components), [
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
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }]), [row(1, '2025-01-01', 100)]);
  built.indexPoints[0].value = 150;
  const audit = auditEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, false);
  assert.equal(audit.indexFormulaViolations.length, 1);
});

test('independent audit rejects an admission jump', () => {
  const built = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }, { apparelId: 2 }]), [
    row(1, '2025-01-01', 100),
    row(2, '2025-01-02', 100)
  ]);
  built.admissions[0].valueAfterAdmission += 1;
  const audit = auditEqualWeightedMarketIndex(built);
  assert.equal(audit.valid, false);
  assert.equal(audit.admissionViolations.length, 1);
});

test('accepts an intentionally empty sector without creating fake points', () => {
  const built = buildEqualWeightedMarketIndex(config([]), []);
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
  const first = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }, { apparelId: 2 }]), rows);
  const second = buildEqualWeightedMarketIndex(config([{ apparelId: 1 }, { apparelId: 2 }]), rows);
  assert.deepEqual(second, first);
});
