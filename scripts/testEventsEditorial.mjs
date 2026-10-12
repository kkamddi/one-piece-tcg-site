import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  EVENTS_OFFICIAL_URLS,
  EVENTS_PATH,
  EVENTS_SEO,
  buildEventsEditorial,
  countPrizeCards,
  extractOfficialEvents,
  getEventsFaq,
  getEventsSeo,
  upcomingCardShows
} from '../lib/events-editorial.js';
import { cardShowEvents, confirmedCardShows } from '../src/data/card-show-events.js';
import { CHAMPIONSHIP_COLLECTION_GROUPS, FLAGSHIP_COLLECTION_GROUPS } from '../src/data/collection-guide.js';
import { getEventsEntries } from './eventsSeo.js';

const TODAY = '2026-10-12';
const topics = JSON.parse(await readFile(new URL('../src/data/topics.json', import.meta.url), 'utf8'));
const collectionGroups = { flagship: FLAGSHIP_COLLECTION_GROUPS, championship: CHAMPIONSHIP_COLLECTION_GROUPS };
const article = buildEventsEditorial(cardShowEvents, topics, collectionGroups, TODAY);
const faq = getEventsFaq(cardShowEvents, topics, collectionGroups, TODAY);
const section = (editorial, prefix) => editorial.sections.find((item) => item.heading.startsWith(prefix));

const show = (id, date, extra = {}) => ({
  id, title: `Show ${id}`, titleKo: `카드쇼 ${id}`, date, locale: 'KR', venue: `장소 ${id}`,
  url: `https://organizer-${id}.example/`, sourceLabel: `주최 ${id}`, verifiedAt: '2026-09-29', status: 'confirmed', ...extra
});
const showFixture = [
  show('past', '2026-10-02', { endDate: '2026-10-03' }),
  show('lastday', '2026-10-11', { endDate: '2026-10-12' }),
  show('later', '2026-12-05'),
  show('soon', '2026-11-14'),
  show('cancelled', '2026-11-20', { status: 'cancelled' }),
  show('baddate', '2026-02-30'),
  show('http', '2026-11-21', { url: 'http://insecure.example/' })
];
const notice = (brdno, title, date, endDate, extra = {}) => ({
  id: `kr-${brdno}`, locale: 'KR', source: 'KR_OFFICIAL', category: '숙련자', title, date, scheduleDate: date, endDate,
  calendarKind: 'event', calendarOnly: true, url: `https://onepiece-cardgame.kr/events/view.do?brdno=${brdno}`, ...extra
});
const topicFixture = [
  notice(1, '[9월] 원피스 카드게임 플래그쉽 배틀', '2026-09-01', '2026-09-30'),
  notice(2, '[10월] 원피스 카드게임 플래그쉽 배틀', '2026-10-01', '2026-10-31'),
  notice(3, '[11월] 원피스 카드게임 교류회', '2026-11-01', '2026-11-30', { category: '초보자' }),
  notice(4, '원피스 카드게임 발매기념대회 리미티드 배틀', '2026-10-24', '2026-11-06'),
  notice(5, '大会', '2026-11-01', '2026-11-30', { locale: 'JP', url: 'https://www.onepiece-cardgame.com/events/' }),
  notice(6, '외부 행사', '2026-11-01', '2026-11-30', { url: 'https://example.invalid/event' }),
  { ...notice(7, '[11월] 원피스 카드게임 스탠다드 배틀 공개', '2026-09-23'), calendarKind: undefined, category: 'EVENTS' }
];

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectStrings(entry, out));
  return out;
}

function assertShape(editorial) {
  assert.equal(typeof editorial.heading, 'string');
  assert.match(editorial.heading, /원피스카드 대회·이벤트/);
  assert.equal(editorial.reviewedAt, '2026-10-12');
  assert.match(editorial.dataDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(editorial.paragraphs.length, 2);
  editorial.paragraphs.forEach((paragraph) => assert.ok(paragraph.length <= 80, paragraph));
  assert.equal(editorial.summary.length, 4);
  editorial.summary.forEach((entry) => assert.ok(entry.value && entry.label, JSON.stringify(entry)));
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
        row.forEach((cell) => assert.ok(typeof cell === 'string' && cell.length > 0));
      });
      const firstCells = item.table.rows.map((row) => row[0]);
      assert.equal(new Set(firstCells).size, firstCells.length, 'first cells are unique (React row keys)');
    }
    if (item.links) assert.equal(new Set(item.links.map((link) => link.href)).size, item.links.length, 'link hrefs are unique');
  });
}

function allowedHref(href, shows) {
  if (/^\/[a-z0-9/-]*(\?[a-z]+=[a-z]+)?$/.test(href)) return true;
  if (/^https:\/\/onepiece-cardgame\.kr\//.test(href)) return true;
  if (/^https:\/\/www\.onepiece-cardgame\.com\//.test(href)) return true;
  if (/^https:\/\/playgo\.bandainamcokorea\.co\.kr\//.test(href)) return true;
  return shows.some((event) => event.url === href);
}

test('real data: shared editorial shape and short, readable text', () => {
  assertShape(article);
  assert.equal(article.dataDate, TODAY);
  assert.ok(article.sections.length >= 5 && article.sections.length <= 7, `${article.sections.length} sections`);
  const korean = collectStrings({ p: article.paragraphs, s: article.sections, c: article.checklist }).filter((text) => /[가-힣]/.test(text)).join('');
  assert.ok(korean.length <= 2000, `length ${korean.length}`);
});

test('official event kinds match the verified Korean notices', () => {
  const rows = new Map(section(article, '1. ').table.rows.map((row) => [row[0].split(' (')[0], row]));
  assert.deepEqual([...rows.keys()], ['교류회', '스탠다드 배틀', '플래그십 배틀', '챔피언십 점포 예선']);
  assert.match(rows.get('교류회')[3], /무료/);
  assert.match(rows.get('스탠다드 배틀')[3], /4,000원/);
  assert.match(rows.get('플래그십 배틀')[3], /6,000원/);
  assert.equal(rows.get('플래그십 배틀')[2], '공인 점포');
  assert.match(section(article, '3. ').paragraphs[0], /PLAYGO/);
  assert.ok(section(article, '3. ').links.some((link) => link.href === EVENTS_OFFICIAL_URLS.playgo));
});

test('real data: running and upcoming official notices only, linked to the official notice', () => {
  const officialSection = section(article, '4. ');
  const expected = extractOfficialEvents(topics, TODAY);
  assert.ok(expected.length > 0);
  expected.forEach((event) => assert.ok(event.end >= TODAY, event.name));
  assert.equal(officialSection.table.rows.length, Math.min(8, expected.length));
  const text = JSON.stringify(officialSection);
  assert.doesNotMatch(text, /9월|리미티드 배틀|FUNEXPO/, 'finished events are excluded');
  assert.match(text, /11월 플래그쉽 배틀/);
  officialSection.links.forEach((link) => assert.match(link.href, /^https:\/\/onepiece-cardgame\.kr\//));
  assert.equal(article.summary[0].value, `${expected.length}건`);
});

test('real data: card shows come from card-show-events.js and past shows drop off', () => {
  const showSection = section(article, '5. ');
  const upcoming = confirmedCardShows().filter((event) => (event.endDate || event.date) >= TODAY);
  assert.equal(showSection.table.rows.length, upcoming.length);
  assert.doesNotMatch(JSON.stringify(showSection), /콜렉터블 콘/, 'Collectible Con (Oct 2–3) is over');
  assert.match(JSON.stringify(showSection), /서울카드페스타/);
  assert.ok(showSection.links.some((link) => link.href === 'https://seoulcardfesta.com/'));
  assert.equal(article.summary[1].value, '11월 14일');
  const later = buildEventsEditorial(cardShowEvents, topics, collectionGroups, '2026-11-15');
  assertShape(later);
  assert.deepEqual(section(later, '5. ').items, ['현재 확인된 일정 없음. 새 공지가 확인되면 추가됩니다.']);
  assert.equal(later.summary[1].value, '없음');
});

test('fixture: date filter, confirmed status and sorting for card shows', () => {
  assert.deepEqual(upcomingCardShows(showFixture, TODAY).map((event) => event.id), ['lastday', 'soon', 'later']);
  const editorial = buildEventsEditorial(showFixture, topicFixture, collectionGroups, TODAY);
  assertShape(editorial);
  const rows = section(editorial, '5. ').table.rows;
  assert.deepEqual(rows.map((row) => row[0]), ['카드쇼 lastday', '카드쇼 soon', '카드쇼 later']);
  assert.equal(rows[0][1], '10월 11일 (일)~12일 (월)');
  assert.equal(rows[1][1], '11월 14일 (토)');
  assert.equal(editorial.summary[1].value, '10월 11일');
  assert.doesNotMatch(JSON.stringify(editorial), /cancelled|baddate|insecure|카드쇼 past/);
  const nextYear = buildEventsEditorial([show('ny', '2027-01-09')], [], collectionGroups, TODAY);
  assert.equal(section(nextYear, '5. ').table.rows[0][1], '2027년 1월 9일 (토)');
});

test('fixture: official notices keep KR calendar events that have not ended', () => {
  const events = extractOfficialEvents(topicFixture, TODAY);
  assert.deepEqual(events.map((event) => event.name), ['10월 플래그쉽 배틀', '발매기념대회 리미티드 배틀', '11월 교류회']);
  const editorial = buildEventsEditorial([], topicFixture, collectionGroups, TODAY);
  const rows = section(editorial, '4. ').table.rows;
  assert.deepEqual(rows.map((row) => row[1]), ['10월 한 달', '10월 24일~11월 6일', '11월 한 달']);
  assert.deepEqual(rows.map((row) => row[2]), ['숙련자', '숙련자', '초보자']);
  const empty = buildEventsEditorial([], [], collectionGroups, TODAY);
  assertShape(empty);
  assert.equal(section(empty, '4. ').table, undefined);
  assert.match(section(empty, '4. ').items[0], /현재 확인된 일정 없음/);
  assert.equal(empty.summary[0].value, '0건');
});

test('prize card counts are recomputed from collection-guide.js', () => {
  const flagshipCards = FLAGSHIP_COLLECTION_GROUPS.JP.reduce((total, group) => total + group.cards.length, 0);
  const championshipIds = new Set(Object.values(CHAMPIONSHIP_COLLECTION_GROUPS).flatMap((groups) => groups.flatMap((group) => group.cards.map((card) => card.cardId))));
  const krIds = [...championshipIds].filter((id) => id.startsWith('KR::'));
  assert.deepEqual(countPrizeCards(collectionGroups), {
    flagshipCards,
    flagshipPeriods: FLAGSHIP_COLLECTION_GROUPS.JP.length,
    championshipCards: championshipIds.size,
    championshipKrCards: krIds.length
  });
  assert.equal(article.summary[2].value, `${flagshipCards}장`);
  assert.match(article.summary[2].label, new RegExp(`${FLAGSHIP_COLLECTION_GROUPS.JP.length}회분`));
  assert.equal(article.summary[3].value, `${championshipIds.size}장`);
  assert.match(article.summary[3].label, new RegExp(`${krIds.length}장`));
  const prizeSection = section(article, '2. ');
  assert.ok(prizeSection.items.some((entry) => entry.includes(`플래그십 ${flagshipCards}장`) && entry.includes(`챔피언십 ${championshipIds.size}장`)));
  ['/guide/collection/flagship', '/guide/collection/championship'].forEach((href) => assert.ok(prizeSection.links.some((link) => link.href === href), href));
  assert.deepEqual(countPrizeCards(undefined), { flagshipCards: 0, flagshipPeriods: 0, championshipCards: 0, championshipKrCards: 0 });
});

test('links point to site paths, official domains or organizer URLs from card-show-events.js', () => {
  for (const [editorial, shows] of [[article, cardShowEvents], [buildEventsEditorial(showFixture, topicFixture, collectionGroups, TODAY), showFixture]]) {
    editorial.sections.flatMap((item) => item.links || []).forEach((link) => {
      assert.ok(allowedHref(link.href, shows), link.href);
      assert.ok(link.label);
    });
  }
  getEventsEntries(TODAY)[0].seo.links.forEach((href) => assert.match(href, /^\/[a-z/-]+$/));
});

test('FAQ has exactly two pairs and follows the card-show data', () => {
  assert.equal(faq.length, 2);
  faq.forEach(([question, answer]) => {
    assert.ok(question.endsWith('?'), question);
    assert.ok(answer.length > 20, answer);
  });
  assert.match(faq[0][1], /PLAYGO/);
  assert.match(faq[1][1], /서울카드페스타/);
  const none = getEventsFaq([], [], collectionGroups, TODAY);
  assert.equal(none.length, 2);
  assert.match(none[1][1], /카드쇼가 없습니다/);
});

test('SEO entry follows the guide pattern', () => {
  assert.equal(EVENTS_PATH, '/guide/events');
  assert.equal(EVENTS_SEO.title, '원피스카드 대회·이벤트 정리 - 플래그십 배틀·참가 방법·카드쇼 일정 | Card Pone');
  assert.ok(EVENTS_SEO.title.replace(/ \| Card Pone$/, '').length <= 60);
  assert.ok(EVENTS_SEO.description.length <= 160, `${EVENTS_SEO.description.length}`);
  ['원피스카드 대회', '원피스카드 플래그십 배틀', '원피스카드 대회 참가 방법', '원피스카드 카드쇼'].forEach((keyword) => assert.ok(EVENTS_SEO.keywords.includes(keyword), keyword));
  assert.deepEqual(getEventsSeo(), EVENTS_SEO);
  const entries = getEventsEntries(TODAY);
  assert.equal(entries.length, 1);
  const [{ pathname, seo }] = entries;
  assert.equal(pathname, '/guide/events');
  assert.equal(seo.title, EVENTS_SEO.title);
  assert.equal(seo.schemaType, 'Article');
  assert.equal(seo.heading, article.heading);
  assert.equal(seo.sections.length, article.sections.length + 2);
  assert.deepEqual(seo.sections[0].stats, article.summary);
  assert.deepEqual(seo.sections.at(-1).items, article.checklist);
  assert.deepEqual(seo.faq, faq);
});

test('no investment talk and no store names', () => {
  const all = [article, faq, EVENTS_SEO, buildEventsEditorial(showFixture, topicFixture, collectionGroups, TODAY)].map((value) => JSON.stringify(value)).join('\n');
  assert.doesNotMatch(all, /수익|투자|시세|돈이 됩|무조건|오를|재테크|카드성지|더카드룸/);
});

test('deterministic, tolerant of missing input, and a plain ES module', async () => {
  assert.deepEqual(buildEventsEditorial(cardShowEvents, topics, collectionGroups, TODAY), article);
  for (const input of [[null, null, null, undefined], [undefined, undefined, {}, 'not-a-date']]) {
    const editorial = buildEventsEditorial(...input);
    assertShape(editorial);
    assert.equal(getEventsFaq(...input).length, 2);
  }
  const source = await readFile(new URL('../lib/events-editorial.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(window|document|localStorage|process|require)\b/);
  assert.doesNotMatch(source, /new Date\(\)|Date\.now\(\)/);
});
