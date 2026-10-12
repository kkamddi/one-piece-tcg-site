import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { GLOSSARY_EDITORIAL as A, GLOSSARY_FAQ, GLOSSARY_PATH, GLOSSARY_SEO } from '../lib/glossary-editorial.js';
import { getGlossaryEntries } from './glossarySeo.js';

const text = JSON.stringify({ A, GLOSSARY_FAQ, GLOSSARY_SEO });
const fmt = (value) => value.toLocaleString('en-US');
const section = (prefix) => A.sections.find((s) => s.heading.startsWith(prefix));
const len = (value) => [...value].length;

const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
const KR = catalog.filter((card) => card.locale === 'KR');
// One entry per card number: parallels (_p1, _P2 ...) fold into their base number.
const base = (card) => card.cardNo.replace(/_p\d+$/i, '');
const countNumbers = (cards) => new Set(cards.map(base)).size;
const withEffect = (re) => countNumbers(KR.filter((card) => re.test(card.effect || '')));
const counterValue = (card) => Number(String(card.counter).replace('+', ''));
const characterCounter = (value) => countNumbers(KR.filter((card) => card.categoryKo === '캐릭터' && counterValue(card) === value));

// Table label -> how the count is recomputed. Spelling variants seen on older Korean printings are included.
const COUNTS = {
  '【블로커】': () => withEffect(/【블로커】|【블록커】/),
  '【속공】 (러시)': () => withEffect(/【속공】/),
  '【더블 어택】': () => withEffect(/【더블 어택】/),
  '【배니시】 (바니시)': () => withEffect(/【배니시】/),
  '카운터 +1000': () => characterCounter(1000),
  '카운터 +2000': () => characterCounter(2000),
  '【카운터】 이벤트': () => countNumbers(KR.filter((card) => card.categoryKo === '이벤트' && /【카운터】/.test(card.effect || ''))),
  '【등장 시】': () => withEffect(/【등장 시】/),
  '【기동: 메인】': () => withEffect(/【기동: ?메인】/),
  '【턴 1회】': () => withEffect(/【턴 ?1회】/),
  '【메인】': () => withEffect(/【메인】/),
  '【어택 시】': () => withEffect(/【어택 시】/),
  '【두웅!!×1】 등': () => withEffect(/【두웅[!‼]+ ?[×x]\d】/),
  '【KO 시】': () => withEffect(/【KO 시】/),
  '【자신의 턴 동안】': () => withEffect(/【자신의 턴 동안】/),
  '【상대의 턴 동안】': () => withEffect(/【상대의 턴 동안】/)
};
const countedSections = ['2.', '3.', '4.'].map(section);
const countedRows = countedSections.flatMap((s) => s.table.rows);

test('the article has the shared editorial shape', () => {
  assert.equal(GLOSSARY_PATH, '/guide/glossary');
  assert.match(A.heading, /원피스카드 용어 사전/);
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

test('every table row has one cell per column and short definitions', () => {
  for (const s of A.sections.filter((item) => item.table)) {
    const { columns, rows } = s.table;
    assert.ok(rows.length > 0 && rows.length <= 10, s.heading);
    rows.forEach((row) => {
      assert.equal(row.length, columns.length, `${s.heading}: ${row[0]}`);
      assert.ok(len(row[1]) <= 50, row[1]);
    });
    assert.equal(s.table.numeric, columns.length > 2, s.heading);
  }
});

test('bracket keywords use the wording printed on Korean cards', () => {
  const effects = KR.map((card) => card.effect || '').join('\n');
  const brackets = new Set(JSON.stringify(A.sections).match(/【[^】\s][^】]*】/g));
  assert.ok(brackets.size >= 15);
  brackets.forEach((keyword) => assert.ok(effects.includes(keyword), keyword));
  // Korean cards print 두웅!! for 돈!!, 속공 for 러시 and 배니시 for 바니시; the page names both.
  [['두웅!!', '돈!!'], ['속공', '러시'], ['배니시', '바니시']].forEach(([printed, common]) => {
    assert.ok(text.includes(printed) && text.includes(common), printed);
  });
  assert.ok(!effects.includes('【러시】') && !effects.includes('돈!!'));
});

test('keyword counts match the Korean card catalog', () => {
  assert.equal(countedRows.length, Object.keys(COUNTS).length + 1); // + the uncounted 【트리거】 row
  for (const row of countedRows) {
    if (row[0] === '【트리거】') {
      assert.equal(row[2], '집계 안 함');
      continue;
    }
    assert.ok(COUNTS[row[0]], row[0]);
    assert.equal(row[2], `${fmt(COUNTS[row[0]]())}종`, row[0]);
  }
  const total = `${fmt(countNumbers(KR))}`;
  const summary = new Map(A.summary.map((item) => [item.label, item.value]));
  assert.equal(summary.get('집계한 한글판 카드 번호'), `${total}종`);
  assert.equal(summary.get('【등장 시】가 적힌 카드'), `${fmt(COUNTS['【등장 시】']())}종`);
  assert.equal(summary.get('【블로커】가 적힌 카드'), `${fmt(COUNTS['【블로커】']())}종`);
  assert.equal(summary.get('카운터 +1000 캐릭터'), `${fmt(COUNTS['카운터 +1000']())}종`);
  assert.ok(section('6.').items[0].includes(`${total}개 번호`));
  // The time-of-use table is sorted by count so the most common keywords come first.
  const timing = section('4.').table.rows.map((row) => Number(row[2].replace(/\D/g, '')));
  assert.deepEqual(timing, [...timing].sort((a, b) => b - a));
});

test('only site guides and official rule pages are linked', () => {
  const hrefs = A.sections.flatMap((s) => (s.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^(\/guide\/(rules|getting-started|card-types|psa-grading|card-catalog)|https:\/\/(www\.|en\.)?onepiece-cardgame\.(com|kr)\/[\w./-]*)$/, href));
  ['/guide/rules', '/guide/getting-started', '/guide/card-types', '/guide/psa-grading'].forEach((href) => assert.ok(hrefs.includes(href), href));
  assert.ok(hrefs.some((href) => href.startsWith('https://onepiece-cardgame.kr/')));
  assert.ok(hrefs.some((href) => href.startsWith('https://www.onepiece-cardgame.com/')));
});

test('SEO entry, FAQ and search terms', () => {
  assert.match(GLOSSARY_SEO.title, /^원피스카드 용어 사전 - .*\| Card Pone$/);
  ['원피스카드 용어', '돈 카드 뜻', '블로커 뜻', '러시 뜻', '카운터 뜻', '트리거 뜻', '패러렐 뜻'].forEach((keyword) => assert.ok(GLOSSARY_SEO.keywords.includes(keyword), keyword));
  assert.ok(GLOSSARY_SEO.description.length <= 160);
  assert.equal(GLOSSARY_FAQ.length, 2);
  GLOSSARY_FAQ.forEach(([question, answer]) => {
    assert.match(question, /\?$/);
    assert.ok(answer.length > 0 && len(answer) <= 160, question);
  });
  const entries = getGlossaryEntries();
  assert.equal(entries.length, 1);
  const [{ pathname, seo }] = entries;
  assert.equal(pathname, GLOSSARY_PATH);
  assert.equal(seo.title, GLOSSARY_SEO.title);
  assert.equal(seo.schemaType, 'Article');
  assert.equal(seo.reviewedAt, A.reviewedAt);
  assert.deepEqual(seo.sections[0].stats, A.summary);
  assert.deepEqual(seo.sections.at(-1).items, A.checklist);
  assert.equal(seo.sections.length, A.sections.length + 2);
});

test('no shop names or investment talk', () => {
  assert.doesNotMatch(text, /카드성지|더카드룸/);
  assert.doesNotMatch(text, /수익|투자|재테크|시세 차익|오를|사두면|돈이 됩|무조건/);
  assert.doesNotMatch(text, /봉입률은 \d|\d+박스에 1장/);
});
