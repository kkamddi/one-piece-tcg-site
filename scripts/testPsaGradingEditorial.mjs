import assert from 'node:assert/strict';
import test from 'node:test';
import { PSA_GRADING_EDITORIAL } from '../lib/psa-grading-editorial.js';

const article = PSA_GRADING_EDITORIAL;
const text = JSON.stringify(article);
const yen = (value) => Number(String(value).replace(/[¥,]/g, ''));

test('the article has the shared editorial shape', () => {
  assert.equal(typeof article.heading, 'string');
  assert.equal(article.reviewedAt, '2026-10-07');
  assert.equal(article.dataDate, '2026-10-07');
  assert.ok(article.paragraphs.length >= 1);
  assert.equal(article.summary.length, 4);
  article.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.ok(article.checklist.length >= 3);
  article.sections.forEach((section, index) => assert.match(section.heading, new RegExp(`^${index + 1}\\. `)));
  assert.ok(article.sections.some((section) => section.table));
  assert.ok(article.sections.some((section) => section.bars));
  const images = article.sections.flatMap((section) => section.images || []);
  assert.ok(images.length >= 1 && images.length <= 3);
  images.forEach((image) => {
    assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/JP\/[A-Z0-9-]+_p\d+\.webp$/);
    assert.ok(image.alt && image.caption);
  });
});

test('every table row has one cell per column', () => {
  for (const section of article.sections.filter((item) => item.table)) {
    const { columns, rows } = section.table;
    assert.ok(rows.length > 0);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${section.heading}: ${row[0]}`));
  }
});

test('the gap bars match the rarity table and the summary', () => {
  const table = article.sections[1].table;
  const gapColumn = table.columns.indexOf('차액 중앙값');
  const recordColumn = table.columns.indexOf('PSA10 기록');
  const byLabel = new Map(table.rows.map((row) => [row[0], row]));
  const gapBars = article.sections[2].bars;
  gapBars.forEach((bar) => {
    assert.equal(bar.display, `¥${bar.value.toLocaleString('en-US')}`);
    assert.equal(yen(byLabel.get(bar.label)[gapColumn]), bar.value, bar.label);
  });
  assert.deepEqual(gapBars.map((bar) => bar.value), [...gapBars.map((bar) => bar.value)].sort((a, b) => b - a));

  const summary = new Map(article.summary.map((item) => [item.label, item.value]));
  assert.equal(summary.get('망가 PSA10 차액 (중앙값)'), byLabel.get('망가(코믹)')[gapColumn]);
  assert.equal(summary.get('기본 SR 중 PSA10 거래 기록 비율'), byLabel.get('SR')[recordColumn]);
  assert.equal(summary.get('Single ¥5,000 미만 카드의 PSA10 중앙값'), article.sections[3].stats.find((stat) => stat.label === 'PSA10 중앙값').value);
  assert.match(article.paragraphs.join(' '), new RegExp(summary.get('두 가격이 모두 있는 일본판 상품')));
});

test('the top-50 bars add up to 50 and to the stated 39 cards', () => {
  const bars = article.sections[6].bars;
  assert.equal(bars.reduce((sum, bar) => sum + bar.value, 0), 50);
  assert.equal(bars.filter((bar) => bar.label !== '그 밖').reduce((sum, bar) => sum + bar.value, 0), 39);
  assert.match(article.sections[6].paragraphs[0], /39개\(78%\)/);
});

test('only existing guide paths are linked and the card-price overlap stays a reference', () => {
  const hrefs = article.sections.flatMap((section) => (section.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^\/(guide\/card-price|guide\/card-storage|guides\/centering|lab\/centering|prices)(\/product\/\d+\?code=[A-Z0-9-]+)?$/));
  assert.ok(hrefs.includes('/guide/card-price'));
  assert.doesNotMatch(text, /10\.2배|5\.6배/);
});

test('the article does not state PSA fees, turnaround, population or grade odds', () => {
  assert.doesNotMatch(text, /감정비[^"]{0,12}(\$|¥|₩|\d+\s*(달러|엔|원))/);
  assert.doesNotMatch(text, /\d+\s*(영업일|주|개월)\s*(정도|안팎|이내|소요|걸)/);
  assert.doesNotMatch(text, /팝(리포트|레포트|\s?리포트)|population|개체 수/i);
  assert.doesNotMatch(text, /(10등급|PSA10)[^"]{0,20}(받을|나올) (확률|비율)/);
  assert.doesNotMatch(text, /확률[^"]{0,8}\d+%/);
  assert.match(text, /PSA 공식 사이트/);
});

test('the article makes no profit promise or investment advice', () => {
  assert.doesNotMatch(text, /수익 보장|확실한 수익|무조건|반드시 (오릅|올라)|투자 추천|돈이 됩/);
  assert.match(text, /보장되지 않습니다/);
});
