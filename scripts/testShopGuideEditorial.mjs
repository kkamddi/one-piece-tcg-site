import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SHOP_GUIDE_EDITORIAL } from '../lib/shop-guide-editorial.js';

test('the shop guide page and its pre-rendered HTML share one article', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  assert.match(app, /const SHOP_BUYING_GUIDE = toEditorialGuide\(SHOP_GUIDE_EDITORIAL\);/);
  assert.match(middleware, /\.\.\.SHOP_GUIDE_EDITORIAL\.sections, \{ heading: '구매 전 체크리스트'/);
});

test('store counts in the article match src/data/shops.json (refresh the article when stores change)', async () => {
  const shops = JSON.parse(await readFile(new URL('../src/data/shops.json', import.meta.url), 'utf8'));
  const count = (predicate) => shops.filter(predicate).length;
  const summary = Object.fromEntries(SHOP_GUIDE_EDITORIAL.summary.map((item) => [item.label, item.value]));
  assert.equal(summary['공식 목록 매장'], `${shops.length}곳`);
  assert.equal(summary['공인/공식 점포'], `${count((shop) => shop.sourceType === 'official')}곳`);
  assert.equal(summary['공식 취급 점포'], `${count((shop) => shop.sourceType === 'general')}곳`);
  const metro = count((shop) => ['서울특별시', '경기도', '인천광역시'].includes(shop.sido));
  assert.equal(summary['수도권(서울·경기·인천)'], `${Math.round((metro / shops.length) * 100)}%`);
  const regions = SHOP_GUIDE_EDITORIAL.sections.find((section) => section.heading.startsWith('2.')).bars;
  assert.equal(regions.find((bar) => bar.label === '서울').value, count((shop) => shop.sido === '서울특별시'));
  assert.equal(regions.find((bar) => bar.label === '경기').value, count((shop) => shop.sido === '경기도'));
});

test('every shared-article guide is built by a declared toEditorialGuide (a missing helper blanks the whole app)', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.equal((app.match(/^function toEditorialGuide\(editorial\) \{/gm) || []).length, 1);
  for (const name of ['SHOP_BUYING_GUIDE', 'CARD_PRICE_GUIDE', 'CARD_CATALOG_GUIDE', 'BOOSTER_COMPARISON_GUIDE']) {
    assert.ok(app.includes(`\nconst ${name} = toEditorialGuide(`), name);
  }
});
