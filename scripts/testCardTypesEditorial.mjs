import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { CARD_TYPES_EDITORIAL as A } from '../lib/card-types-editorial.js';
import { MANGA_COLLECTION_GROUPS } from '../src/data/collection-guide.js';

const text = JSON.stringify(A);
const yen = (value) => Number(String(value).replace(/[¥,]/g, ''));
const num = (value) => Number(String(value).replace(/[^\d.]/g, ''));
const fmt = (value) => value.toLocaleString('en-US');
const section = (prefix) => A.sections.find((s) => s.heading.startsWith(prefix));
const priceTable = section('3.').table;
const col = (table, name) => table.columns.indexOf(name);
const priceRows = new Map(priceTable.rows.map((row) => [row[0], row]));
const BASE_ROWS = ['C·UC', 'R', 'SR', 'SEC', '리더'];
// Table label -> analysis byKind key.
const KIND = {
  'C·UC': 'c_uc', R: 'r', SR: 'sr', SEC: 'sec', 리더: 'leader', 'C·UC·R 패러렐': 'low_p', 'SR 패러렐': 'sr_p',
  'SEC 패러렐': 'sec_p', '리더 패러렐': 'leader_p', SP: 'sp', 망가: 'manga', 프로모: 'promo', '돈!! 카드': 'don'
};

test('the article has the shared editorial shape', () => {
  assert.match(A.heading, /원피스카드/);
  assert.match(A.heading, /종류|레어도/);
  assert.equal(A.reviewedAt, '2026-10-09');
  assert.equal(A.dataDate, '2026-10-09');
  assert.equal(A.paragraphs.length, 1);
  assert.equal(A.summary.length, 4);
  A.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.equal(A.checklist.length, 3);
  assert.ok(A.sections.length >= 4 && A.sections.length <= 5);
  A.sections.forEach((s, index) => assert.match(s.heading, new RegExp(`^${index + 1}\\. `)));
  assert.ok(A.sections.some((s) => s.table));
  const images = A.sections.flatMap((s) => s.images || []);
  assert.ok(images.length >= 1 && images.length <= 3);
  images.forEach((image) => {
    assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/JP\/[A-Z0-9-]+_p\d+\.webp$/);
    assert.ok(image.alt && image.caption);
  });
});

test('sections stay short and use one main element each', () => {
  A.sections.forEach((s) => {
    assert.ok((s.paragraphs || []).length <= 1, s.heading);
    const elements = ['table', 'items', 'bars'].filter((key) => s[key]);
    // The versions section pairs its images with one small table; every other section has exactly one element.
    assert.equal(elements.length, 1, s.heading);
    if (s.images) assert.ok(s.table && s.table.rows.length <= 4, s.heading);
    assert.ok((s.items || []).length <= 4, s.heading);
  });
  // Caveats appear once, at the end, and the checklist does not repeat them.
  assert.equal((text.match(/보장하지 않습니다/g) || []).length, 1);
  assert.ok(A.sections.at(-1).items.some((item) => /보장하지 않습니다/.test(item)));
  assert.doesNotMatch(A.checklist.join(' '), /일본판|한국판|보장/);
});

test('every table row has one cell per column', () => {
  for (const s of A.sections.filter((item) => item.table)) {
    const { columns, rows } = s.table;
    assert.ok(rows.length > 0);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${s.heading}: ${row[0]}`));
  }
});

test('summary agrees with the price table', () => {
  const median = col(priceTable, 'Single 중앙값');
  const summary = new Map(A.summary.map((item) => [item.label, item.value]));
  assert.equal(summary.get('SP Single 중앙값'), priceRows.get('SP')[median]);
  assert.equal(summary.get('망가 Single 중앙값'), priceRows.get('망가')[median]);
  const bases = BASE_ROWS.map((label) => yen(priceRows.get(label)[median]));
  assert.equal(summary.get('기본 C·UC·R·SR·SEC·리더 Single 중앙값'), `¥${fmt(Math.min(...bases))}~${fmt(Math.max(...bases))}`);
  assert.ok(A.sections.at(-1).items[0].includes(summary.get('집계한 일본판 카드 상품')));
  priceTable.rows.forEach((row) => {
    const [lo, hi] = row[col(priceTable, '중간 50%')].split('~').map(yen);
    assert.ok(lo <= yen(row[median]) && yen(row[median]) <= hi, row[0]);
  });
});

test('the manga rule and images follow the curated manga list', async () => {
  const manga = new Set(MANGA_COLLECTION_GROUPS.flatMap((g) => g.cards.map((c) => c.cardId)));
  ['EB05-010', 'EB04-061'].forEach((code) => {
    assert.ok(text.includes(code), code);
    assert.ok(![...manga].some((id) => id.startsWith(`JP::${code}`)), `${code} must not be in the manga list`);
  });
  assert.match(text, /망가로 세지 않았습니다/);
  const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
  const ids = new Set(catalog.filter((c) => c.locale === 'JP').map((c) => c.id));
  for (const image of section('2.').images) {
    const id = `JP::${image.src.match(/\/cards\/JP\/(.+)\.webp$/)[1]}`;
    assert.ok(ids.has(id), id);
    assert.equal(manga.has(id), image.caption.includes('망가'), id);
  }
});

test('only known site paths are linked', () => {
  const hrefs = A.sections.flatMap((s) => (s.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^\/(prices|guide\/(collection\/manga|price-ranking|psa-grading|card-catalog|character-cards))(\/product\/\d+\?code=[A-Z0-9-]+)?$/));
  ['/guide/character-cards', '/guide/card-catalog', '/prices'].forEach((href) => assert.ok(hrefs.includes(href), href));
});

test('numbers match the saved analysis output when it is available', async (t) => {
  const file = new URL('../artifacts/content/card-types-analysis.json', import.meta.url);
  if (!existsSync(file)) return t.skip('analysis output is local only');
  const r = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(r.refDate, A.dataDate);
  assert.equal(num(A.summary[0].value), r.all.withSingle);

  for (const row of priceTable.rows) {
    const k = r.byKind[KIND[row[0]]];
    assert.ok(k, row[0]);
    assert.equal(num(row[1]), k.withSingle, row[0]);
    assert.equal(yen(row[2]), k.singleMedianJpy, row[0]);
    assert.equal(row[3], `¥${fmt(k.singleQ1Jpy)}~${fmt(k.singleQ3Jpy)}`, row[0]);
  }
  const caveats = section('4.').items.join(' ');
  assert.ok(caveats.includes(`${r.byKind.prize.withSingle}개`));
  assert.ok(caveats.includes(fmt(r.all.withSingle)));
  const tr = section('1.').table.rows.find((row) => row[0] === 'TR')[1];
  r.small.tr.forEach((item) => assert.ok(tr.includes(item.code), item.code));
  assert.ok(tr.includes(`${r.small.tr.length}장`));

  const sn = r.sameNumber;
  const parallels = [sn.sr_p.ratioMedian, sn.sec_p.ratioMedian, sn.leader_p.ratioMedian];
  const s3 = section('3.').paragraphs.join(' ');
  assert.ok(s3.includes(`${Math.min(...parallels)}~${Math.max(...parallels)}배`));
  assert.ok(s3.includes(`SP는 ${sn.sp.ratioMedian}배(${sn.sp.pairs}개 번호`));
  // The manga multiple lives on /guide/character-cards (different basis); this page must not show a second figure.
  assert.doesNotMatch(text, /망가는 [\d.]+배/);
  assert.doesNotMatch(text, new RegExp(`${sn.manga.ratioMedian}배`));
  assert.ok(section('3.').links.some((link) => link.href === '/guide/character-cards'));

  // OP05-119 example: the lead names the base SEC, the image captions the parallel and manga, all traded on 10/3.
  const ex = r.examples['OP05-119'];
  const byCard = new Map(ex.filter((item) => item.cardId).map((item) => [item.cardId, item]));
  const s2 = section('2.');
  const base = byCard.get('JP::OP05-119');
  assert.equal(base.singleDate, '2026-10-03');
  assert.ok(s2.paragraphs[0].includes(`¥${fmt(base.single)}`) && s2.paragraphs[0].includes('10월 3일'));
  for (const image of s2.images) {
    const item = byCard.get(`JP::${image.src.match(/\/cards\/JP\/(.+)\.webp$/)[1]}`);
    assert.ok(item, image.src);
    assert.equal(item.singleDate, '2026-10-03');
    assert.ok(image.caption.includes(`¥${fmt(item.single)}`), image.caption);
  }
  const linked = s2.links.map((link) => Number(link.href.match(/product\/(\d+)/)[1]));
  linked.forEach((id) => assert.ok(ex.some((item) => item.apparelId === id && item.cardId), String(id)));
});

test('the article makes no investment or profit promise', () => {
  assert.doesNotMatch(text, /수익 보장|확실한 수익|무조건|반드시 (오릅|올라)|투자 ?(추천|가치|하세요)|돈이 됩|사두면/);
  assert.match(text, /보장하지 않습니다/);
  assert.match(text, /일본판/);
  assert.doesNotMatch(text, /봉입률은|\d+박스에 1장/);
});
