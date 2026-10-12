import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  STARTER_DECKS_PATH,
  STARTER_DECK_LIST_PRICE,
  buildStarterDecksEditorial,
  collectStarterDecks,
  compressCodes,
  getStarterDeckStats,
  getStarterDecksFaq,
  getStarterDecksSeo,
  parseColors
} from '../lib/starter-decks-editorial.js';
import { GETTING_STARTED_EDITORIAL } from '../lib/getting-started-editorial.js';
import { extractReleaseItems } from '../lib/release-schedule-editorial.js';
import { getStarterDecksEntries } from './starterDecksSeo.js';

const TODAY = '2026-10-12';
const readData = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
const [series, cards, topics, seriesCounts] = await Promise.all(['series.json', 'cards.json', 'topics.json', 'series-card-counts.json'].map(readData));
const article = buildStarterDecksEditorial(series, cards, TODAY, topics);
const text = JSON.stringify(article);
const section = (prefix) => article.sections.find((item) => item.heading.startsWith(prefix));

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectStrings(entry, out));
  return out;
}

function assertShape(editorial) {
  assert.equal(typeof editorial.heading, 'string');
  assert.match(editorial.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(editorial.dataDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(editorial.paragraphs.length, 2);
  editorial.paragraphs.forEach((paragraph) => assert.ok(paragraph.length <= 80, paragraph));
  assert.equal(editorial.summary.length, 4);
  editorial.summary.forEach((entry) => assert.ok(entry.value && entry.label));
  assert.equal(editorial.checklist.length, 3);
  editorial.checklist.forEach((entry) => assert.ok(entry.length <= 30, entry));
  const headings = editorial.sections.map((item) => item.heading);
  assert.equal(new Set(headings).size, headings.length);
  editorial.sections.forEach((item, index) => {
    assert.match(item.heading, new RegExp(`^${index + 1}\\. `), 'sections are numbered');
    assert.equal((item.paragraphs || []).length, 1, `${item.heading}: one lead sentence`);
    assert.ok(item.paragraphs[0].length <= 60, `${item.heading}: short lead`);
    const bodies = ['table', 'items', 'images', 'stats', 'bars'].filter((key) => item[key] && (Array.isArray(item[key]) ? item[key].length : true));
    assert.equal(bodies.length, 1, `${item.heading}: ${bodies.join(', ')}`);
    (item.items || []).forEach((entry) => assert.ok(entry.length <= 60, entry));
    assert.ok((item.items || []).length <= 5, item.heading);
    if (item.table) {
      assert.equal(typeof item.table.numeric, 'boolean');
      assert.ok(item.table.rows.length > 0, `${item.heading}: no empty table`);
      item.table.rows.forEach((row) => {
        assert.equal(row.length, item.table.columns.length, `${item.heading}: ${row[0]}`);
        row.forEach((cell) => assert.equal(typeof cell, 'string'));
      });
      const firstCells = item.table.rows.map((row) => row[0]);
      assert.equal(new Set(firstCells).size, firstCells.length, 'first cells are unique (React row keys)');
    }
    if (item.links) assert.equal(new Set(item.links.map((link) => link.href)).size, item.links.length);
  });
  const images = editorial.sections.flatMap((item) => item.images || []);
  assert.ok(images.length <= 2);
}

test('colors and code ranges are parsed from every card-list format', () => {
  assert.deepEqual(parseColors('Color Red/Purple'), ['red', 'purple']);
  assert.deepEqual(parseColors('色 赤, 자색'), ['red', 'purple']);
  assert.deepEqual(parseColors('녹색,청색,다색'), ['green', 'blue']);
  assert.deepEqual(parseColors('赤 黒'), ['red', 'black']);
  assert.equal(compressCodes(['23', '24', '25', '27']), 'STK-23~25·STK-27');
  assert.equal(compressCodes(['10']), 'STK-10');
});

test('real data: the article has the shared editorial shape and short, readable text', () => {
  assertShape(article);
  assert.equal(article.dataDate, TODAY);
  assert.match(article.heading, /스타트 덱/);
  const prose = collectStrings({ p: article.paragraphs, s: article.sections.map((item) => ({ h: item.heading, p: item.paragraphs, i: item.items })), c: article.checklist }).join('');
  assert.ok(prose.length <= 900, `prose length ${prose.length}`);
});

test('real data: deck counts and dates are recomputed from topics.json and series.json', () => {
  const releases = extractReleaseItems(topics).filter((item) => item.code?.family === 'ST');
  const numbersOf = (locale) => new Set([
    ...releases.filter((item) => item.locale === locale && item.date <= TODAY).map((item) => item.code.number),
    ...series.map((entry) => String(entry.id).match(new RegExp(`^${locale}-ST(\\d{2})$`))?.[1]).filter(Boolean)
  ]);
  const kr = numbersOf('KR');
  const jp = numbersOf('JP');
  const jpOnly = [...jp].filter((number) => !kr.has(number)).sort();

  const rows = section('1. ').table.rows;
  assert.deepEqual(rows.map((row) => row[0]), [...kr].sort().map((number) => `STK-${number}`));
  assert.match(article.heading, new RegExp(`한글판 ${kr.size}종`));
  assert.equal(article.summary[0].value, `${kr.size}종`);
  assert.equal(article.summary[1].value, `${jp.size}종`);
  assert.deepEqual(section('4. ').table.rows.map((row) => row[0]), jpOnly.map((number) => `ST-${number}`));
  assert.match(section('4. ').paragraphs[0], new RegExp(`${jpOnly.length}종`));

  // Korean release date in the table is the earliest KR calendar date for that code.
  rows.forEach((row) => {
    const number = row[0].slice(4);
    const dates = releases.filter((item) => item.locale === 'KR' && item.code.number === number).map((item) => item.date).sort();
    assert.equal(row[4], dates[0] || '-', row[0]);
  });
  const latest = [...rows].filter((row) => row[4] !== '-').sort((a, b) => b[4].localeCompare(a[4]) || b[0].localeCompare(a[0]))[0];
  assert.equal(article.summary[2].value, latest[0]);
  assert.match(article.summary[2].label, new RegExp(latest[4]));
  assert.match(section('3. ').paragraphs[0], new RegExp(latest[0]));

  // Every Korean deck in series.json also has cards in the Card Pone catalog.
  [...kr].filter((number) => series.some((entry) => entry.id === `KR-ST${number}`)).forEach((number) => assert.ok(seriesCounts.KR.series[`KR-ST${number}`] > 0, `KR-ST${number}`));
});

test('real data: leaders, colors and lives match cards.json', () => {
  const decks = new Map(collectStarterDecks(series, cards, topics).map((deck) => [deck.number, deck]));
  const leaderCards = cards.filter((card) => card.category === 'LEADER');
  const krName = (cardNo) => cards.find((card) => card.locale === 'KR' && card.cardNo.replace(/_p\d+$/i, '') === cardNo)?.name;
  section('1. ').table.rows.forEach(([code, , leader, color]) => {
    const deck = decks.get(code.slice(4));
    assert.ok(deck.leaders.length, `${code} has a leader`);
    assert.equal(leader, deck.leaders.map((entry) => entry.name).join('·'));
    deck.leaders.forEach((entry) => {
      const printings = leaderCards.filter((card) => card.cardNo.replace(/_p\d+$/i, '') === entry.cardNo);
      assert.ok(printings.length, `${entry.cardNo} is in cards.json`);
      assert.equal(String(entry.life), printings[0].cost.match(/\d+/)[0], `${entry.cardNo} life`);
      if (krName(entry.cardNo)) assert.equal(entry.name, krName(entry.cardNo), `${entry.cardNo} Korean name`);
      const en = printings.find((card) => card.locale === 'EN');
      if (en) assert.deepEqual(entry.colors, parseColors(en.color), `${entry.cardNo} colors`);
    });
    assert.notEqual(color, '-', code);
  });
  // Spot checks against the card list: reprinted leader, multi-leader deck, multi-color leader.
  assert.equal(decks.get('23').leaders[0].cardNo, 'OP09-001');
  assert.equal(decks.get('13').leaders.length, 3);
  assert.deepEqual(decks.get('13').leaders.find((entry) => entry.cardNo === 'ST13-002').colors, ['blue', 'yellow']);

  const stats = getStarterDeckStats(series, cards, TODAY, topics);
  const lifeItem = section('5. ').items.find((item) => item.startsWith('라이프:'));
  assert.match(lifeItem, new RegExp(`단색 리더는 \\S+ ${stats.singleLifeMode[0]},`));
  assert.match(lifeItem, new RegExp(`두 색 리더는 \\S+ ${stats.multiLifeMode[0]}입니다`));
  const singles = stats.singleLeaders.map((leader) => leader.life);
  assert.equal(singles.filter((life) => life === stats.singleLifeMode[0]).length, stats.singleLifeMode[1]);
  assert.equal(stats.singleLifeMode[2], singles.length);
});

test('color table covers every Korean deck once', () => {
  const { rows } = section('2. ').table;
  const total = rows.reduce((sum, row) => sum + Number(row[1].replace('종', '')), 0);
  assert.equal(total, section('1. ').table.rows.length);
});

test('prices are only the official list prices and the page gives no investment talk', () => {
  assert.deepEqual(STARTER_DECK_LIST_PRICE, { krWon: 12000, jpYen: 1430 });
  assert.match(JSON.stringify(GETTING_STARTED_EDITORIAL), /1,430엔 \/ 12,000원/, 'same list price as the getting-started guide');
  const all = collectStrings([article, getStarterDecksFaq(series, cards, TODAY, topics), getStarterDecksSeo(series, cards, TODAY, topics)]).join('\n');
  (all.match(/[\d,]+원/g) || []).forEach((value) => assert.equal(value, '12,000원'));
  (all.match(/[\d,]+엔/g) || []).forEach((value) => assert.equal(value, '1,430엔'));
  assert.doesNotMatch(all, /US\$|₩|¥/);
  assert.doesNotMatch(all, /투자|수익|오를|저평가|시세 상승|티어|메타|최강|사기|카드성지|더카드룸/);
});

test('links point to site paths or official domains only', () => {
  const hrefs = article.sections.flatMap((item) => (item.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^(\/guide\/[a-z-]+|https:\/\/(www\.onepiece-cardgame\.com|onepiece-cardgame\.kr)\/.*)$/, href));
  ['/guide/getting-started', '/guide/rules', '/guide/shops', '/guide/release-schedule'].forEach((href) => assert.ok(hrefs.includes(href), href));
  article.sections.flatMap((item) => item.images || []).forEach((image) => {
    assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/(JP|KR)\/[A-Z0-9-]+(_p\d+)?\.webp$/);
    assert.ok(image.alt && image.caption);
  });
});

test('SEO copy, FAQ and the pre-render entry', () => {
  const seo = getStarterDecksSeo(series, cards, TODAY, topics);
  const krCount = section('1. ').table.rows.length;
  assert.equal(seo.title, `원피스카드 스타트 덱 추천·종류 정리 (한글판 ${krCount}종) | Card Pone`);
  assert.ok(seo.description.length >= 80 && seo.description.length <= 130, `description ${seo.description.length}`);
  ['스타트덱 추천', '스타트덱 종류', '입문 덱'].forEach((keyword) => assert.match(seo.keywords, new RegExp(keyword)));

  const faq = getStarterDecksFaq(series, cards, TODAY, topics);
  assert.equal(faq.length, 2);
  faq.forEach((pair) => {
    assert.equal(pair.length, 2);
    assert.match(pair[0], /\?$/);
    assert.ok(pair[1].length <= 200, pair[1]);
  });
  assert.match(faq[0][1], new RegExp(`한글판은 ${krCount}종, 일본판은 ${article.summary[1].value}`));
  assert.match(faq[1][1], new RegExp(article.summary[2].value));
  faq.forEach(([, answer]) => assert.ok(!text.includes(answer.slice(0, 30)), 'FAQ does not repeat the body'));

  const [entry] = getStarterDecksEntries(TODAY);
  assert.equal(entry.pathname, STARTER_DECKS_PATH);
  assert.equal(STARTER_DECKS_PATH, '/guide/starter-decks');
  assert.equal(entry.seo.title, seo.title);
  assert.equal(entry.seo.heading, article.heading);
  assert.equal(entry.seo.sections[0].heading, '핵심 숫자');
});

test('fixture: missing data still yields a sensible page; upcoming decks are listed, not counted', () => {
  for (const input of [[[], [], []], [null, null, null]]) {
    const editorial = buildStarterDecksEditorial(input[0], input[1], TODAY, input[2]);
    assertShape(editorial);
    assert.equal(editorial.summary[0].value, '0종');
    assert.equal(getStarterDecksFaq(input[0], input[1], TODAY, input[2]).length, 2);
  }
  const fixtureTopics = [
    { locale: 'KR', calendarKind: 'release', scheduleDate: '2026-09-18', title: '[STK-29] 스타트 덱 EGGHEAD' },
    { locale: 'KR', calendarKind: 'release', scheduleDate: '2026-12-18', title: '[STK-31] 스타트 덱 적 몽키 D. 루피' },
    { locale: 'JP', calendarKind: 'release', scheduleDate: '2026-07-11', title: 'スタートデッキ 赤 モンキー・D・ルフィ【ST-31】' }
  ];
  const fixtureCards = [
    { locale: 'KR', cardNo: 'OP01-003', name: '몽키 D. 루피', category: 'LEADER', series: 'KR-OP01', color: 'Red', colorKo: '적색', cost: '5' },
    { locale: 'JP', cardNo: 'OP01-003', name: 'モンキー・D・ルフィ', category: 'LEADER', series: 'JP-OP01', color: '色 赤', cost: 'ライフ 5' }
  ];
  const editorial = buildStarterDecksEditorial([], fixtureCards, TODAY, fixtureTopics);
  assertShape(editorial);
  assert.equal(editorial.summary[0].value, '1종');
  assert.equal(editorial.sections[2].items[0], '2026-12-18 예정: STK-31 적 몽키 D. 루피');
  assert.equal(editorial.sections[3].table, undefined, 'ST-31 has an announced Korean code, so it is not JP-only');
  const deck31 = collectStarterDecks([], fixtureCards, fixtureTopics).find((deck) => deck.number === '31');
  assert.deepEqual(deck31.leaders.map((leader) => [leader.name, leader.colors]), [['몽키 D. 루피', ['red']]], 'leader read from the JP title');
});
