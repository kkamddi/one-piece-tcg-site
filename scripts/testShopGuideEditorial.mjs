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
  for (const name of ['CARD_STORAGE_GUIDE', 'SHOP_BUYING_GUIDE', 'CARD_PRICE_GUIDE', 'CARD_CATALOG_GUIDE', 'BOOSTER_COMPARISON_GUIDE']) {
    assert.ok(app.includes(`\nconst ${name} = toEditorialGuide(`), name);
  }
});

test('online buying, list price and selling (매입) sections cover their search intents with verified links', () => {
  const headings = SHOP_GUIDE_EDITORIAL.sections.map((section) => section.heading);
  headings.forEach((heading, index) => assert.ok(heading.startsWith(`${index + 1}. `), heading));
  assert.equal(new Set(headings).size, headings.length);
  const byPrefix = (prefix) => SHOP_GUIDE_EDITORIAL.sections.find((section) => section.heading.startsWith(prefix));
  const hrefs = (section) => section.links.map((link) => link.href);

  const online = byPrefix('6.');
  assert.match(online.heading, /온라인/);
  assert.match(online.items.join(' '), /실링/);
  assert.match(online.items.join(' '), /거래 기록/);

  const listPrice = byPrefix('7.');
  assert.match(listPrice.heading, /정가/);
  const rows = listPrice.table.rows;
  assert.equal(new Set(rows.map((row) => row[0])).size, rows.length, 'row[0] is the React key');
  rows.forEach((row) => assert.equal(row.length, listPrice.table.columns.length));
  // Official product pages (onepiece-cardgame.kr / onepiece-cardgame.com), checked 2026-10-09.
  const prices = rows.map((row) => row[2]).join(' ');
  for (const price of ['2,000원', '48,000원', '12,000원', '240엔']) assert.ok(prices.includes(price), price);
  assert.deepEqual(hrefs(listPrice), ['/guide/box-recommendation', '/guide/release-schedule']);

  const selling = byPrefix('8.');
  assert.match(selling.heading, /매입/);
  assert.match(selling.paragraphs[0], /시세보다 낮게/);
  assert.deepEqual(hrefs(selling), ['/prices', '/guide/card-price', '/guide/psa-grading']);
});

test('the shop guide names no private shops and is freshly reviewed', () => {
  const text = JSON.stringify(SHOP_GUIDE_EDITORIAL);
  assert.doesNotMatch(text, /카드성지|더\s?카드룸/);
  assert.equal(SHOP_GUIDE_EDITORIAL.reviewedAt, '2026-10-09');
  assert.equal(SHOP_GUIDE_EDITORIAL.dataDate, '2026-10-09');
});
