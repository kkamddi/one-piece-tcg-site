import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { COLORS_EDITORIAL as A, COLORS_FAQ, COLORS_PATH, COLORS_SEO } from '../lib/colors-editorial.js';
import { getColorsEntries } from './colorsSeo.js';

const text = JSON.stringify({ A, COLORS_FAQ, COLORS_SEO });
const fmt = (value) => value.toLocaleString('en-US');
const section = (prefix) => A.sections.find((s) => s.heading.startsWith(prefix));
const len = (value) => [...value].length;

const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
const KR = catalog.filter((card) => card.locale === 'KR');
// One entry per card number: parallels (_p1, _P2 ...) fold into their base number, as in the glossary guide.
const base = (card) => card.cardNo.replace(/_p\d+$/i, '');
const countNumbers = (cards) => new Set(cards.map(base)).size;

// Single-color cards store English names, multi-color cards Korean names (plus a "다색" tag).
const COLOR_NAMES = { Red: '빨강', 적색: '빨강', Green: '초록', 녹색: '초록', Blue: '파랑', 청색: '파랑', Purple: '보라', 자색: '보라', Black: '검정', 흑색: '검정', Yellow: '노랑', 황색: '노랑' };
const COLORS = ['빨강', '초록', '파랑', '보라', '검정', '노랑'];
const colorsOf = (card) => String(card.color || '').split(',').map((token) => COLOR_NAMES[token.trim()]).filter(Boolean);

// Card type per number: the first non-empty Korean category; two numbers have none on any Korean printing and
// take the Japanese printing's category (OP06-117 stage, ST04-013 character).
const categoryOf = new Map();
KR.forEach((card) => { if (!categoryOf.get(base(card)) && card.categoryKo) categoryOf.set(base(card), card.categoryKo); });
KR.forEach((card) => {
  const number = base(card);
  if (categoryOf.get(number)) return;
  const jp = catalog.find((other) => other.locale === 'JP' && other.cardNo === number && other.categoryKo);
  categoryOf.set(number, jp?.categoryKo || '');
});
const typeIs = (type) => (card) => categoryOf.get(base(card)) === type;

// Some Korean rows print full-width digits (４) or "-" for an empty value.
const num = (value) => {
  const digits = String(value ?? '').normalize('NFKC').replace('+', '').trim();
  return /^\d+$/.test(digits) ? Number(digits) : null;
};
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const pct = (count, total) => `${Math.round((count / total) * 100)}%`;
const withPct = (count, total) => `${count} (${pct(count, total)})`;

const ofColor = (color) => KR.filter((card) => colorsOf(card).includes(color));
const total = (color) => countNumbers(ofColor(color));
const withEffect = (color, re) => countNumbers(ofColor(color).filter((card) => re.test(card.effect || '')));
const characters = (color) => {
  const first = new Map();
  ofColor(color).filter(typeIs('캐릭터')).forEach((card) => { if (!first.has(base(card))) first.set(base(card), card); });
  return [...first.values()];
};

const KEYWORDS = {
  '【블로커】': /【블로커】|【블록커】/,
  '【속공】': /【속공】/,
  '【더블 어택】': /【더블 어택】/,
  '【배니시】': /【배니시】/
};
// Effect phrases checked for section 4 (Korean card wording; 두웅‼ appears on some printings).
const PHRASES = {
  '파워 -N': /파워 ?-\d/,
  '레스트로 한다': /레스트로 (한다|할)/,
  '두웅!!을 N장까지 액티브로': /두웅[!‼]+을 \d장까지 액티브로/,
  '주인의 패로 되돌린다': /주인의 패로 되돌/,
  '주인의 덱 맨 아래로': /주인의 덱 맨 아래/,
  '두웅!!-N': /두웅[!‼]+ ?-\d/,
  '두웅!! 덱에서 추가': /두웅[!‼]+ 덱에서/,
  '코스트 -N': /코스트 ?-\d/,
  '트래시에서': /트래시에서/,
  '라이프': /라이프/,
  'KO 시킨다': /KO ?시(킨다|킬|키고|키거나|켰|킨)/,
  '카드를 N장 뽑는다': /카드를 \d장 뽑/,
  '파워 +N': /파워 ?\+\d/,
  '버린다': /버린다/
};
const ranked = (re) => COLORS
  .map((color) => ({ color, count: withEffect(color, re), share: withEffect(color, re) / total(color) }))
  .sort((a, b) => b.share - a.share);

test('the article has the shared editorial shape', () => {
  assert.equal(COLORS_PATH, '/guide/colors');
  assert.match(A.heading, /원피스카드 색깔별 특징/);
  assert.equal(A.reviewedAt, '2026-10-12');
  assert.equal(A.dataDate, '2026-10-12');
  assert.equal(A.paragraphs.length, 2);
  A.paragraphs.forEach((p) => assert.ok(len(p) <= 80, p));
  assert.equal(A.summary.length, 4);
  A.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.ok(A.sections.length >= 5 && A.sections.length <= 6);
  A.sections.forEach((s, index) => assert.match(s.heading, new RegExp(`^${index + 1}\\. `)));
  assert.equal(A.checklist.length, 3);
  A.checklist.forEach((item) => assert.ok(len(item) <= 30, item));
});

test('sections stay short and use one main element each', () => {
  A.sections.forEach((s) => {
    assert.equal((s.paragraphs || []).length, 1, s.heading);
    assert.ok(len(s.paragraphs[0]) <= 60, s.paragraphs[0]);
    const elements = ['table', 'items', 'bars', 'images'].filter((key) => s[key]);
    assert.deepEqual(elements.length, 1, s.heading);
    if (s.items) {
      assert.ok(s.items.length <= 5, s.heading);
      s.items.forEach((item) => assert.ok(len(item) <= 60, item));
    }
  });
});

test('every table row has one cell per column and fits a phone', () => {
  for (const s of A.sections.filter((item) => item.table)) {
    const { columns, rows } = s.table;
    assert.ok(columns.length <= 7, s.heading);
    assert.ok(rows.length > 0 && rows.length <= 10, s.heading);
    rows.forEach((row) => {
      assert.equal(row.length, columns.length, `${s.heading}: ${row[0]}`);
      row.forEach((cell) => assert.ok(len(cell) <= 20, cell));
      assert.ok(COLORS.includes(row[0]), row[0]);
    });
    assert.equal(s.table.numeric, columns.length > 2, s.heading);
  }
});

test('bracket keywords use the wording printed on Korean cards', () => {
  const effects = KR.map((card) => card.effect || '').join('\n');
  const brackets = new Set(JSON.stringify(A.sections).match(/【[^】\s][^】]*】/g));
  assert.ok(brackets.size >= 5);
  brackets.forEach((keyword) => assert.ok(effects.includes(keyword), keyword));
  assert.ok(text.includes('두웅!!') && !text.includes('돈!!'));
  // Every phrase in section 4 is matched somewhere in the Korean effect text.
  section('4.').table.rows.forEach((row) => assert.ok(PHRASES[row[1]], row[1]));
});

test('card counts and types per color match the Korean catalog', () => {
  const rows = section('1.').table.rows;
  assert.deepEqual(rows.map((row) => row[0]), COLORS);
  for (const [color, cards, leaders, chars, events, stages] of rows) {
    const all = ofColor(color);
    const n = total(color);
    const leaderCards = all.filter(typeIs('리더'));
    assert.equal(cards, `${fmt(n)}종`, color);
    assert.equal(leaders, `${countNumbers(leaderCards)} (2색 ${countNumbers(leaderCards.filter((card) => colorsOf(card).length > 1))})`, color);
    assert.equal(chars, withPct(countNumbers(all.filter(typeIs('캐릭터'))), n), color);
    assert.equal(events, withPct(countNumbers(all.filter(typeIs('이벤트'))), n), color);
    assert.equal(stages, withPct(countNumbers(all.filter(typeIs('스테이지'))), n), color);
  }
  // Only leaders carry two colors in the Korean catalog, which the lead says.
  const multi = KR.filter((card) => colorsOf(card).length > 1);
  assert.ok(multi.every(typeIs('리더')));
  assert.ok(KR.every((card) => colorsOf(card).length >= 1));
  assert.match(section('1.').paragraphs[0], /2색 카드는 모두 리더/);
});

test('character cost, power and counter match the Korean catalog', () => {
  const rows = section('2.').table.rows;
  assert.deepEqual(rows.map((row) => row[0]), COLORS);
  const costs = {};
  for (const [color, count, cost, power, counter2000, noCounter] of rows) {
    const chars = characters(color);
    assert.equal(count, `${chars.length}종`, color);
    costs[color] = average(chars.map((card) => num(card.cost)).filter((v) => v !== null));
    assert.equal(cost, (Math.round(costs[color] * 10) / 10).toFixed(1), color);
    const avgPower = average(chars.map((card) => num(card.power)).filter((v) => v !== null));
    assert.equal(power, fmt(Math.round(avgPower / 10) * 10), color);
    assert.equal(counter2000, withPct(chars.filter((card) => num(card.counter) === 2000).length, chars.length), color);
    assert.equal(noCounter, withPct(chars.filter((card) => !num(card.counter)).length, chars.length), color);
  }
  const lowest = Object.entries(costs).sort((a, b) => a[1] - b[1])[0][0];
  assert.ok(section('2.').paragraphs[0].includes(`${lowest}의 평균 코스트가 가장 낮`));
});

test('keyword shares match the Korean catalog', () => {
  const { columns, rows } = section('3.').table;
  assert.deepEqual(rows.map((row) => row[0]), COLORS);
  for (const row of rows) {
    const color = row[0];
    columns.slice(1, 5).forEach((keyword, index) => {
      assert.equal(row[index + 1], withPct(withEffect(color, KEYWORDS[keyword]), total(color)), `${color} ${keyword}`);
    });
    const counterEvents = countNumbers(ofColor(color).filter((card) => typeIs('이벤트')(card) && /【카운터】/.test(card.effect || '')));
    assert.equal(row[5], withPct(counterEvents, total(color)), `${color} 【카운터】 이벤트`);
  }
  assert.equal(columns[5], '【카운터】 이벤트');
  assert.equal(ranked(KEYWORDS['【속공】'])[0].color, '빨강');
  assert.match(section('3.').paragraphs[0], /【속공】은 빨강이 가장 많/);
});

test('section 4 lists exactly the phrases one color uses at least twice as often as every other color', () => {
  const expected = [];
  for (const [label, re] of Object.entries(PHRASES)) {
    const [top, next] = ranked(re);
    if (top.share >= next.share * 2) expected.push([top.color, label, `${top.count}종 (${pct(top.count, total(top.color))})`, `${next.color} ${pct(next.count, total(next.color))}`]);
  }
  expected.sort((a, b) => COLORS.indexOf(a[0]) - COLORS.indexOf(b[0]));
  assert.deepEqual(section('4.').table.rows, expected);
  // Every color gets at least one phrase; KO and card draw stay out because the gap is under 2x.
  COLORS.forEach((color) => assert.ok(expected.some((row) => row[0] === color), color));
  assert.ok(!expected.some((row) => row[1] === 'KO 시킨다' || row[1] === '카드를 N장 뽑는다'));
});

test('summary, notes and FAQ numbers match the Korean catalog', () => {
  const totalNumbers = fmt(countNumbers(KR));
  const leaders = KR.filter(typeIs('리더'));
  const leaderCount = countNumbers(leaders);
  const multiLeaders = countNumbers(leaders.filter((card) => colorsOf(card).length > 1));
  const summary = new Map(A.summary.map((item) => [item.label, item.value]));
  assert.equal(summary.get('집계한 한글판 카드 번호'), `${totalNumbers}종`);
  assert.equal(summary.get(`한글판 리더 (2색 ${multiLeaders}종)`), `${leaderCount}종`);
  assert.equal(summary.get('보라 카드 중 두웅!!-N 문구'), pct(withEffect('보라', PHRASES['두웅!!-N']), total('보라')));
  assert.equal(summary.get('노랑 카드 중 라이프 문구'), pct(withEffect('노랑', PHRASES['라이프']), total('노랑')));

  const [ko, draw, scope, trigger] = section('5.').items;
  const koRank = ranked(PHRASES['KO 시킨다']);
  assert.equal(koRank[0].color, '검정');
  assert.ok(ko.includes(`검정이 ${pct(koRank[0].count, total('검정'))}로 가장 많`), ko);
  ['빨강', '초록', '보라', '노랑'].forEach((color) => {
    const share = withEffect(color, PHRASES['KO 시킨다']) / total(color);
    assert.ok(share >= 0.09 && share <= 0.12, color); // "10% 안팎"
  });
  const drawRank = ranked(PHRASES['카드를 N장 뽑는다']);
  assert.ok(draw.includes(`${drawRank[0].color} ${pct(drawRank[0].count, total(drawRank[0].color))}, ${drawRank[1].color} ${pct(drawRank[1].count, total(drawRank[1].color))}`), draw);
  assert.ok(drawRank[0].share < drawRank[1].share * 2);
  assert.ok(scope.includes(`${totalNumbers}개 번호`));
  assert.ok(trigger.includes('【트리거】') && trigger.includes('집계 안 함'));
  assert.match(section('5.').paragraphs[0], /덱의 강함과는 관계없/);

  assert.ok(COLORS_FAQ[1][1].includes(`리더 ${leaderCount}종 중 ${multiLeaders}종이 2색`));
  // The first FAQ names exactly the first section-4 phrase of each color.
  const firstPhrase = COLORS.map((color) => section('4.').table.rows.find((row) => row[0] === color));
  firstPhrase.forEach(([color, label]) => {
    assert.ok([`${color}은 ${label}`, `${color}는 ${label}`].some((phrase) => COLORS_FAQ[0][1].includes(phrase)), `${color} ${label}`);
  });
});

test('only site guides and official card pages are linked', () => {
  const hrefs = A.sections.flatMap((s) => (s.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^(\/guide\/(leader-cards|starter-decks|glossary|rules)|https:\/\/(www\.|en\.)?onepiece-cardgame\.(com|kr)\/[\w./-]*)$/, href));
  ['/guide/leader-cards', '/guide/starter-decks', '/guide/glossary', '/guide/rules'].forEach((href) => assert.ok(hrefs.includes(href), href));
});

test('SEO entry, FAQ and search terms', () => {
  assert.match(COLORS_SEO.title, /^원피스카드 색깔별 특징 - .*\| Card Pone$/);
  ['원피스카드 색 추천', '원피스카드 색깔별 특징', '원피스카드 빨강 덱', '원피스카드 초록 덱'].forEach((keyword) => assert.ok(COLORS_SEO.keywords.includes(keyword), keyword));
  assert.ok(len(COLORS_SEO.description) <= 160);
  assert.ok(COLORS_SEO.description.includes(`${fmt(countNumbers(KR))}종`));
  assert.equal(COLORS_FAQ.length, 2);
  COLORS_FAQ.forEach(([question, answer]) => {
    assert.match(question, /\?$/);
    assert.ok(answer.length > 0 && len(answer) <= 160, question);
  });
  const entries = getColorsEntries();
  assert.equal(entries.length, 1);
  const [{ pathname, seo }] = entries;
  assert.equal(pathname, COLORS_PATH);
  assert.equal(seo.title, COLORS_SEO.title);
  assert.equal(seo.schemaType, 'Article');
  assert.equal(seo.reviewedAt, A.reviewedAt);
  assert.deepEqual(seo.sections[0].stats, A.summary);
  assert.deepEqual(seo.sections.at(-1).items, A.checklist);
  assert.equal(seo.sections.length, A.sections.length + 2);
});

test('no shop names, investment or tier talk', () => {
  assert.doesNotMatch(text, /카드성지|더카드룸/);
  assert.doesNotMatch(text, /수익|투자|재테크|시세|오를|사두면|돈이 됩|무조건/);
  assert.doesNotMatch(text, /티어|tier|메타|최강|강덱|사기 카드|1군|op 카드/i);
});
