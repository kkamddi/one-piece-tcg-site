import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPortfolio } from '../src/portfolio-model.js';

const rates = { krwPerJpy: 9.4, jpyPerUsd: 155 };
test('dashboard renders the corrected original-currency cost and both consumers pass the shared rates', async () => {
  const { build } = await import('esbuild');
  const { createRequire } = await import('node:module');
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const compiled = await build({ entryPoints: ['src/PortfolioDashboard.jsx'], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env.DEV': 'false' } });
  const context = { module: { exports: {} }, require: createRequire(import.meta.url) };
  runInNewContext(compiled.outputFiles[0].text, context);
  const model = buildPortfolio([{ id: 'test', code: 'TEST-001', apparelId: 1, purchases: [
    { mode: 'manual', quantity: 1, originalCurrency: 'KRW', originalUnitPrice: 1000, unitPriceJpy: 106 }
  ] }], [{ apparelId: 1, aPriceJpy: 200 }], rates);
  const html = renderToStaticMarkup(React.createElement(context.module.exports.default, {
    model, signedIn: true, money: n => `₩${Math.round(n * rates.krwPerJpy).toLocaleString('ko-KR')}`,
    displayName: card => card.code, imageSrc: () => '/card-placeholder.svg', resolveImages: async () => [], t: ko => ko
  }));
  assert.ok(html.includes('₩1,000'));
  assert.ok(!html.includes('₩996'));
  assert.ok(html.includes('₩880'));
  const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.equal(source.match(/usePortfolioValuation\(portfolioHoldings, PORTFOLIO_RATES\)/g)?.length, 2);
});

test('original KRW amount survives cost, average, purchase display and profit calculations', () => {
  const holding = { id: 'krw', apparelId: 1, purchases: [{ mode: 'manual', quantity: 2, originalCurrency: 'KRW', originalUnitPrice: 1000, unitPriceJpy: 106 }] };
  const before = JSON.stringify(holding);
  const model = buildPortfolio([holding], [{ apparelId: 1, aPriceJpy: 200 }], rates);
  assert.equal(Math.round(model.costJpy * rates.krwPerJpy), 2000);
  assert.equal(Math.round(model.cards[0].costJpy / model.cards[0].pricedQuantity * rates.krwPerJpy), 1000);
  assert.equal(Math.round(model.cards[0].lots[0].unitPriceJpy * 2 * rates.krwPerJpy), 2000);
  assert.equal(Math.round(model.profitJpy * rates.krwPerJpy), 1760);
  assert.equal(JSON.stringify(holding), before);
});

test('small KRW amounts do not become unpriced after integer-JPY storage rounding', () => {
  const model = buildPortfolio([{ apparelId: 1, purchases: [{ mode: 'manual', quantity: 1, originalCurrency: 'KRW', originalUnitPrice: 1, unitPriceJpy: 0 }] }], [], rates);
  assert.equal(model.missingCostQuantity, 0);
  assert.equal(Math.round(model.costJpy * rates.krwPerJpy), 1);
  assert.equal(model.profitJpy, null);
});

test('mixed currencies preserve cents and original JPY without rounding intermediate costs', () => {
  const model = buildPortfolio([{ apparelId: 1, purchases: [
    { mode: 'manual', quantity: 1, originalCurrency: 'USD', originalUnitPrice: 1.01, unitPriceJpy: 157 },
    { mode: 'estimate', quantity: 2, originalCurrency: 'JPY', originalUnitPrice: 100.5, unitPriceJpy: 101 }
  ] }], [], rates);
  assert.ok(Math.abs(model.costJpy - (1.01 * 155 + 201)) < 1e-9);
  assert.equal(model.cards[0].estimated, true);
});

test('legacy, unavailable rates and invalid amounts use finite stored costs', () => {
  for (const lot of [
    { originalCurrency: 'KRW', originalUnitPrice: 1000 },
    { originalCurrency: 'UNKNOWN', originalUnitPrice: 1000 },
    { originalCurrency: 'JPY', originalUnitPrice: Infinity },
    { originalCurrency: 'JPY', originalUnitPrice: -1 }
  ]) {
    const model = buildPortfolio([{ purchases: [{ mode: 'manual', quantity: 1, unitPriceJpy: 106, ...lot }] }]);
    assert.equal(model.costJpy, 106);
  }
  assert.equal(buildPortfolio([{ purchases: [{ unitPriceJpy: Infinity }] }]).costJpy, 0);
});

test('legacy holdings retain one unit without inventing a purchase cost', () => {
  const model = buildPortfolio([{ id: 'legacy', apparelId: 1 }], [{ apparelId: 1, aPriceJpy: 250 }]);
  assert.equal(model.quantity, 1);
  assert.equal(model.totalJpy, 250);
  assert.equal(model.profitJpy, null);
  assert.equal(model.missingCostQuantity, 1);
});
test('return only includes quantities with both cost and a current quote', () => {
  const model = buildPortfolio([
    { id: 'single', apparelId: 1, purchases: [{ quantity: 2, unitPriceJpy: 100 }, { quantity: 1, mode: 'later' }] },
    { id: 'missing', apparelId: 2, purchases: [{ quantity: 1, unitPriceJpy: 900 }] },
    { id: 'psa', apparelId: 1, grade: 'psa10', purchases: [{ quantity: 1, unitPriceJpy: 500, mode: 'estimate' }] }
  ], [{ apparelId: 1, aPriceJpy: 150, psa10PriceJpy: 400 }]);
  assert.equal(model.totalJpy, 850);
  assert.equal(model.costJpy, 1600);
  assert.equal(model.comparableCostJpy, 700);
  assert.equal(model.profitJpy, 0);
  assert.equal(model.returnPercent, 0);
  assert.equal(model.missingQuotes, 1);
  assert.equal(model.missingCostQuantity, 1);
  assert.equal(model.cards[1].profitJpy, null);
  assert.equal(model.cards[2].estimated, true);
});
test('empty portfolios and invalid quotes do not manufacture losses', () => {
  assert.equal(buildPortfolio().quantity, 0);
  for (const price of [0, -10, null, 'bad', Infinity]) {
    const model = buildPortfolio([{ id: 'card', apparelId: 1, purchases: [{ quantity: 1, unitPriceJpy: 100 }] }], [{ apparelId: 1, aPriceJpy: price }]);
    assert.equal(model.cards[0].price, null);
    assert.equal(model.profitJpy, null);
  }
});
