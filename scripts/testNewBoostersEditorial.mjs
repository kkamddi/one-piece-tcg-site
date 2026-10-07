import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { NEW_BOOSTERS_EDITORIAL as article } from '../lib/new-boosters-editorial.js';

const tables = article.sections.filter(section => section.table).map(section => section.table);
const analysisUrl = new URL('../artifacts/content/new-boosters-analysis.json', import.meta.url);
const yen = value => Number(String(value).replace(/[^\d]/g, ''));

test('every table row matches its columns', () => {
  for (const table of tables) for (const row of table.rows) assert.equal(row.length, table.columns.length, row[0]);
});

test('EB-05 rarity counts add up to the official 75 kinds', () => {
  const [, ...counts] = tables[1].rows[0];
  assert.equal(counts.map(Number).reduce((sum, value) => sum + value, 0), 75);
  assert.match(tables[0].rows[0][3], /전 75종/);
});

test('the SP list names exactly the eight SP cards the official count gives', () => {
  const sp = article.sections[1].items.find(item => item.startsWith('SP 8종'));
  const names = sp.match(/\((.+?)\)과 기존 번호 5종\((.+?)\)/);
  assert.equal(names[1].split('·').length + names[2].split(', ').length, 8);
});

test('EB-03 and OP-17 figures match the saved analysis', { skip: !existsSync(analysisUrl) }, () => {
  const analysis = JSON.parse(readFileSync(analysisUrl, 'utf8'));
  const eb03 = article.sections[3];
  eb03.table.rows.forEach((row, index) => assert.equal(yen(row[2]), analysis.EB03.top[index].single, row[0]));
  assert.equal(yen(eb03.stats[0].value), analysis.EB03.byVersion.SP.median);
  assert.equal(yen(eb03.stats[1].value), analysis.EB03.byVersion['기본'].median);
  const op17 = article.sections[5];
  op17.table.rows.forEach((row, index) => assert.equal(yen(row[2]), analysis.OP17.top[index].single, row[0]));
  assert.equal(op17.bars[0].value, analysis.OP17.byVersion['망가'].median);
  assert.equal(analysis.EB05.listed, 35);
});

test('the preview makes no pull-rate or price promise', () => {
  const text = JSON.stringify(article);
  assert.doesNotMatch(text, /봉입률은 (약|대략)|\d+박스에 1장|오를 것|수익/);
  assert.match(text, /봉입률은 공식 자료가 없어/);
  assert.match(text, /가격을 보장하지 않습니다/);
});
