import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildReleaseScheduleEditorial,
  extractReleaseItems,
  getReleaseCode,
  pairReleases,
  mainBoosterIntervals,
  median,
  withTopicParticle
} from '../lib/release-schedule-editorial.js';

const TODAY = '2026-10-07';
const topics = JSON.parse(await readFile(new URL('../src/data/topics.json', import.meta.url), 'utf8'));
const realEditorial = buildReleaseScheduleEditorial(topics, TODAY);

const release = (locale, date, title, extra = {}) => ({
  id: `${locale}-${date}-${title}`,
  locale,
  source: locale === 'JP' ? 'JP_OFFICIAL' : 'KR_OFFICIAL',
  category: locale === 'JP' ? 'ブースター' : 'BOOSTERS',
  title,
  date,
  scheduleDate: date,
  calendarKind: 'release',
  calendarPriority: 'high',
  calendarOnly: true,
  url: `https://example.invalid/${encodeURIComponent(title)}`,
  ...extra
});

const fixture = [
  release('JP', '2025-01-10', 'ブースターパック テスト1【OP-01】'),
  release('JP', '2025-04-10', 'ブースターパック テスト2【OP-02】'),
  release('JP', '2025-07-10', 'エクストラブースター TEST【EB-01】'),
  release('JP', '2026-12-05', 'ブースターパック テスト3【OP-03】'),
  release('JP', '2026-11-01', 'スタートデッキ 赤【ST-01】', { category: 'デッキ', calendarPriority: 'medium' }),
  release('JP', '2026-10-20', 'オフィシャルカードスリーブ 9', { category: 'その他', calendarPriority: 'medium' }),
  release('KR', '2025-10-10', '[OPK-01] 부스터 팩 테스트1'),
  release('KR', '2026-01-10', '[OPK-02] 부스터 팩 테스트2'),
  release('KR', '2026-11-20', '[EBK-01] 엑스트라 부스터 팩 TEST'),
  release('KR', '2026-09-01', '[STK-09] 스타트 덱 테스트', { category: 'DECKS' }),
  { id: 'event', locale: 'JP', category: 'EVENTS', title: '大会【OP-02】', date: '2026-12-01', scheduleDate: '2026-12-01', calendarKind: 'event' },
  { id: 'news', locale: 'KR', category: 'PRODUCTS', title: '[OPK-03] 발매일 공개', date: '2026-10-02' }
];

function allSections(editorial) {
  return editorial.sections;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectStrings(entry, out));
  return out;
}

function assertShape(editorial) {
  assert.equal(typeof editorial.heading, 'string');
  assert.equal(editorial.reviewedAt, '2026-10-07');
  assert.match(editorial.dataDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(editorial.paragraphs.length >= 1);
  assert.equal(editorial.summary.length, 4);
  editorial.summary.forEach((entry) => {
    assert.equal(typeof entry.value, 'string');
    assert.ok(entry.value.length > 0);
    assert.equal(typeof entry.label, 'string');
  });
  assert.ok(editorial.checklist.length >= 3);
  const headings = allSections(editorial).map((section) => section.heading);
  assert.equal(new Set(headings).size, headings.length, 'section headings are unique (React keys)');
  allSections(editorial).forEach((section) => {
    const hasBody = ['paragraphs', 'items', 'table', 'bars', 'stats', 'images', 'links'].some((key) => (Array.isArray(section[key]) ? section[key].length : Boolean(section[key])));
    assert.ok(hasBody, `${section.heading} has content`);
    if (section.table) {
      assert.ok(section.table.rows.length > 0, `${section.heading} has no empty table`);
      section.table.rows.forEach((row) => {
        assert.equal(row.length, section.table.columns.length, `${section.heading} row width`);
        row.forEach((cell) => assert.equal(typeof cell, 'string'));
      });
      const firstCells = section.table.rows.map((row) => row[0]);
      assert.equal(new Set(firstCells).size, firstCells.length, `${section.heading} first cells are unique (React row keys)`);
    }
    if (section.links) assert.equal(new Set(section.links.map((link) => link.href)).size, section.links.length, 'link hrefs are unique');
    (section.bars || []).forEach((bar) => assert.ok(Number.isFinite(bar.value) && typeof bar.display === 'string'));
    (section.images || []).forEach((image) => assert.match(image.src, /^https:\/\//));
  });
}

function upcomingDates(section) {
  return section.table ? section.table.rows.map((row) => row[1].slice(0, 10)) : [];
}

test('product codes fold the Korean K suffix so JP and KR codes pair', () => {
  assert.equal(getReleaseCode('ブースターパック 神の支配【OP-18】').key, 'OP18');
  assert.equal(getReleaseCode('[OPK-14] 부스터 팩 창해의 칠걸').key, 'OP14');
  assert.equal(getReleaseCode('[EBK-04] 엑스트라 부스터 팩 EGGHEAD CRISIS').key, 'EB04');
  assert.equal(getReleaseCode('[STK-29] 스타트 덱 EGGHEAD').key, 'ST29');
  assert.equal(getReleaseCode('プレミアムブースター ONE PIECE CARD THE BEST【PRB-01】').key, 'PRB01');
  assert.equal(getReleaseCode('オフィシャルカードスリーブ 16'), null);
  assert.equal(getReleaseCode('[OPK-14] x').display, 'OPK-14');
  assert.equal(median([3, 1, 2, 10]), 2.5);
  assert.equal(withTopicParticle('OPK-01'), 'OPK-01은');
  assert.equal(withTopicParticle('EBK-04'), 'EBK-04는');
});

test('real data: shape, upcoming sorted and on/after today, no past items', () => {
  assertShape(realEditorial);
  assert.equal(realEditorial.dataDate, TODAY);
  const [jpSection, krSection] = realEditorial.sections;
  for (const section of [jpSection, krSection]) {
    const dates = upcomingDates(section);
    assert.deepEqual(dates, [...dates].sort());
    dates.forEach((date) => assert.ok(date >= TODAY, `${date} is not before today`));
  }
  const jpUpcoming = extractReleaseItems(topics).filter((item) => item.locale === 'JP' && item.date >= TODAY);
  assert.equal(jpSection.table.rows.length, Math.min(12, jpUpcoming.length));
  const jpText = JSON.stringify(jpSection);
  assert.doesNotMatch(jpText, /OP-17|メラメラの実/, 'already released products are excluded');
  assert.match(jpText, /OP-18/);
  assert.match(JSON.stringify(krSection), /EBK-04/);
});

test('real data: JP↔KR pairing covers OP, EB and ST code formats', () => {
  const { pairs, krOnly } = pairReleases(extractReleaseItems(topics), TODAY);
  const byKey = Object.fromEntries(pairs.map((pair) => [pair.key, pair]));
  assert.equal(byKey.OP01.krCode, 'OPK-01');
  assert.equal(byKey.OP14.gapDays, 272);
  assert.equal(byKey.EB04.krCode, 'EBK-04');
  assert.equal(byKey.EB04.krReleased, false);
  assert.equal(byKey.ST29.krCode, 'STK-29');
  pairs.forEach((pair) => assert.ok(pair.gapDays > 0));
  krOnly.forEach((item) => assert.equal(item.code.family, 'ST'));
  const gapSection = realEditorial.sections[2];
  assert.ok(gapSection.table.rows.some((row) => row[0] === 'EB-04' && /예정/.test(row[2])), 'announced KR date is marked as scheduled');
  assert.equal(gapSection.bars.length, gapSection.table.rows.length);
});

test('real data: summary matches computed values', () => {
  const [nextJp, nextKr, gap, cadence] = realEditorial.summary;
  assert.equal(nextJp.value, '10월 31일');
  assert.match(nextJp.label, /EB-05/);
  assert.equal(nextKr.value, '10월 23일');
  assert.match(nextKr.label, /EBK-04/);
  assert.match(gap.value, /^약 \d+개월$/);
  assert.equal(cadence.value, '91일');
  const intervals = mainBoosterIntervals(extractReleaseItems(topics), 'JP');
  assert.equal(median(intervals.map((interval) => interval.days)), 91);
});

test('real data: Korean text length is within the article range', () => {
  const korean = collectStrings({ p: realEditorial.paragraphs, s: realEditorial.sections, c: realEditorial.checklist }).filter((text) => /[가-힣]/.test(text)).join('');
  assert.ok(korean.length >= 1500 && korean.length <= 3000, `length ${korean.length}`);
});

test('text makes no claims beyond the data', () => {
  for (const editorial of [realEditorial, buildReleaseScheduleEditorial(fixture, '2026-10-07')]) {
    const text = collectStrings(editorial).join('\n');
    assert.doesNotMatch(text, /확정|예상 발매일|발매될 예정입니다|나올 것입니다|전망/);
    assert.match(text, /지난 기록/);
    const knownDates = new Set([TODAY, ...extractReleaseItems([...topics, ...fixture]).map((item) => item.date)]);
    (text.match(/\d{4}-\d{2}-\d{2}/g) || []).forEach((date) => assert.ok(knownDates.has(date), `${date} comes from the data`));
  }
});

test('fixture: pairing, sorting, past exclusion and summary', () => {
  const editorial = buildReleaseScheduleEditorial(fixture, '2026-10-07');
  assertShape(editorial);
  const [jpSection, krSection, gapSection, cadenceSection] = editorial.sections;
  assert.deepEqual(upcomingDates(jpSection), ['2026-10-20', '2026-11-01', '2026-12-05']);
  assert.doesNotMatch(JSON.stringify(jpSection), /OP-01|OP-02|EB-01 /);
  assert.deepEqual(upcomingDates(krSection), ['2026-11-20']);
  assert.equal(editorial.summary[0].value, '11월 1일', 'goods are skipped for the next new card product');
  assert.match(editorial.summary[0].label, /ST-01/);
  assert.equal(editorial.summary[1].value, '11월 20일');
  const { pairs, jpOnly, krOnly } = pairReleases(extractReleaseItems(fixture), '2026-10-07');
  assert.deepEqual(pairs.map((pair) => pair.key), ['OP01', 'OP02', 'EB01']);
  assert.deepEqual(jpOnly.map((item) => item.code.display), ['ST-01', 'OP-03']);
  assert.deepEqual(krOnly.map((item) => item.code.display), ['STK-09']);
  assert.equal(gapSection.table.rows.length, 3);
  assert.deepEqual(gapSection.table.rows[0], ['OP-01', '2025-01-10', '2025-10-10', '273일 (약 9개월)']);
  assert.equal(editorial.summary[2].value, '약 9개월');
  assert.match(gapSection.table.rows[2][2], /예정$/);
  assert.equal(cadenceSection.stats[0].value, '347일');
  assert.ok(!JSON.stringify(editorial).includes('大会'), 'non-release calendar items are ignored');
});

test('fixture: duplicate product names on different dates keep unique first cells', () => {
  const editorial = buildReleaseScheduleEditorial([
    release('JP', '2026-11-01', 'オフィシャルカードスリーブ 9', { category: 'その他' }),
    release('JP', '2026-12-01', 'オフィシャルカードスリーブ 9', { category: 'その他' }),
    release('JP', '2026-11-01', 'オフィシャルカードスリーブ 9', { category: 'その他' })
  ], '2026-10-07');
  assertShape(editorial);
  assert.equal(editorial.sections[0].table.rows.length, 2);
});

test('empty or no-upcoming input yields a sensible page without empty tables', () => {
  for (const input of [[], null, undefined, fixture.filter((item) => item.date < '2026-01-01')]) {
    const editorial = buildReleaseScheduleEditorial(input, '2026-10-07');
    assertShape(editorial);
    const [jpSection, krSection] = editorial.sections;
    assert.equal(jpSection.table, undefined);
    assert.equal(krSection.table, undefined);
    assert.match(jpSection.paragraphs[0], /공지된 일본판 발매 일정이 없습니다/);
    assert.equal(editorial.summary[0].value, '공지 없음');
    assert.equal(editorial.summary[1].value, '공지 없음');
  }
  const empty = buildReleaseScheduleEditorial([], '2026-10-07');
  assert.equal(empty.summary[2].value, '계산 불가');
  assert.equal(empty.sections[2].table, undefined);
  assert.equal(empty.sections[3].stats, undefined);
});

test('deterministic and tolerant of a missing today', () => {
  assert.deepEqual(buildReleaseScheduleEditorial(topics, TODAY), realEditorial);
  const fallback = buildReleaseScheduleEditorial(topics, undefined);
  assert.match(fallback.dataDate, /^\d{4}-\d{2}-\d{2}$/);
  assertShape(fallback);
});

test('the module stays a plain ES module for the app and the middleware', async () => {
  const source = await readFile(new URL('../lib/release-schedule-editorial.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(window|document|localStorage|process|require)\b/);
  assert.doesNotMatch(source, /new Date\(\)|Date\.now\(\)/);
});
