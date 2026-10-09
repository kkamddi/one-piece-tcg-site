import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import boxMarketItems from '../src/data/box-market-items.js';
import {
  BOX_PRICES_SEO,
  BOX_PRICES_USD_TO_KRW,
  buildBoxPricesEditorial,
  collectBoxRows,
  formatKrw,
  formatUsd,
  getBoxCode,
  toKstDateKey
} from '../lib/box-prices-editorial.js';
import { SERIES_GUIDE_USD_TO_KRW } from '../src/lib/series-guide-analysis.js';
import { GUIDE_ARTICLE_FAQ, GUIDE_FAQ_PATHS } from '../lib/guide-article-faq.js';

const TODAY = '2026-10-09';
const prices = JSON.parse(await readFile(new URL('../src/data/box-market-prices.json', import.meta.url), 'utf8'));
const realEditorial = buildBoxPricesEditorial(boxMarketItems, prices, TODAY);

const item = (code, apparelId, releaseDate, name = `ONE PIECE Card Game Booster Pack ${code} Box`) => ({ code, apparelId, releaseDate, name });
const snapshot = (minPrice, releaseDate = '') => ({ minPrice, priceCurrency: 'USD', listingCount: 5, releaseDate });
const fixtureItems = [
  item('OP-01', 1, '2022-07-22'),
  item('OP-02', 2, '2022-11-04'),
  item('EB-01', 3, '2024-01-27', 'ONE PIECE Card Game Extra Booster Memorial Collection Box'),
  item('PRB-01', 4, '2024-07-27', 'ONE PIECE Card Game Premium Booster THE BEST Box'),
  item('OPC-TCG-OP-17', 5, '2026-08-22'),
  item('OPC-TCG-EB-05', 6, '2026-10-31'),
  item('EB-03-SP', 7, '2025-10-29', 'ONE PIECE Card Game Extra Booster "Heroines Edition Special Set"'),
  item('OPC-TCG-EB-05-HPB', 8, '2026-10-31', 'ONE PIECE Card Game Extra Booster "PRECIOUS BOX"'),
  item('OPC-TCG-OP-17-DON', 9, '2026-08-22', 'DON!! Card (Booster Pack Box)'),
  item('OPC-TCG-ST-31', 10, '2026-07-11', 'ONE PIECE Card Game Start Deck "Red"'),
  item('PCC-BS4', 11, '2025-04-01', 'ONE PIECE Card Game Premium Card Collection')
];
const fixturePrices = {
  updatedAt: '2026-10-07T20:30:00.000Z',
  items: {
    1: snapshot(240), 2: snapshot(120), 3: snapshot(126), 4: snapshot(140), 5: snapshot(75), 6: snapshot(0),
    7: snapshot(178), 8: snapshot(500), 9: snapshot(17), 10: snapshot(30), 11: snapshot(73)
  }
};

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectStrings(entry, out));
  return out;
}

function assertShape(editorial) {
  assert.equal(typeof editorial.heading, 'string');
  assert.match(editorial.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(editorial.dataDate, editorial.reviewedAt);
  assert.ok(editorial.paragraphs.length >= 1);
  assert.equal(editorial.summary.length, 4);
  editorial.summary.forEach((entry) => assert.ok(entry.value && entry.label));
  assert.equal(editorial.checklist.length, 3);
  const headings = editorial.sections.map((section) => section.heading);
  assert.equal(new Set(headings).size, headings.length, 'section headings are unique (React keys)');
  editorial.sections.forEach((section, index) => {
    assert.match(section.heading, new RegExp(`^${index + 1}\\. `), 'sections are numbered');
    // Readability: one short lead and at most one table, bar list or bullet list per section.
    assert.ok((section.paragraphs || []).length <= 1, `${section.heading} has one lead at most`);
    assert.ok(['table', 'bars', 'items'].filter((key) => section[key]).length <= 1, `${section.heading} has one visual`);
    if (section.table) {
      assert.ok(section.table.rows.length > 0, `${section.heading} has no empty table`);
      section.table.rows.forEach((row) => {
        assert.equal(row.length, section.table.columns.length);
        row.forEach((cell) => assert.equal(typeof cell, 'string'));
      });
      const firstCells = section.table.rows.map((row) => row[0]);
      assert.equal(new Set(firstCells).size, firstCells.length, 'first cells are unique (React row keys)');
    }
    (section.bars || []).forEach((bar) => assert.ok(Number.isFinite(bar.value) && typeof bar.display === 'string'));
    if (section.links) assert.equal(new Set(section.links.map((link) => link.href)).size, section.links.length);
  });
}

test('only booster boxes are kept: OP, EB and PRB with a Box name', () => {
  assert.deepEqual(getBoxCode(item('OPC-TCG-OP-17', 1, '')), { family: 'OP', code: 'OP-17' });
  assert.deepEqual(getBoxCode(item('PRB-02', 1, '')), { family: 'PRB', code: 'PRB-02' });
  assert.equal(getBoxCode(item('EB-03-SP', 1, '', 'Heroines Edition Special Set')), null);
  assert.equal(getBoxCode(item('OPC-TCG-EB-05-HPB', 1, '')), null);
  assert.equal(getBoxCode(item('OPC-TCG-OP-17-DON', 1, '')), null);
  assert.equal(getBoxCode(item('OPC-TCG-ST-31', 1, '')), null);
  assert.equal(getBoxCode(item('OP-99', 1, '', 'ONE PIECE Card Game DON!! Card')), null, 'non-box names drop out');
  const codes = collectBoxRows(fixtureItems, fixturePrices).map((row) => row.code);
  assert.deepEqual(codes, ['EB-05', 'OP-17', 'PRB-01', 'EB-01', 'OP-02', 'OP-01'], 'newest release first');
});

test('formatting uses the shared USD to KRW rate and rounds to 1,000 won', () => {
  assert.equal(BOX_PRICES_USD_TO_KRW, SERIES_GUIDE_USD_TO_KRW);
  assert.equal(formatUsd(317), 'US$317');
  assert.equal(formatKrw(317), '₩462,000');
  assert.equal(formatKrw(75), '₩109,000');
  assert.equal(toKstDateKey('2026-10-07T20:30:00.000Z'), '2026-10-08', 'updatedAt is shown as a KST date');
});

test('fixture: unpriced boxes are left out of the table and named once; summary is computed', () => {
  const editorial = buildBoxPricesEditorial(fixtureItems, fixturePrices, '2026-10-08');
  assertShape(editorial);
  assert.equal(editorial.dataDate, '2026-10-08');
  const [tableSection, topSection] = editorial.sections;
  assert.deepEqual(tableSection.table.rows.map((row) => row[0]), ['OP-17', 'PRB-01', 'EB-01', 'OP-02', 'OP-01']);
  assert.deepEqual(tableSection.table.rows[0], ['OP-17', '부스터', '2026-08-22', 'US$75', '₩109,000']);
  assert.match(tableSection.paragraphs[0], /5종/);
  assert.match(tableSection.paragraphs[0], /EB-05는 아직 등록가가 없어/);
  assert.deepEqual(topSection.bars.map((bar) => bar.value), [240, 140, 126, 120, 75]);
  assert.match(topSection.paragraphs[0], /OP-01은 가장 싼 OP-17의 약 3\.2배/);
  const [count, highest, newest, date] = editorial.summary;
  assert.equal(count.value, '5종');
  assert.equal(highest.value, 'US$240');
  assert.match(highest.label, /OP-01/);
  assert.equal(newest.value, 'US$75');
  assert.match(newest.label, /OP-17/);
  assert.equal(date.value, '10월 8일');
  const text = JSON.stringify(editorial);
  assert.doesNotMatch(text, /US\$500|US\$178|US\$17\b|US\$30|US\$73/, 'special sets, precious boxes, DON!!, decks and collections are excluded');
});

test('fixture: an old snapshot adds one stale note; fresh data does not', () => {
  const caution = (editorial) => editorial.sections.at(-1).items.join('\n');
  assert.doesNotMatch(caution(buildBoxPricesEditorial(fixtureItems, fixturePrices, '2026-10-09')), /마지막 갱신/);
  assert.match(caution(buildBoxPricesEditorial(fixtureItems, fixturePrices, '2026-10-20')), /마지막 갱신이 12일 전/);
});

test('empty input still yields a sensible page without empty tables', () => {
  for (const [items, input] of [[[], { updatedAt: '2026-10-08T00:00:00Z', items: {} }], [null, null], [fixtureItems, { items: {} }]]) {
    const editorial = buildBoxPricesEditorial(items, input, TODAY);
    assertShape(editorial);
    assert.equal(editorial.summary[0].value, '0종');
  }
});

test('real data: shape, sorting and every price comes from the snapshot', () => {
  assertShape(realEditorial);
  assert.equal(realEditorial.dataDate, toKstDateKey(prices.updatedAt));
  const rows = realEditorial.sections[0].table.rows;
  assert.ok(rows.length >= 20);
  const dates = rows.map((row) => row[2]);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'newest first');
  assert.ok(rows.some((row) => row[0] === 'OP-17'), 'bot codes like OPC-TCG-OP-17 are folded');
  assert.ok(!rows.some((row) => /SP|HPB|DON|ST-/.test(row[0])));
  const known = new Set(Object.values(prices.items).map((entry) => entry.minPrice).filter((value) => value > 0));
  const text = collectStrings(realEditorial).join('\n');
  (text.match(/US\$[\d,]+/g) || []).forEach((usd) => assert.ok(known.has(Number(usd.slice(3).replace(/,/g, ''))), `${usd} is in the snapshot`));
  const highest = Math.max(...rows.map((row) => Number(row[3].slice(3).replace(/,/g, ''))));
  assert.equal(realEditorial.summary[1].value, formatUsd(highest));
  assert.equal(realEditorial.summary[2].value, rows[0][3], 'latest box is the first row');
});

test('real data: labels say listing price, not trade price, and avoid advice', () => {
  const text = collectStrings(realEditorial).join('\n');
  assert.match(text, /등록 최저가/);
  assert.match(text, /실제 거래가/);
  assert.match(text, /대략/);
  assert.doesNotMatch(text, /추천합니다|사세요|오를 것|투자|저평가|확정/);
  assert.doesNotMatch(text, /일본판[^\n]*1박스[^\n]*엔/, 'no Japanese box list price');
});

test('real data: short, readable text', () => {
  const prose = collectStrings({ p: realEditorial.paragraphs, s: realEditorial.sections.map((section) => ({ heading: section.heading, paragraphs: section.paragraphs, items: section.items })), c: realEditorial.checklist }).join('');
  assert.ok(prose.length <= 900, `prose length ${prose.length}`);
});

test('SEO copy and FAQ', () => {
  assert.match(BOX_PRICES_SEO.title, /^원피스카드 박스 가격/);
  assert.ok(BOX_PRICES_SEO.description.length >= 80 && BOX_PRICES_SEO.description.length <= 130, `description ${BOX_PRICES_SEO.description.length}`);
  assert.match(BOX_PRICES_SEO.keywords, /팩 가격/);
  assert.equal(GUIDE_FAQ_PATHS.boxPrices, '/guide/box-prices');
  assert.equal(GUIDE_ARTICLE_FAQ.boxPrices.length, 2);
});
