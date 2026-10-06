import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildWeeklyMarketReport, getMarketReportEditorial, getMarketReportKpis, getMarketReportSummary, getReportWeek, weeklyReportSql } from '../lib/market-report.js';

test('reports cover the last full Monday-Sunday week in KST', () => {
  assert.deepEqual(getReportWeek('2026-10-06'), { weekStart: '2026-09-28', weekEnd: '2026-10-04', prevStart: '2026-09-21', prevEnd: '2026-09-27' });
  assert.equal(getReportWeek('2026-10-05').weekEnd, '2026-10-04');
  assert.equal(getReportWeek('2026-10-04').weekEnd, '2026-09-27', 'a Sunday is not a finished week yet');
  assert.throws(() => weeklyReportSql({ weekStart: "2026-09-28'; drop", weekEnd: '2026-10-04', prevStart: '2026-09-21' }));
  assert.equal(weeklyReportSql(getReportWeek('2026-10-06')).match(/;\s*select/g).length, 1, 'product and daily statements');
});

const week = getReportWeek('2026-10-06');
const products = new Map([
  [1, { code: 'OP01-120', label: '샹크스 OP01-120', set: 'OP01', imageUrl: 'https://img/1', cardId: 'JP::OP01-120', locale: 'JP' }],
  [2, { code: 'OP05-119', label: '루피 OP05-119', set: 'OP05', imageUrl: '' }],
  [3, { code: 'P-001', label: '루피 P-001', set: '프로모·기타', imageUrl: '' }]
]);
const row = (id, condition, trades, price, prevTrades, prevPrice) => ({
  apparel_id: id, condition_key: condition, trades, price_weight: trades * price, prev_trades: prevTrades, prev_price_weight: prevTrades * prevPrice
});
const rows = [row(1, 'psa10', 4, 120000, 3, 100000), row(2, 'psa10', 5, 45000, 2, 50000), row(3, 'psa10', 9, 20000, 1, 10000), row(99, 'psa10', 7, 5000, 7, 5000)];

test('weekly prices are trade-weighted and movers need trades in both weeks', () => {
  const report = buildWeeklyMarketReport({ week, rows, products, generatedAt: '2026-10-06T03:00:00Z' });
  assert.equal(report.id, '2026-10-04');
  assert.equal(report.totals.psa10.trades, 25, 'totals include products without catalog labels');
  assert.equal(report.totals.psa10.value, 4 * 120000 + 5 * 45000 + 9 * 20000 + 7 * 5000);
  assert.deepEqual(report.movers.psa10.gainers.map((item) => [item.code, item.change, item.cardId]), [['OP01-120', 20, 'JP::OP01-120']]);
  assert.deepEqual(report.movers.psa10.losers.map((item) => [item.code, item.change]), [['OP05-119', -10]]);
  assert.equal(report.mostTraded.psa10[0].code, 'P-001', 'single prior trade still counts for volume');
  assert.deepEqual(report.topPrice.map((item) => item.code), ['OP01-120', 'OP05-119', 'P-001']);
  assert.deepEqual(report.series.map((entry) => entry.set), ['프로모·기타', 'OP05', 'OP01']);
});

test('daily totals fill all fourteen days for the chart', () => {
  const report = buildWeeklyMarketReport({ week, rows, products, dailyRows: [
    { point_date: '2026-09-21', condition_key: 'psa10', trades: 5 },
    { point_date: '2026-10-04', condition_key: 'a', trades: 3 }
  ] });
  assert.equal(report.daily.length, 14);
  assert.deepEqual(report.daily[0], { date: '2026-09-21', psa10: 5, a: 0 });
  assert.deepEqual(report.daily[13], { date: '2026-10-04', psa10: 0, a: 3 });
});

test('box prices compare with the previous report snapshot', () => {
  const boxes = [{ apparelId: 10, code: 'OP-16', name: 'OP-16 Box', previewImageUrl: 'https://box' }];
  const first = buildWeeklyMarketReport({ week, rows: [], products, boxes, boxPrices: { 10: { minPrice: 60, priceCurrency: 'USD' } } });
  assert.deepEqual([first.boxes[0].price, first.boxes[0].change, first.boxes[0].imageUrl], [9300, null, 'https://box']);
  const next = buildWeeklyMarketReport({ week, rows: [], products, boxes, boxPrices: { 10: { minPrice: 66, priceCurrency: 'USD' } }, previousBoxSnapshot: first.boxSnapshot });
  assert.equal(next.boxes[0].change, 10);
});

test('the home summary stays small and the text view keeps the method note', () => {
  const report = buildWeeklyMarketReport({ week, rows, products });
  const summary = getMarketReportSummary(report);
  assert.deepEqual(Object.keys(summary).sort(), ['gainers', 'id', 'kpis', 'krwPerJpy', 'losers', 'title', 'weekEnd', 'weekStart']);
  assert.equal(summary.kpis.length, 3);
  assert.equal(getMarketReportKpis(report)[0].change, pct(25, 13));
  const editorial = getMarketReportEditorial(report);
  assert.equal(editorial.heading, '원피스카드 주간 시세 리포트 (9월 28일~10월 4일)');
  assert.ok(editorial.sections.some((section) => section.heading === 'PSA10 상승 TOP 10' && section.table.rows[0][0] === '샹크스 OP01-120'));
  assert.ok(editorial.sections.at(-1).paragraphs[0].includes('가중 평균'));
  report.notes = ['이번 주는 프로모 거래가 많았습니다.'];
  assert.equal(getMarketReportEditorial(report).sections[0].heading, '편집자 코멘트');
});

function pct(current, previous) {
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

test('the report is its own page and replaces the daily movers on the Korean home', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /marketReport: '\/market-report',/);
  assert.match(app, /if \(path\.startsWith\(`\$\{MARKET_REPORT_PATH\}\/`\)\) return 'marketReport';/);
  assert.match(app, /const showReportCard = !isJp && MARKET_REPORT_INDEX\.length > 0;/);
  assert.match(app, /showReportCard && reportSummary \? <RenewHomeMarketReport /);
  assert.doesNotMatch(app, /\/guide\/market-report/);
});
