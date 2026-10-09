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
const priceTable = section('5.').table;
const catalogTable = section('4.').table;
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
  assert.equal(A.paragraphs.length, 2);
  assert.equal(A.summary.length, 4);
  A.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.ok(A.checklist.length >= 3);
  A.sections.forEach((s, index) => assert.match(s.heading, new RegExp(`^${index + 1}\\. `)));
  assert.ok(A.sections.some((s) => s.table));
  assert.ok(A.sections.some((s) => s.bars));
  const images = A.sections.flatMap((s) => s.images || []);
  assert.ok(images.length >= 1 && images.length <= 3);
  images.forEach((image) => {
    assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/JP\/[A-Z0-9-]+_p\d+\.webp$/);
    assert.ok(image.alt && image.caption);
  });
});

test('every table row has one cell per column', () => {
  for (const s of A.sections.filter((item) => item.table)) {
    const { columns, rows } = s.table;
    assert.ok(rows.length > 0);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${s.heading}: ${row[0]}`));
  }
});

test('summary and bars agree with the price table', () => {
  const median = col(priceTable, 'Single 중앙값');
  const summary = new Map(A.summary.map((item) => [item.label, item.value]));
  assert.equal(summary.get('SP Single 중앙값'), priceRows.get('SP')[median]);
  assert.equal(summary.get('망가 Single 중앙값'), priceRows.get('망가')[median]);
  const bases = BASE_ROWS.map((label) => yen(priceRows.get(label)[median]));
  assert.equal(summary.get('기본 C·UC·R·SR·SEC·리더 Single 중앙값'), `¥${fmt(Math.min(...bases))}~${fmt(Math.max(...bases))}`);
  assert.match(A.paragraphs[1], new RegExp(summary.get('집계한 일본판 카드 상품')));

  const { bars } = section('6.');
  bars.forEach((bar) => {
    assert.equal(bar.display, `¥${fmt(bar.value)}`);
    assert.equal(yen(priceRows.get(bar.label)[median]), bar.value, bar.label);
  });
  assert.deepEqual(bars.map((bar) => bar.value), [...bars.map((bar) => bar.value)].sort((a, b) => b - a));
  priceTable.rows.forEach((row) => {
    const [lo, hi] = row[col(priceTable, '중간 50%')].split('~').map(yen);
    assert.ok(lo <= yen(row[median]) && yen(row[median]) <= hi, row[0]);
  });
});

test('the manga rule and images follow the curated manga list', async () => {
  const manga = new Set(MANGA_COLLECTION_GROUPS.flatMap((g) => g.cards.map((c) => c.cardId)));
  ['EB05-010', 'OP17-079', 'EB04-061', 'OP17-118'].forEach((code) => {
    assert.ok(text.includes(code), code);
    assert.ok(![...manga].some((id) => id.startsWith(`JP::${code}`)), `${code} must not be in the manga list`);
  });
  assert.match(text, /망가로 세지 않았습니다/);
  const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
  const ids = new Set(catalog.filter((c) => c.locale === 'JP').map((c) => c.id));
  for (const image of section('3.').images) {
    const id = `JP::${image.src.match(/\/cards\/JP\/(.+)\.webp$/)[1]}`;
    assert.ok(ids.has(id), id);
    assert.equal(manga.has(id), image.caption.includes('망가'), id);
  }
});

test('only known site paths are linked', () => {
  const hrefs = A.sections.flatMap((s) => (s.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^\/(prices|guide\/(collection\/manga|price-ranking|psa-grading|card-catalog|character-cards))(\/product\/\d+\?code=[A-Z0-9-]+)?$/));
  ['/guide/collection/manga', '/guide/price-ranking', '/guide/psa-grading', '/guide/card-catalog', '/prices'].forEach((href) => assert.ok(hrefs.includes(href), href));
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
    assert.equal(row[4], `${k.psa10RecordSharePct}%`, row[0]);
    assert.equal(row[5], `${k.singleWithin30Pct}%`, row[0]);
  }
  const s5 = section('5.').items.join(' ');
  for (const key of ['leader_sp', 'crew_sp', 'tr']) {
    r.small[key].forEach((item) => assert.ok(s5.includes(`${item.code} ¥${fmt(item.single)}`), item.code));
  }
  const prize = r.byKind.prize;
  assert.ok(s5.includes(`${prize.withSingle}개`) && s5.includes(`¥${fmt(prize.singleMedianJpy)}`) && s5.includes(`¥${fmt(prize.singleQ1Jpy)}~${fmt(prize.singleQ3Jpy)}`));
  const cat = r.byCategory;
  assert.ok(s5.includes(`리더 ¥${fmt(cat.LEADER.singleMedianJpy)}(${cat.LEADER.withSingle}개)`));
  assert.ok(s5.includes(`캐릭터 ¥${fmt(cat.CHARACTER.singleMedianJpy)}(${fmt(cat.CHARACTER.withSingle)}개)`));
  assert.ok(s5.includes(`이벤트 ¥${fmt(cat.EVENT.singleMedianJpy)}(${cat.EVENT.withSingle}개)`));
  assert.ok(s5.includes(`스테이지는 ${cat.STAGE.withSingle}개`));
  assert.ok(s5.includes(`절반 이상이 ¥${fmt(r.byKind.sr.singleMedianJpy)} 이하`));

  const RARITY = { L: 'L', SEC: 'SEC', SR: 'SR', R: 'R', UC: 'UC', C: 'C', P: 'P', SP: 'SP', TR: 'TR' };
  for (const row of catalogTable.rows) {
    const jp = r.catalog.JP.byRarity[RARITY[row[0]]] || { base: 0, parallel: 0 };
    const kr = r.catalog.KR.byRarity[RARITY[row[0]]] || { base: 0, parallel: 0 };
    assert.deepEqual(row.slice(1).map(num), [jp.base, jp.parallel, kr.base, kr.parallel], row[0]);
  }
  const jpCat = r.catalog.JP.byCategory;
  assert.ok(section('4.').items[0].includes(`캐릭터 ${fmt(jpCat.CHARACTER.cardNumbers)}개, 이벤트 ${jpCat.EVENT.cardNumbers}개, 리더 ${jpCat.LEADER.cardNumbers}개, 스테이지 ${jpCat.STAGE.cardNumbers}개`));
  assert.ok(r.catalog.JP.series.includes('OP17') && !r.catalog.KR.series.includes('OP15'));

  const sn = r.sameNumber;
  const parallels = [sn.sr_p.ratioMedian, sn.sec_p.ratioMedian, sn.leader_p.ratioMedian];
  const s6 = section('6.').items.join(' ');
  assert.ok(s6.includes(`${Math.min(...parallels)}~${Math.max(...parallels)}배`));
  assert.ok(s6.includes(`SP는 ${sn.sp.ratioMedian}배(${sn.sp.pairs}개 번호)`));
  // The manga multiple lives on /guide/character-cards (different basis); this page must not show a second figure.
  assert.ok(!s6.includes('망가는') || !/망가는 [\d.]+배/.test(s6));
  assert.ok(s6.includes(`망가 ${r.byKind.manga.withSingle}개는 모두`) && r.byKind.manga.over10000Pct === 100);
  assert.ok(s6.includes(`SP도 ${r.byKind.sp.over10000Pct}%`));

  const ex = new Map(r.examples['OP05-119'].map((item) => [item.apparelId, item]));
  const s7 = section('7.');
  const linked = s7.links.map((link) => Number(link.href.match(/product\/(\d+)/)[1]));
  linked.forEach((id, i) => {
    const item = ex.get(id);
    assert.ok(item, String(id));
    assert.equal(item.singleDate, '2026-10-03');
    assert.ok(s7.items[i].includes(`¥${fmt(item.single)}`), String(id));
  });
  const sps = r.examples['OP05-119'].filter((item) => item.kind === 'SP' && item.single).map((item) => item.single);
  assert.ok(s7.items[3].includes(`¥${fmt(Math.min(...sps))}~${fmt(Math.max(...sps))}`));
});

test('the article makes no investment or profit promise', () => {
  assert.doesNotMatch(text, /수익 보장|확실한 수익|무조건|반드시 (오릅|올라)|투자 ?(추천|가치|하세요)|돈이 됩|사두면/);
  assert.match(text, /보장하지 않습니다/);
  assert.match(text, /일본판/);
  assert.doesNotMatch(text, /봉입률은|\d+박스에 1장/);
});
