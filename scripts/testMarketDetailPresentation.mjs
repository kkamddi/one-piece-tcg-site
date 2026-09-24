import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const names = ['formatYen', 'formatWonFromYen', 'formatUsd', 'formatMarketPrimaryPrice', 'RenewMarketMoney', 'getLocaleText', 'medianMarketNumber', 'aggregateMarketDailyChartPoints', 'getLatestMarketDailyPoint', 'getTradeQuotePoint', 'RenewMarketChart'];
const functions = names.map(name => {
  const node = ast.program.body.find(node => node.id?.name === name);
  assert.ok(node, name);
  return source.slice(node.start, node.end);
}).join('\n');
const { code } = await transform(functions, { loader: 'jsx' });
const context = vm.createContext({
  MARKET_USD_TO_JPY: 155,
  React: { createElement: (type, props, ...children) => ({ type, props, children }) },
  useState: value => [value, () => {}],
  useEffect: () => {},
  getUiText: (_lang, key) => key,
  formatMarketDate: value => String(value),
  formatChartAxisDate: value => String(value),
  getLocalizedCurrencyText: value => String(value)
});
vm.runInContext(code, context);

test('primary money respects locale and does not turn missing prices into zero', () => {
  assert.equal(context.formatMarketPrimaryPrice(1000, 'KR'), '\u20a99,400');
  assert.equal(context.formatMarketPrimaryPrice(1550, 'EN'), 'US $10');
  assert.equal(context.formatMarketPrimaryPrice(1000, 'JP'), '\u00a51,000');
  for (const value of [0, -1, NaN, Infinity, undefined]) assert.equal(context.formatMarketPrimaryPrice(value, 'KR'), '-');
});

test('empty and synthetic-only chart data remain an empty state', () => {
  for (const points of [[], [{ timestamp: 1700000000000, price: 100, synthetic: true }]]) {
    const result = context.RenewMarketChart({ points, uiLang: 'EN', range: '7d' });
    assert.equal(result.props.className, 'renew-chart-placeholder');
  }
});

test('one recorded day keeps the chart with a centered median point and no invented trend', () => {
  const points = [100, 300, 200].map(price => ({ timestamp: 1700000000000, price }));
  const result = context.RenewMarketChart({ points, uiLang: 'EN', range: '7d' });
  assert.equal(result.props.className, 'renew-market-chart-box');
  const nodes = [];
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    visit(node.children);
  };
  visit(result);
  const hits = nodes.filter(node => node.props?.className === 'renew-chart-hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].props.cx, 460);
  assert.ok(hits[0].props['aria-label'].endsWith(' 200'));
  assert.equal(nodes.filter(node => node.type === 'path').length, 0);
});

test('two recorded days still render the interactive chart', () => {
  const points = [100, 200].map((price, index) => ({ timestamp: 1700000000000 + index * 86400000, price }));
  const result = context.RenewMarketChart({ points, uiLang: 'KR', range: '7d' });
  assert.equal(result.props.className, 'renew-market-chart-box');
});

test('missing PSA10 price never falls back to the ungraded candidate price', () => {
  const market = ast.program.body.find(node => node.id?.name === 'RenewMarket');
  const price = market.body.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'currentPriceJpy').init;
  const expression = source.slice(price.start, price.end);
  const inputs = { latestDailyPoint: null, selectedLatest: { price: 28210 }, selected: { minPrice: 100 }, MARKET_USD_TO_JPY: 155 };
  assert.equal(vm.runInNewContext(expression, { ...inputs, normalizedCondition: 'psa10' }), 0);
  assert.equal(vm.runInNewContext(expression, { ...inputs, normalizedCondition: 'a' }), 0);
  assert.equal(vm.runInNewContext(expression, { ...inputs, latestDailyPoint: { price: 25011 } }), 25011);
});

test('headline uses latest daily median independent of selected chart range', () => {
  const timestamp = Date.parse('2026-09-24T03:00:00Z');
  const points = [24000, 25011, 28000].map(price => ({ timestamp, price }));
  const series = { all: [{ timestamp: timestamp - 86400000, price: 99999 }, ...points], '7d': points };
  assert.equal(context.getLatestMarketDailyPoint(series).price, 25011);
  assert.equal(context.getLatestMarketDailyPoint({ ...series, '7d': [] }).price, 25011);
  assert.equal(context.getLatestMarketDailyPoint({ all: [], '1y': points }).price, 25011);
  assert.equal(context.getLatestMarketDailyPoint({ all: [{ timestamp, price: 123, synthetic: true }] }), null);
  assert.equal(context.getLatestMarketDailyPoint({}), null);
});

test('headline uses the shared quote and its condition-specific trading date', () => {
  const detail = { tradeQuote: { psa10PriceJpy: 25011, psa10TradeDate: '2026-09-24' }, latestByCondition: { a: { price: 999 } } };
  assert.equal(context.getTradeQuotePoint(detail, 'psa10').price, 25011);
  assert.equal(context.getTradeQuotePoint(detail, 'a'), null);
  assert.equal(context.getTradeQuotePoint({}, 'psa10'), null);
});
