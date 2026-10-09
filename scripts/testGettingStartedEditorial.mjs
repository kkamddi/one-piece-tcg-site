import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { GETTING_STARTED_EDITORIAL } from '../lib/getting-started-editorial.js';

const article = GETTING_STARTED_EDITORIAL;
const text = JSON.stringify(article);
const ANALYSIS = new URL('../artifacts/content/getting-started-analysis.json', import.meta.url);
const analysis = existsSync(ANALYSIS) ? JSON.parse(readFileSync(ANALYSIS, 'utf8')) : null;
const comma = (value) => Number(value).toLocaleString('en-US');
const section = (prefix) => article.sections.find((item) => item.heading.startsWith(prefix));
const summaryValue = (labelPart) => article.summary.find((item) => item.label.includes(labelPart))?.value;

test('the article has the shared editorial shape', () => {
  assert.equal(typeof article.heading, 'string');
  assert.match(article.heading, /원피스 카드게임/);
  assert.match(article.heading, /입문|시작/);
  assert.equal(article.reviewedAt, '2026-10-09');
  assert.equal(article.dataDate, '2026-10-09');
  assert.equal(article.paragraphs.length, 2);
  assert.equal(article.summary.length, 4);
  article.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.ok(article.checklist.length >= 3);
  article.sections.forEach((item, index) => assert.match(item.heading, new RegExp(`^${index + 1}\\. `)));
  assert.ok(article.sections.some((item) => item.table));
  const images = article.sections.flatMap((item) => item.images || []);
  assert.ok(images.length <= 2);
  images.forEach((image) => {
    assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/(JP|KR)\/[A-Z0-9-]+(_p\d+)?\.webp$/);
    assert.ok(image.alt && image.caption);
  });
});

test('every table row has one cell per column', () => {
  for (const item of article.sections.filter((entry) => entry.table)) {
    const { columns, rows } = item.table;
    assert.equal(typeof item.table.numeric, 'boolean');
    assert.ok(rows.length > 0);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${item.heading}: ${row[0]}`));
  }
});

test('links point to site guide pages or official sources only', () => {
  const hrefs = article.sections.flatMap((item) => (item.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^(\/(prices|guide\/[a-z-]+)|https:\/\/www\.onepiece-cardgame\.com\/play-guide\/)$/, href));
  ['/guide/card-catalog', '/guide/shops', '/guide/release-schedule', '/guide/box-recommendation', '/guide/card-storage', '/guide/card-types', '/guide/price-ranking', '/prices']
    .forEach((href) => assert.ok(hrefs.includes(href), href));
});

test('official rule and product facts stay consistent', () => {
  assert.match(text, /리더 카드 1장, 덱 50장, 돈!! 카드 10장/);
  assert.match(text, /4장까지/);
  assert.equal(summaryValue('대전 구성'), '덱 50장');
  const rows = new Map(section('2. ').table.rows.map((row) => [row[0], row]));
  assert.match(rows.get('정규 부스터')[2], /6장 \(240엔 \/ 2,000원\)/);
  assert.match(rows.get('프리미엄 부스터')[2], /10장 \(550엔\)/);
  assert.match(rows.get('스타트 덱')[2], /51장 \+ 돈!! 10장 \(1,430엔 \/ 12,000원\)/);
});

test('numbers match the analysis JSON when it is present', (t) => {
  if (!analysis) {
    t.skip('artifacts/content/getting-started-analysis.json not found');
    return;
  }
  const { official, productCounts, catalog, gap, singlePrices, calendar, latestMainBooster } = analysis;
  assert.equal(analysis.refDate, article.dataDate);

  // Rules and prices recorded in the analysis.
  assert.equal(official.rules.deck, 50);
  assert.equal(official.rules.don, 10);
  assert.equal(official.rules.maxCopies, 4);
  assert.match(text, new RegExp(`${official.jpBooster.packYen}엔`));
  assert.match(text, new RegExp(`${comma(official.krBooster.packWon)}원`));
  assert.match(text, new RegExp(`${official.krBooster.packsPerBox}팩`));

  // Product table counts.
  const rows = new Map(section('2. ').table.rows.map((row) => [row[0], row]));
  const count = (locale, family) => (productCounts[locale][family].count ? `${productCounts[locale][family].count}종` : '없음');
  [['정규 부스터', 'OP'], ['엑스트라 부스터', 'EB'], ['프리미엄 부스터', 'PRB'], ['스타트 덱', 'ST']].forEach(([label, family]) => {
    assert.equal(rows.get(label)[3], count('JP', family), `${label} JP`);
    assert.equal(rows.get(label)[4], count('KR', family), `${label} KR`);
  });
  assert.equal(rows.get('프로모')[3], `도감 ${comma(catalog.promoCards.JP)}장`);
  assert.equal(rows.get('프로모')[4], `도감 ${comma(catalog.promoCards.KR)}장`);
  assert.equal(summaryValue('정규 부스터 발매'), `${productCounts.JP.OP.count}탄 · ${productCounts.KR.OP.count}탄`);
  const { OP, EB } = catalog.jpCardsPerSet;
  assert.match(text, new RegExp(`${EB.min}~${EB.max}장`));
  assert.match(text, new RegExp(`${OP.min}~${OP.max}장`));
  assert.match(text, new RegExp(`중앙값 ${gap.jpMainIntervalMedianDays}일`));

  // Start dates.
  assert.equal(calendar.jpFirstBooster.date, '2022-07-22');
  assert.match(text, /2022년 7월/);
  assert.equal(calendar.krFirstCardProduct.date, '2024-03-22');
  assert.match(text, /2024년 3월 22일/);

  // KR vs JP gap (same logic as /guide/release-schedule).
  assert.equal(summaryValue('한글판이 늦게'), gap.releaseScheduleSummary);
  assert.match(text, new RegExp(`최근 부스터 ${gap.recentCount}종`));
  assert.match(text, new RegExp(`중앙값 ${Math.round(gap.recentGapMedianDays)}일`));
  assert.match(text, new RegExp(`${gap.first.krCode}은 ${gap.first.gapDays}일`));
  assert.match(text, new RegExp(`${gap.last.krCode}는 ${gap.last.gapDays}일`));
  assert.match(text, new RegExp(gap.jpOnlyReleasedBoosters.join('·')));
  const compare = new Map(section('3. ').table.rows.map((row) => [row[0], row]));
  assert.equal(compare.get('최신 정규 부스터')[1], `${latestMainBooster.JP.code} (${latestMainBooster.JP.date})`);
  assert.equal(compare.get('최신 정규 부스터')[2], `${latestMainBooster.KR.code} (${latestMainBooster.KR.date})`);
  assert.equal(compare.get('다음 신작')[1], `${gap.nextJp.code} (${gap.nextJp.date})`);
  assert.equal(compare.get('다음 신작')[2], `${gap.nextKr.code} (${gap.nextKr.date})`);

  // JP single prices.
  const prices = section('4. ');
  const stat = (label) => prices.stats.find((item) => item.label === label).value;
  assert.equal(stat('단품 거래가 중앙값'), `¥${comma(singlePrices.medianJpy)}`);
  assert.equal(summaryValue('단품 거래가 중앙값'), `¥${comma(singlePrices.medianJpy)}`);
  assert.equal(stat('¥5,000 미만'), `${singlePrices.under5000Pct}%`);
  assert.equal(stat('¥10,000 이상'), `${singlePrices.atLeast10000Pct}%`);
  assert.match(prices.paragraphs[0], new RegExp(`${comma(singlePrices.jpCardProducts)}개 중`));
  assert.match(prices.paragraphs[0], new RegExp(`${comma(singlePrices.withSingle)}개\\(${Math.round((singlePrices.withSingle / singlePrices.jpCardProducts) * 100)}%\\)`));
  assert.match(article.paragraphs[1], new RegExp(`${comma(singlePrices.withSingle)}개 상품`));
  assert.match(text, new RegExp(`¥1,000 미만은 ${singlePrices.under1000Pct}%`));
  assert.match(text, new RegExp(`30일 안인 상품은 ${singlePrices.tradedWithin30DaysPct}%`));
});

test('the article makes no price promise or investment advice', () => {
  assert.doesNotMatch(text, /수익 보장|확실한 수익|무조건|반드시 (오릅|올라)|투자 추천|돈이 됩|오를 (카드|가능성)/);
  assert.match(text, /보장하지 않습니다/);
});
