import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const chart = ast.program.body.find(node => node.id?.name === 'RenewMarketChart');
const formatter = ast.program.body.find(node => node.id?.name === 'formatMarketPrimaryPrice');
let label;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXAttribute' && node.name?.name === 'aria-label'
    && source.slice(node.start, node.end).includes('point.timestamp')) label = node.value.expression;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(chart);
assert.ok(label);

test('chart accessible prices use the same primary currency as visible prices', () => {
  for (const [uiLang, expected] of [['KR', 'KRW'], ['JP', 'JPY'], ['EN', 'USD']]) {
    const context = vm.createContext({ uiLang, point: { price: 1000, timestamp: 'day' },
      MARKET_USD_TO_JPY: 150, formatMarketDate: () => 'date',
      formatWonFromYen: () => 'KRW', formatYen: () => 'JPY', formatUsd: () => 'USD' });
    vm.runInContext(source.slice(formatter.start, formatter.end), context);
    assert.equal(vm.runInContext(source.slice(label.start, label.end), context), `date ${expected}`);
  }
});
