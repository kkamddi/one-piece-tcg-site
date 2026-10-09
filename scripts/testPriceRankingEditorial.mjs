import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PRICE_RANKING_EDITORIAL as A } from '../lib/price-ranking-editorial.js';

const text = JSON.stringify(A);
const yen = (value) => Number(String(value).replace(/[¥,]/g, ''));
const num = (value) => Number(String(value).replace(/[^\d.]/g, ''));
const fmt = (value) => value.toLocaleString('en-US');
const section = (prefix) => A.sections.find((s) => s.heading.startsWith(prefix));
const single = section('1.').table;
const psa = section('2.').table;
const versions = section('3.').table;
const caveats = section('4.');
const col = (table, name) => table.columns.indexOf(name);

test('the article has the shared editorial shape', () => {
  assert.match(A.heading, /원피스카드/);
  assert.match(A.heading, /가격 순위|비싼 카드 순위/);
  assert.equal(A.reviewedAt, '2026-10-09');
  assert.equal(A.dataDate, '2026-10-09');
  assert.equal(A.paragraphs.length, 2);
  assert.equal(A.summary.length, 4);
  A.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.ok(A.checklist.length >= 3);
  assert.equal(A.checklist.length, 3);
  A.sections.forEach((s, index) => assert.ok(s.heading.startsWith(`${index + 1}. `), s.heading));
  const images = A.sections.flatMap((s) => s.images || []);
  assert.ok(images.length >= 1 && images.length <= 3);
  images.forEach((image) => {
    assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/JP\/[A-Z0-9-]+_p\d+\.webp$/);
    assert.ok(image.alt && image.caption);
  });
});

test('each section stays short: a lead, then one table or one short list', () => {
  assert.equal(A.sections.length, 4);
  A.paragraphs.forEach((p) => assert.ok(p.length <= 60, p));
  for (const s of A.sections) {
    const blocks = [s.table, s.items?.length, s.bars?.length].filter(Boolean).length;
    assert.equal(blocks, 1, s.heading);
    assert.ok(s.paragraphs?.length >= 1 && s.paragraphs.length <= 2, s.heading);
    s.paragraphs.forEach((p) => assert.ok(p.length <= 60, p));
    (s.items || []).forEach((item) => assert.ok(item.length <= 45, item));
    assert.ok((s.items || []).length <= 4, s.heading);
  }
  A.checklist.forEach((item) => assert.ok(item.length <= 30, item));
  // Method and caveats appear once, in the last section only.
  const body = JSON.stringify(A.sections.slice(0, -1));
  assert.doesNotMatch(body, /프로모|시리얼|30일보다 오래|매입가|한국판/);
});

test('every table row has one cell per column', () => {
  for (const s of A.sections.filter((item) => item.table)) {
    const { columns, rows } = s.table;
    assert.ok(rows.length > 0);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${s.heading}: ${row.join('|')}`));
  }
});

test('the rankings are complete, ordered and agree with the summary', () => {
  assert.equal(single.rows.length, 30);
  assert.equal(psa.rows.length, 10);
  const singlePrice = col(single, 'Single');
  single.rows.forEach((row, i) => {
    assert.equal(row[0], String(i + 1));
    if (i) assert.ok(yen(row[singlePrice]) <= yen(single.rows[i - 1][singlePrice]), row[2]);
  });
  const psaPrice = col(psa, 'PSA10');
  psa.rows.forEach((row, i) => {
    assert.equal(row[0], String(i + 1));
    if (i) assert.ok(yen(row[psaPrice]) <= yen(psa.rows[i - 1][psaPrice]), row[2]);
    // Every PSA10 top-10 card is in the Single top 30 with the same Single price.
    const match = single.rows.find((s) => s[2] === row[2] && s[3] === row[3]);
    assert.ok(match, `${row[2]} ${row[3]} missing from the Single table`);
    assert.equal(match[singlePrice], row[col(psa, 'Single')]);
  });
  assert.equal(A.summary[0].value, single.rows[0][singlePrice]);
  assert.ok(A.summary[0].label.includes(single.rows[0][2]));
  assert.equal(A.summary[1].value, single.rows[29][singlePrice]);
  const mangaRow = versions.rows.find((row) => row[0] === '망가');
  assert.equal(A.summary[2].value, `${mangaRow[col(versions, '상위 50 안')]}개`);
});

test('statements about the top 30 can be recomputed from the table', () => {
  const v = col(single, '버전');
  const manga = single.rows.filter((row) => row[v].includes('망가')).length;
  const sp = single.rows.filter((row) => / SP( |$)/.test(row[v])).length;
  assert.match(text, new RegExp(`TOP 30 중 망가가 ${manga}개\\(${Math.round((manga / 30) * 100)}%\\), SP가 ${sp}개`));
  assert.ok(single.rows.every((row) => !/^(C|UC|R|SR|SEC|L|리더)$/.test(row[v])), 'no base-rarity card in the top 30');
  assert.match(section('1.').paragraphs[0], /기본 레어도 카드는 없습니다/);
  const stale = single.rows.filter((row) => (Date.parse('2026-10-09') - Date.parse(`2026-${row[col(single, '거래일')]}`)) / 86400000 > 30).length;
  assert.ok(caveats.items.includes(`TOP 30 중 ${stale}개는 마지막 Single 거래가 30일보다 오래됐습니다.`));
  const luffyPsa = psa.rows.filter((row) => row[1] === '몽키 D. 루피').length;
  assert.match(text, new RegExp(`10개 중 ${luffyPsa}개가 루피 카드`));
  assert.equal(single.rows.filter((row) => row[2] === 'OP05-119').length, 3);
});

test('the version breakdown adds up', () => {
  const inTop50 = col(versions, '상위 50 안');
  assert.equal(versions.rows.reduce((sum, row) => sum + num(row[inTop50]), 0), 50);
  const total = versions.rows.reduce((sum, row) => sum + num(row[col(versions, '상품 수')]), 0);
  assert.ok(A.paragraphs[1].includes(`${fmt(total)}개`));
  const secRow = versions.rows.find((row) => row[0] === 'SEC (기본)');
  assert.equal(secRow[inTop50], '0');
  assert.match(section('3.').paragraphs[0], /기본 SEC는 없습니다/);
});

test('images point to real JP catalog cards that are in the Single table', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
  const ids = new Set(catalog.filter((c) => c.locale === 'JP').map((c) => c.id));
  const numbers = new Set(catalog.filter((c) => c.locale === 'JP').map((c) => c.cardNo));
  for (const image of A.sections.flatMap((s) => s.images || [])) {
    const id = `JP::${image.src.match(/\/cards\/JP\/(.+)\.webp$/)[1]}`;
    assert.ok(ids.has(id), id);
    const code = id.slice(4).split('_')[0];
    assert.ok(single.rows.some((row) => row[2] === code), code);
    assert.ok(image.caption.includes(code) && image.alt.includes(code));
  }
  [...single.rows, ...psa.rows].forEach((row) => assert.ok(numbers.has(row[2]), row[2]));
});

test('only existing internal paths are linked', () => {
  const hrefs = A.sections.flatMap((s) => (s.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^\/(prices|guide\/(card-price|psa-grading|character-cards|collection\/manga))$/));
  assert.ok(hrefs.includes('/prices'));
  assert.ok(hrefs.includes('/guide/card-price'));
});

test('numbers match the saved analysis output when it is available', async (t) => {
  const file = new URL('../artifacts/content/price-ranking-analysis.json', import.meta.url);
  if (!existsSync(file)) return t.skip('analysis output is local only');
  const r = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(r.refDate, A.dataDate);
  const T = r.totals;

  single.rows.forEach((row, i) => {
    const c = r.topSingle[i];
    assert.deepEqual(row, [String(c.rank), c.krName, c.code, c.versionLabel, `¥${fmt(c.single)}`, c.singleDate.slice(5)]);
    assert.ok(c.singleDate.startsWith('2026-'));
  });
  psa.rows.forEach((row, i) => {
    const c = r.topPsa10[i];
    assert.deepEqual(row, [String(c.rank), c.krName, c.code, c.versionLabel, `¥${fmt(c.psa10)}`, `¥${fmt(c.single)}`]);
  });
  for (const image of A.sections.flatMap((s) => s.images || [])) {
    const id = `JP::${image.src.match(/\/cards\/JP\/(.+)\.webp$/)[1]}`;
    const c = r.topSingle.find((x) => x.cardId === id);
    assert.ok(c, id);
    assert.ok(image.caption.startsWith(`${c.rank}위 ${c.code}`), image.caption);
  }

  assert.ok(A.paragraphs[1].includes(`${fmt(T.countedSingle)}개`));
  assert.ok(caveats.items.some((item) => item.includes(`프로모 ${T.excludedPrizePromo}개`) && item.includes(`그중 ${T.excludedPrizeOverTop30Min}개는 30위보다 비쌉니다`)));
  assert.equal(yen(A.summary[1].value), T.top30MinSingle);
  assert.ok(caveats.items.some((item) => item.startsWith(`TOP 30 중 ${T.top30Stale30}개는`)));
  assert.equal(T.psaAlsoInSingleTop30, 10);
  assert.equal(T.top30BaseRarity, 0);
  const g30 = Object.fromEntries(r.top30ByGroup.map((x) => [x.key, x]));
  assert.match(text, new RegExp(`TOP 30 중 망가가 ${g30['망가'].count}개\\(${g30['망가'].pct}%\\), SP가 ${g30.SP.count}개`));

  const label = { 'SEC (기본)': 'SEC' };
  versions.rows.forEach((row) => {
    const g = r.groupMedians[label[row[0]] || row[0]];
    assert.ok(g, row[0]);
    assert.equal(num(row[1]), g.count, row[0]);
    assert.equal(yen(row[2]), g.median, row[0]);
    assert.equal(num(row[3]), g.inTop50, row[0]);
  });
  assert.equal(Object.keys(r.groupMedians).length, versions.rows.length);
  assert.equal(T.mangaInTop50, num(A.summary[2].value));
  assert.equal(r.top50ByCharacter[0].krName, '몽키 D. 루피');
  assert.equal(num(A.summary[3].value), r.top50ByCharacter[0].count);

  // The four characters named in section 3 are the analysis' top four and add up to the stated share.
  const top4 = r.top50ByCharacter.slice(0, 4);
  assert.deepEqual(top4.map((c) => c.krName), ['몽키 D. 루피', '보아 행콕', '샹크스', '포트거스 D. 에이스']);
  assert.ok(top4[3].count > r.top50ByCharacter[4].count, 'the top four are not tied with the fifth');
  assert.equal(top4.reduce((sum, c) => sum + c.count, 0), T.top4CharacterCards);
  assert.ok(section('3.').paragraphs[1].includes(`루피·행콕·샹크스·에이스가 상위 50개 중 ${T.top4CharacterCards}개(${T.top4CharacterPct}%)`));
});

test('the article makes no investment advice, prediction or fee claim', () => {
  assert.doesNotMatch(text, /투자 ?(추천|가치|하세요)|수익(을|이)? ?(낼|납니다|보장합니다|기대)|오를 (것|전망)|사두면|무조건|확실히 오릅|지금 사야|저평가/);
  assert.doesNotMatch(text, /감정비[^"]{0,12}(\$|¥|₩|\d+\s*(달러|엔|원))/);
  assert.doesNotMatch(text, /봉입률은 (약|대략)|\d+박스에 1장/);
  assert.match(text, /수익을 보장하지 않습니다/);
  assert.match(text, /한국판·영어판/);
});
