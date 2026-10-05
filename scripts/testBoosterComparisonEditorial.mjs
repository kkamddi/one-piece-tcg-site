import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { BOOSTER_COMPARISON_EDITORIAL } from '../lib/booster-comparison-editorial.js';

test('the booster comparison page is routed, listed and pre-rendered from one article', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  const sitemap = await readFile(new URL('./generatePrimarySitemap.js', import.meta.url), 'utf8');
  assert.match(app, /const isBoosterComparisonGuide = initialPath === '\/guide\/booster-comparison';/);
  assert.match(app, /isBoosterComparisonGuide \? <RenewBoosterComparisonGuide \/> : null/);
  assert.match(app, /title: BOOSTER_COMPARISON_EDITORIAL\.heading/);
  assert.match(middleware, /sections: \[\.\.\.BOOSTER_COMPARISON_EDITORIAL\.sections, \{ heading: '부스터 비교 체크리스트'/);
  assert.match(sitemap, /'\/guide\/booster-comparison'/);
});

test('every main booster from OP01 to OP16 has one comparison row', () => {
  const rows = BOOSTER_COMPARISON_EDITORIAL.sections[1].items;
  assert.equal(rows.length, 16);
  rows.forEach((row, index) => assert.ok(row.startsWith(`OP${String(index + 1).padStart(2, "0")}(`), row));
});

test('the article does not claim pull rates', () => {
  const text = JSON.stringify(BOOSTER_COMPARISON_EDITORIAL);
  assert.doesNotMatch(text, /봉입률은 (약|대략)|\d+박스에 1장/);
  assert.match(text, /봉입률은 공식 확인 자료가 없/);
});
