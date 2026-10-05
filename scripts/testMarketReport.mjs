import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyMarketReport, getMarketReportEditorial, getReportWeek, weeklyReportSql } from '../lib/market-report.js';

test('reports cover the last full Monday-Sunday week in KST', () => {
  assert.deepEqual(getReportWeek('2026-10-06'), { weekStart: '2026-09-28', weekEnd: '2026-10-04', prevStart: '2026-09-21', prevEnd: '2026-09-27' });
  assert.equal(getReportWeek('2026-10-05').weekEnd, '2026-10-04');
  assert.equal(getReportWeek('2026-10-04').weekEnd, '2026-09-27', 'a Sunday is not a finished week yet');
  assert.throws(() => weeklyReportSql({ weekStart: "2026-09-28'; drop", weekEnd: '2026-10-04', prevStart: '2026-09-21' }));
});

const week = getReportWeek('2026-10-06');
const products = new Map([
  [1, { code: 'OP01-120', label: '샹크스 OP01-120', set: 'OP01', imageUrl: '' }],
  [2, { code: 'OP05-119', label: '루피 OP05-119', set: 'OP05', imageUrl: '' }],
  [3, { code: 'P-001', label: '루피 P-001', set: '프로모·기타', imageUrl: '' }]
]);
const row = (id, condition, trades, price, prevTrades, prevPrice) => ({
  apparel_id: id, condition_key: condition, trades, price_weight: trades * price, prev_trades: prevTrades, prev_price_weight: prevTrades * prevPrice
});

test('weekly prices are trade-weighted and movers need trades in both weeks', () => {
  const report = buildWeeklyMarketReport({
    week,
    rows: [row(1, 'psa10', 4, 120000, 3, 100000), row(2, 'psa10', 5, 45000, 2, 50000), row(3, 'psa10', 9, 20000, 1, 10000), row(99, 'psa10', 7, 5000, 7, 5000)],
    products,
    generatedAt: '2026-10-06T03:00:00Z'
  });
  assert.equal(report.id, '2026-10-04');
  assert.equal(report.totals.psa10.trades, 25, 'totals include products without catalog labels');
  assert.deepEqual(report.movers.psa10.gainers.map((item) => [item.code, item.change]), [['OP01-120', 20]]);
  assert.deepEqual(report.movers.psa10.losers.map((item) => [item.code, item.change]), [['OP05-119', -10]]);
  assert.equal(report.mostTraded.psa10[0].code, 'P-001', 'single prior trade still counts for volume');
  assert.deepEqual(report.series.map((entry) => entry.set), ['프로모·기타', 'OP05', 'OP01']);
});

test('box prices compare with the previous report snapshot', () => {
  const boxes = [{ apparelId: 10, code: 'OP-16', name: 'OP-16 Box' }];
  const first = buildWeeklyMarketReport({ week, rows: [], products, boxes, boxPrices: { 10: { minPrice: 60, priceCurrency: 'USD' } } });
  assert.equal(first.boxes[0].price, 9300);
  assert.equal(first.boxes[0].change, null);
  const next = buildWeeklyMarketReport({ week, rows: [], products, boxes, boxPrices: { 10: { minPrice: 66, priceCurrency: 'USD' } }, previousBoxSnapshot: first.boxSnapshot });
  assert.equal(next.boxes[0].change, 10);
});

test('the editorial view carries summary, tables and the method note', () => {
  const report = buildWeeklyMarketReport({ week, rows: [row(1, 'psa10', 4, 120000, 3, 100000), row(2, 'a', 3, 3000, 2, 2000)], products });
  const editorial = getMarketReportEditorial(report);
  assert.equal(editorial.heading, '원피스카드 주간 시세 리포트 (9월 28일~10월 4일)');
  assert.ok(editorial.summary.some((stat) => stat.label.startsWith('PSA10 거래')));
  assert.ok(editorial.sections.some((section) => section.heading === 'PSA10 상승 TOP 10' && section.table.rows[0][0] === '샹크스 OP01-120'));
  assert.ok(editorial.sections.at(-1).paragraphs[0].includes('가중 평균'));
  report.notes = ['이번 주는 프로모 거래가 많았습니다.'];
  assert.equal(getMarketReportEditorial(report).sections[0].heading, '편집자 코멘트');
});
