import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build, transform } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findSealedBox, sealedBoxes, boxSeries, boxQuote, BOX_QUOTE_MAX_AGE_MS } from '../src/box-portfolio.js';
import { buildPortfolio } from '../src/portfolio-model.js';
import { confirmedCardShows, cardShowEvents } from '../src/data/card-show-events.js';
import boxItems from '../src/data/box-market-items.js';

const box = findSealedBox(136031);
const now = Date.parse('2026-09-29T00:00:00Z');
const rates = { krwPerJpy: 10, jpyPerUsd: 150 };
const snapshot = (currency, amount, age = 0) => ({ updatedAt: new Date(now - age).toISOString(),
  items: { [box.apparelId]: { priceCurrency: currency, minPrice: amount } } });

test('only booster boxes qualify; packs, decks, sets and DON cards do not', () => {
  assert.ok(box);
  for (const id of [93992, 847160, 710533, 871079, 999]) assert.equal(findSealedBox(id), null);
  assert.equal(boxSeries(box), 'OP');
  assert.equal(boxSeries(findSealedBox(864495)), 'OP');
  assert.equal(boxSeries(findSealedBox(165849)), 'EB');
  assert.equal(boxSeries(findSealedBox(216885)), 'PRB');
  assert.equal(new Set(sealedBoxes.map(item => item.apparelId)).size, sealedBoxes.length);
});

test('box quote currency, freshness and missing values are conservative', () => {
  for (const [currency, amount, expected] of [['USD', 10, 1500], ['JPY', 1500, 1500], ['KRW', 15000, 1500]]) {
    assert.equal(boxQuote(box, snapshot(currency, amount), rates, now).boxPriceJpy, expected);
  }
  for (const point of [snapshot('USD', 10, BOX_QUOTE_MAX_AGE_MS + 1), snapshot('USD', 10, -1),
    snapshot('EUR', 10), snapshot('USD', 0), snapshot('USD', -10), {}, { updatedAt: 'bad' }]) {
    assert.equal(boxQuote(box, point, rates, now).boxPriceJpy, null);
  }
  assert.equal(boxQuote(box, snapshot('USD', 10), {}, now).boxPriceJpy, null);
});

test('box and card valuations never share an apparel-ID quote; missing boxes retain cost', () => {
  const holding = { ...box, id: 'box', assetType: 'box', grade: 'a', purchases: [{ mode: 'manual', quantity: 2, originalCurrency: 'JPY', originalUnitPrice: 1000 }] };
  const missing = buildPortfolio([holding], [{ apparelId: box.apparelId, aPriceJpy: 99999 }], rates);
  assert.equal(missing.totalJpy, 0);
  assert.equal(missing.costJpy, 2000);
  assert.equal(missing.cards[0].valueJpy, null);
  assert.equal(missing.profitJpy, null);
  const model = buildPortfolio([holding], [boxQuote(box, snapshot('USD', 10), rates, now)], rates);
  assert.equal(model.totalJpy, 3000);
  assert.equal(model.profitJpy, 1000);
});

test('calendar includes sourced confirmed shows only, not guesses, cancelled events or invalid dates', () => {
  assert.ok(confirmedCardShows().length);
  const event = cardShowEvents[0];
  for (const patch of [{ status: 'cancelled' }, { status: 'tentative' }, { url: '' }, { verifiedAt: '' },
    { date: '2026-02-30' }, { endDate: '2026-01-01' }, { venue: '' }]) {
    assert.equal(confirmedCardShows([{ ...event, ...patch }]).length, 0);
  }
  assert.equal(confirmedCardShows()[0].kind, 'cardshow');
});

test('changed JSX compiles and portfolio renders box labels, units and unknown-price warning', async () => {
  for (const file of ['src/RenewApp.jsx', 'src/PortfolioDashboard.jsx']) {
    await transform(await readFile(file, 'utf8'), { loader: 'jsx' });
  }
  const compiled = await build({ entryPoints: ['src/PortfolioDashboard.jsx'], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env.DEV': 'false' } });
  const context = { module: { exports: {} }, require: createRequire(import.meta.url) };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  const model = buildPortfolio([{ ...box, id: 'box', assetType: 'box', purchases: [{ quantity: 2 }] }]);
  const html = renderToStaticMarkup(React.createElement(context.module.exports.default, {
    model, signedIn: true, money: n => String(n), displayName: item => item.name,
    imageSrc: () => '/card-placeholder.svg', resolveImages: async () => [], t: ko => ko
  }));
  assert.match(html, /미개봉 박스/);
  assert.match(html, /2박스/);
  assert.match(html, /시세 미확인 1종/);
});

test('real box gallery renders filters and adds only a selected sealed box', async () => {
  const source = await readFile('src/RenewApp.jsx', 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const node = ast.program.body.find(item => item.type === 'FunctionDeclaration' && item.id.name === 'RenewBoxMarket');
  const compiled = await transform(source.slice(node.start, node.end), { loader: 'jsx' });
  let cursor = 0;
  const states = [];
  const context = {
    React, findSealedBox, boxSeries, BOX_QUOTE_MAX_AGE_MS,
    resolvedBoxMarketItems: boxItems, boxMarketPrices: { updatedAt: '2026-09-08' },
    getUiText: (_locale, key) => key, getLocaleText: (_locale, ko) => ko,
    getAppHistoryState: () => ({}), getBoxReleaseSortValue: () => 0,
    formatBoxMarketPrice: () => '', placeholderImage: () => {}, BOX_MARKET_PAGE_SIZE: 100,
    useState: initial => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useMemo: fn => fn(), useEffect: () => {}, useRef: value => ({ current: value })
  };
  vm.runInNewContext(compiled.code, context);
  let added;
  const render = () => { cursor = 0; return context.RenewBoxMarket({ uiLang: 'KR', onAddBox: item => { added = item; } }); };
  const all = element => !element || typeof element !== 'object' ? []
    : [element, ...React.Children.toArray(element.props?.children).flatMap(all)];
  let elements = all(render());
  assert.equal(elements.filter(item => item.props?.className === 'renew-box-portfolio-add').length, sealedBoxes.length);
  elements.find(item => item.type === 'button' && item.props.children === '엑스트라').props.onClick();
  elements = all(render());
  const additions = elements.filter(item => item.props?.className === 'renew-box-portfolio-add');
  assert.equal(additions.length, sealedBoxes.filter(item => boxSeries(item) === 'EB').length);
  additions[0].props.onClick();
  assert.equal(added.assetType, 'box');
  assert.equal(boxSeries(added), 'EB');
  for (const anchor of elements.filter(item => item.type === 'a')) assert.ok(!all(anchor).some(item => item.type === 'button'));
});
