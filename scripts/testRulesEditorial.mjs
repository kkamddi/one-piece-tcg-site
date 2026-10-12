import assert from 'node:assert/strict';
import test from 'node:test';
import { RULES_EDITORIAL, RULES_FAQ, RULES_PATH, RULES_SEO } from '../lib/rules-editorial.js';
import { getRulesEntries } from './rulesSeo.js';

const article = RULES_EDITORIAL;
const text = JSON.stringify(article);
const section = (prefix) => article.sections.find((item) => item.heading.startsWith(prefix));
const rowsOf = (prefix) => new Map(section(prefix).table.rows.map((row) => [row[0], row]));

test('the article has the shared editorial shape', () => {
  assert.equal(typeof article.heading, 'string');
  assert.match(article.heading, /원피스카드 룰/);
  assert.equal(article.reviewedAt, '2026-10-12');
  assert.equal(article.dataDate, '2026-10-12');
  assert.equal(article.paragraphs.length, 2);
  assert.equal(article.summary.length, 4);
  article.summary.forEach((item) => assert.ok(item.value && item.label));
  assert.equal(article.checklist.length, 3);
  assert.ok(article.sections.length >= 5 && article.sections.length <= 7, `${article.sections.length} sections`);
  article.sections.forEach((item, index) => assert.match(item.heading, new RegExp(`^${index + 1}\\. `)));
  assert.ok(article.sections.some((item) => item.table));
});

test('each section is one short lead plus a single table, list or image set', () => {
  article.paragraphs.forEach((paragraph) => assert.ok(paragraph.length <= 80, paragraph));
  article.sections.forEach((item) => {
    assert.equal((item.paragraphs || []).length, 1, `${item.heading}: one lead sentence`);
    assert.ok(item.paragraphs[0].length <= 60, `${item.heading}: short lead`);
    const bodies = ['table', 'items', 'images', 'stats'].filter((key) => item[key] && (Array.isArray(item[key]) ? item[key].length : true));
    assert.equal(bodies.length, 1, `${item.heading}: ${bodies.join(', ')}`);
    (item.items || []).forEach((entry) => assert.ok(entry.length <= 60, entry));
    assert.ok((item.items || []).length <= 5, item.heading);
  });
  article.checklist.forEach((entry) => assert.ok(entry.length <= 30, entry));
});

test('every table row has one cell per column', () => {
  for (const item of article.sections.filter((entry) => entry.table)) {
    const { columns, rows } = item.table;
    assert.equal(typeof item.table.numeric, 'boolean');
    assert.ok(rows.length > 0);
    rows.forEach((row) => assert.equal(row.length, columns.length, `${item.heading}: ${row[0]}`));
  }
});

test('links point to site guide pages or official rule pages only', () => {
  const hrefs = article.sections.flatMap((item) => (item.links || []).map((link) => link.href));
  hrefs.forEach((href) => assert.match(href, /^(\/guide\/[a-z-]+|https:\/\/www\.onepiece-cardgame\.com\/(rules|play-guide)\/|https:\/\/onepiece-cardgame\.kr\/(rules|starter)\.do)$/, href));
  ['/guide/getting-started', '/guide/glossary', '/guide/card-types', 'https://www.onepiece-cardgame.com/rules/']
    .forEach((href) => assert.ok(hrefs.includes(href), href));
});

test('official rule facts stay consistent', () => {
  const deck = rowsOf('2. ');
  assert.equal(deck.get('리더 카드')[1], '정확히 1장');
  assert.match(deck.get('덱')[1], /정확히 50장/);
  assert.match(deck.get('돈!! 덱')[1], /10장/);
  assert.equal(deck.get('같은 카드 번호')[1], '4장까지');
  assert.match(deck.get('색')[1], /리더가 가진 색/);

  const setup = section('3. ').items.join(' ');
  assert.match(setup, /패를 5장/);
  assert.match(setup, /1번만/);
  assert.match(setup, /라이프 수만큼/);

  const phases = section('4. ').table.rows.map((row) => row[0]);
  assert.deepEqual(phases, ['리프레시', '드로우', '돈!!', '메인', '엔드']);
  const turn = rowsOf('4. ');
  assert.match(turn.get('드로우')[1], /선공 첫 턴은 뽑지 않음/);
  assert.match(turn.get('돈!!')[1], /2장.*선공 첫 턴은 1장/);

  const main = section('5. ').items.join(' ');
  assert.match(main, /캐릭터는 5장, 스테이지는 1장/);
  assert.match(main, /파워 \+1000/);

  assert.deepEqual(section('6. ').table.rows.map((row) => row[0]), ['어택', '블록', '카운터', '대미지', '배틀 종료']);
  assert.match(rowsOf('6. ').get('대미지')[1], /같거나 크면/);
  assert.deepEqual(section('7. ').table.rows.map((row) => row[0]), ['리더', '캐릭터', '이벤트', '스테이지', '돈!!']);
  assert.match(text, /【트리거】/);
});

test('FAQ has exactly two pairs and the body does not repeat the answers', () => {
  assert.equal(RULES_FAQ.length, 2);
  RULES_FAQ.forEach(([question, answer]) => {
    assert.ok(question.endsWith('?'), question);
    assert.ok(answer.length > 20, answer);
  });
  assert.doesNotMatch(text, /후공은 첫 턴부터/);
  assert.doesNotMatch(text, /횟수 제한 없이/);
});

test('SEO entry follows the guide pattern', () => {
  assert.equal(RULES_PATH, '/guide/rules');
  assert.match(RULES_SEO.title, / \| Card Pone$/);
  assert.ok(RULES_SEO.title.replace(/ \| Card Pone$/, '').length <= 60, RULES_SEO.title);
  ['원피스카드 룰', '원피스 카드게임 하는법', '원피스카드 규칙'].forEach((keyword) => assert.ok(RULES_SEO.keywords.includes(keyword), keyword));
  assert.ok(RULES_SEO.description.length <= 160, `${RULES_SEO.description.length}`);
  const entries = getRulesEntries();
  assert.equal(entries.length, 1);
  const [{ pathname, seo }] = entries;
  assert.equal(pathname, '/guide/rules');
  assert.equal(seo.title, RULES_SEO.title);
  assert.equal(seo.schemaType, 'Article');
  assert.equal(seo.heading, article.heading);
  assert.equal(seo.sections.length, article.sections.length + 2);
  assert.equal(seo.sections[0].stats, article.summary);
  assert.deepEqual(seo.sections.at(-1).items, article.checklist);
});

test('the article makes no price promise, investment advice or shop names', () => {
  const all = text + JSON.stringify(RULES_FAQ) + JSON.stringify(RULES_SEO);
  assert.doesNotMatch(all, /수익 보장|확실한 수익|무조건|반드시 (오릅|올라)|투자|돈이 됩|시세|카드성지|더카드룸/);
});
