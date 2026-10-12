import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { LEADER_CARDS_EDITORIAL as A, LEADER_CARDS_FAQ, LEADER_CARDS_PATH, LEADER_CARDS_SEO } from '../lib/leader-cards-editorial.js';
import { getLeaderCardsEntries } from './leaderCardsSeo.js';
import { buildKoreanNameResolver } from '../lib/snkrdunk-trade-cards.js';
import { MANGA_COLLECTION_GROUPS } from '../src/data/collection-guide.js';

const text = JSON.stringify(A);
const yen = (value) => Number(String(value).replace(/[¥,]/g, ''));
const num = (value) => Number(String(value).replace(/[^\d.]/g, ''));
const fmt = (value) => value.toLocaleString('en-US');
const section = (prefix) => A.sections.find((s) => s.heading.startsWith(prefix));
const col = (table, name) => table.columns.indexOf(name);
const sum = (values) => values.reduce((total, value) => total + value, 0);

// ---- leader catalog recomputed from src/data/cards.json (JP rows, one per card number)
const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
const COLORS = { 빨강: ['赤', '적색', 'red'], 초록: ['緑', '녹색', 'green'], 파랑: ['青', '청색', 'blue'], 보라: ['紫', '자색', 'purple'], 검정: ['黒', '흑색', 'black'], 노랑: ['黄', '황색', 'yellow'] };
const ORDER = Object.keys(COLORS);
const baseNo = (card) => String(card.cardNo).split('_')[0];
const leaderMap = (locale) => {
  const map = new Map();
  catalog.filter((c) => c.locale === locale && c.category === 'LEADER').forEach((c) => { if (!map.has(baseNo(c))) map.set(baseNo(c), c); });
  return map;
};
const jp = leaderMap('JP');
const kr = leaderMap('KR');
const resolve = buildKoreanNameResolver(catalog);
const leaders = [...jp.values()].map((c) => ({
  code: baseNo(c),
  colors: ORDER.filter((name) => COLORS[name].some((alias) => String(c.color).toLowerCase().includes(alias))),
  life: Number(String(c.cost).match(/\d+/)[0]),
  ...(() => { const n = resolve(baseNo(c)); return { kr: n.kr || c.name, key: n.key }; })()
}));
const mono = leaders.filter((l) => l.colors.length === 1);
const dual = leaders.filter((l) => l.colors.length === 2);

test('the article has the shared editorial shape', () => {
  assert.equal(LEADER_CARDS_PATH, '/guide/leader-cards');
  assert.match(A.heading, /원피스카드 리더 카드/);
  assert.equal(A.reviewedAt, '2026-10-12');
  assert.equal(A.dataDate, '2026-10-12');
  assert.equal(A.paragraphs.length, 2);
  A.paragraphs.forEach((p) => assert.ok(p.length <= 80, p));
  assert.equal(A.summary.length, 4);
  A.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.equal(A.checklist.length, 3);
  A.checklist.forEach((item) => assert.ok(item.length <= 30, item));
  A.sections.forEach((s, index) => assert.ok(s.heading.startsWith(`${index + 1}. `), s.heading));
});

test('each section stays short: one lead, then exactly one table, list or image pair', () => {
  for (const s of A.sections) {
    assert.equal(s.paragraphs?.length, 1, s.heading);
    assert.ok(s.paragraphs[0].length <= 60, s.paragraphs[0]);
    const bodies = [s.table, s.items, s.images].filter(Boolean).length;
    assert.equal(bodies, 1, s.heading);
    if (s.items) {
      assert.ok(s.items.length <= 5, s.heading);
      s.items.forEach((item) => assert.ok(item.length <= 60, item));
    }
    if (s.images) {
      assert.ok(s.images.length <= 2, s.heading);
      s.images.forEach((image) => {
        assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/(JP|KR)\/[A-Z0-9-]+(_p\d+)?\.webp$/);
        assert.ok(image.alt && image.caption);
      });
    }
  }
  // Price method and caveats appear once, in the last section only.
  assert.equal((text.match(/보장하지 않습니다/g) || []).length, 1);
  assert.ok(A.sections.at(-1).items.some((item) => item.includes('보장하지 않습니다')));
  assert.doesNotMatch(JSON.stringify(A.sections.slice(0, -1)), /프로모|시리얼|한국판 가격|보장/);
});

test('every table row has one cell per column', () => {
  for (const s of A.sections.filter((item) => item.table)) {
    const { columns, rows } = s.table;
    assert.ok(rows.length > 0, s.heading);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${s.heading}: ${row.join('|')}`));
  }
});

test('leader totals match the JP catalog', () => {
  assert.equal(leaders.length, 143);
  assert.ok([...kr.keys(), ...leaderMap('EN').keys()].every((no) => jp.has(no)), 'every KR/EN leader is in the JP catalog');
  assert.ok(leaders.every((l) => l.colors.length >= 1 && l.colors.length <= 2 && Number.isFinite(l.life)));
  assert.equal(A.summary[0].value, `${leaders.length}장`);
  assert.ok(A.summary[0].label.includes(`한글판 ${kr.size}장`));
  assert.ok(LEADER_CARDS_SEO.title.includes(`${leaders.length}장`));
  assert.ok(A.heading.includes(`${leaders.length}장`));
  assert.ok(section('6.').items.some((item) => item.includes(`(${kr.size}장)`)));
});

test('color table and two-color combos are recomputed from cards.json', () => {
  const s1 = section('1.');
  assert.ok(s1.paragraphs[0].includes(`단색 ${mono.length}장, 2색 ${dual.length}장`));
  const t = s1.table;
  assert.deepEqual(t.rows.map((row) => row[0]), ORDER);
  t.rows.forEach(([color, m, d, total]) => {
    assert.equal(num(m), mono.filter((l) => l.colors[0] === color).length, color);
    assert.equal(num(d), dual.filter((l) => l.colors.includes(color)).length, color);
    assert.equal(num(total), num(m) + num(d), color);
  });
  assert.equal(sum(t.rows.map((row) => num(row[1]))), mono.length);
  assert.equal(sum(t.rows.map((row) => num(row[2]))), dual.length * 2);

  const combos = new Map();
  dual.forEach((l) => { const key = [...l.colors].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('·'); combos.set(key, (combos.get(key) || 0) + 1); });
  const c = section('2.').table;
  const listed = new Map();
  c.rows.forEach(([count, comboCount, names]) => {
    const list = names.split(', ');
    assert.equal(list.length, num(comboCount), count);
    list.forEach((name) => listed.set(name, num(count)));
  });
  assert.deepEqual(new Map([...listed].sort()), new Map([...combos].sort()));
  assert.equal(combos.size, 15);
  const [topCombo, topCount] = [...combos].sort((a, b) => b[1] - a[1])[0];
  assert.ok(section('2.').paragraphs[0].includes(`${combos.size}가지`) && section('2.').paragraphs[0].includes(`${topCombo}이 ${topCount}장`));
});

test('life table is recomputed from cards.json', () => {
  const t = section('3.').table;
  const lives = [...new Set(leaders.map((l) => l.life))].sort((a, b) => a - b);
  assert.deepEqual(t.rows.map((row) => num(row[0])), lives);
  t.rows.forEach((row) => {
    const list = leaders.filter((l) => l.life === num(row[0]));
    assert.equal(num(row[1]), list.length, row[0]);
    assert.equal(num(row[2]), list.filter((l) => l.colors.length === 1).length, row[0]);
    assert.equal(num(row[3]), list.filter((l) => l.colors.length === 2).length, row[0]);
    if (list.length <= 3) list.forEach((l) => assert.ok(row[4].includes(l.code), `${row[0]} ${l.code}`));
  });
  // "단색은 대부분 5, 2색은 대부분 4" and the 60 of 69 figure.
  const life5 = t.rows.find((row) => row[0] === '5');
  const life4 = t.rows.find((row) => row[0] === '4');
  assert.ok(num(life5[2]) > mono.length / 2 && num(life4[3]) > dual.length / 2);
  assert.ok(section('6.').items.some((item) => item.includes(`${dual.length}장 중 ${num(life4[3])}장이 라이프 4`)));
});

test('character table is recomputed from cards.json', () => {
  const byChar = new Map();
  leaders.forEach((l) => byChar.set(l.key, [...(byChar.get(l.key) || []), l]));
  const t = section('4.').table;
  assert.equal(sum(t.rows.map((row) => num(row[1]))), byChar.size);
  assert.equal(sum(t.rows.map((row) => num(row[0]) * num(row[1]))), leaders.length);
  t.rows.forEach(([count, people, names]) => {
    const group = [...byChar.values()].filter((list) => list.length === num(count));
    assert.equal(group.length, num(people), count);
    if (names !== '-') assert.deepEqual(names.split(', ').sort(), group.map((list) => list[0].kr).sort(), count);
  });
  const top = [...byChar.values()].sort((a, b) => b.length - a.length)[0];
  assert.equal(top[0].kr, '몽키 D. 루피');
  assert.equal(A.summary[1].value, `${top.length}장`);
  assert.ok(section('4.').paragraphs[0].includes(`${byChar.size}명`) && section('4.').paragraphs[0].includes(`루피가 ${top.length}장`));
});

test('the price table is ordered, real and follows the L-SP rule', () => {
  const t = section('5.').table;
  assert.equal(t.rows.length, 10);
  const price = col(t, 'Single');
  t.rows.forEach((row, i) => {
    assert.equal(row[0], String(i + 1));
    if (i) assert.ok(yen(row[price]) <= yen(t.rows[i - 1][price]), row[2]);
    assert.ok(jp.has(row[2]), `${row[2]} is a JP catalog leader`);
    assert.ok(row[3].startsWith('리더'), row[3]);
    assert.doesNotMatch(row[3], /망가/);
  });
  assert.equal(A.summary[2].value, t.rows[0][price]);
  assert.ok(A.summary[2].label.includes(t.rows[0][2]));
  const sp = t.rows.filter((row) => row[3] === '리더 SP').length;
  assert.ok(section('5.').paragraphs[0].startsWith(`10장 중 ${sp}장이`));
  // L-SP leader super parallels are not manga (user rule), and the curated manga list agrees.
  const manga = [...new Set(MANGA_COLLECTION_GROUPS.flatMap((g) => g.cards.map((c) => c.cardId)))];
  ['OP17-079', 'EB05-010'].forEach((code) => assert.ok(!manga.some((id) => id.startsWith(`JP::${code}`)), code));
  assert.ok(t.rows.some((row) => row[2] === 'OP17-079' && row[3] === '리더 슈퍼 패러렐'));
  assert.match(text, /OP17-079 리더 슈퍼 패러렐은 Manga Alt Art 표기여도 망가가 아닙니다/);
});

test('numbers match the saved analysis output when it is available', async (t) => {
  const file = new URL('../artifacts/content/leader-cards-analysis.json', import.meta.url);
  if (!existsSync(file)) return t.skip('analysis output is local only');
  const r = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(r.refDate, A.dataDate);
  assert.equal(r.catalog.jpLeaders, leaders.length);
  const P = r.prices;
  section('5.').table.rows.forEach((row, i) => {
    const c = P.top[i];
    assert.deepEqual(row, [String(c.rank), c.krName, c.code, c.versionLabel, `¥${fmt(c.single)}`, c.singleDate.slice(5)]);
  });
  assert.ok(section('5.').paragraphs[0].includes(`${P.topSpFromEb02}장이 엑스트라 부스터 Anime 25th collection`));
  const g = P.groups;
  assert.ok(section('7.').items.includes(`리더 Single 중앙값은 기본 ¥${fmt(g['기본'].median)}, 패러렐 ¥${fmt(g['패러렐'].median)}, SP ¥${fmt(g.SP.median)}입니다.`));
  assert.equal(g['망가'].count, 0, 'no leader item is counted as manga');
  assert.equal(A.summary[3].value, `${P.sameNumber.parallelRatioMedian}배`);
  const excluded = P.excluded.prize + P.excluded.promo + P.excluded.sealedOrDon;
  assert.ok(section('7.').items.includes(`대회 입상·시리얼·프로모 리더 ${excluded}개는 뺐습니다.`));
  assert.ok(P.lsp.some((x) => x.code === 'OP17-079' && /Manga Alt Art/.test(x.name)));
});

test('only site paths are linked', () => {
  const hrefs = A.sections.flatMap((s) => (s.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^\/(prices|cards|guide\/(card-types|price-ranking|starter-decks|card-price))$/));
  ['/guide/card-types', '/guide/price-ranking', '/guide/starter-decks', '/prices'].forEach((href) => assert.ok(hrefs.includes(href), href));
  const [entry] = getLeaderCardsEntries();
  entry.seo.links.forEach((href) => assert.match(href, /^\/[a-z/-]*$/));
  assert.doesNotMatch(JSON.stringify([A, LEADER_CARDS_FAQ, LEADER_CARDS_SEO]), /https?:\/\/(?!cards\.optcgkorea\.com\/)/);
});

test('FAQ has exactly two answers that agree with the article', () => {
  assert.equal(LEADER_CARDS_FAQ.length, 2);
  LEADER_CARDS_FAQ.forEach(([q, a]) => assert.ok(q.endsWith('?') && a.length > 20));
  assert.ok(LEADER_CARDS_FAQ[0][1].includes(`${leaders.length}장`) && LEADER_CARDS_FAQ[0][1].includes(`단색 ${mono.length}장, 2색 ${dual.length}장`));
  const first = section('5.').table.rows[0];
  assert.ok(LEADER_CARDS_FAQ[1][1].includes(first[2]) && LEADER_CARDS_FAQ[1][1].includes(first[4]));
});

test('the SEO entry carries the article', () => {
  const entries = getLeaderCardsEntries();
  assert.equal(entries.length, 1);
  const { pathname, seo } = entries[0];
  assert.equal(pathname, LEADER_CARDS_PATH);
  assert.match(seo.title, /^원피스카드 리더 카드 정리 - .+ \| Card Pone$/);
  ['원피스카드 리더 카드', '원피스카드 리더 종류', '원피스카드 리더 추천', '원피스카드 리더 시세'].forEach((k) => assert.ok(seo.keywords.includes(k), k));
  assert.equal(seo.schemaType, 'Article');
  assert.equal(seo.reviewedAt, A.reviewedAt);
  assert.equal(seo.heading, A.heading);
  assert.deepEqual(seo.sections.slice(1, -1), A.sections);
  assert.deepEqual(seo.faq, LEADER_CARDS_FAQ);
});

test('the article makes no investment advice and names no other shop', () => {
  const all = JSON.stringify([A, LEADER_CARDS_FAQ, LEADER_CARDS_SEO]);
  assert.doesNotMatch(all, /투자 ?(추천|가치|하세요)|수익(을|이)? ?(낼|납니다|보장합니다|기대)|오를 (것|전망)|사두면|무조건|확실히 오릅|지금 사야|저평가|돈이 됩/);
  assert.doesNotMatch(all, /카드성지|더카드룸/);
  assert.match(text, /보장하지 않습니다/);
  assert.match(text, /일본판 SNKRDUNK/);
});
