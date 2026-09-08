import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const names = ['formatYen', 'formatWonFromYen', 'formatUsd', 'formatMarketPrimaryPrice', 'RenewMarketMoney', 'getLocaleText', 'medianMarketNumber', 'aggregateMarketDailyChartPoints', 'RenewMarketChart'];
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
  const inputs = { selectedLatest: undefined, selected: { minPrice: 100 }, MARKET_USD_TO_JPY: 155 };
  assert.equal(vm.runInNewContext(expression, { ...inputs, normalizedCondition: 'psa10' }), 0);
  assert.equal(vm.runInNewContext(expression, { ...inputs, normalizedCondition: 'a' }), 15500);
});
