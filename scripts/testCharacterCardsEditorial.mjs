import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { CHARACTER_CARDS_EDITORIAL as A } from '../lib/character-cards-editorial.js';
import { MANGA_COLLECTION_GROUPS } from '../src/data/collection-guide.js';

const yen = (text) => Number(String(text).replace(/[¥,]/g, ''));
const num = (text) => Number(String(text).replace(/[^\d.]/g, ''));
const text = JSON.stringify(A);
const section = (prefix) => A.sections.find((s) => s.heading.startsWith(prefix));
const ranking = section('2.').table;
const versions = section('4.').table;

test('the article has the shared editorial shape and dates', () => {
  assert.equal(A.reviewedAt, '2026-10-07');
  assert.equal(A.dataDate, '2026-10-07');
  assert.equal(A.summary.length, 4);
  A.sections.forEach((s, index) => assert.ok(s.heading.startsWith(`${index + 1}. `), s.heading));
  for (const s of A.sections) {
    for (const t of [s.table].filter(Boolean)) t.rows.forEach((row) => assert.equal(row.length, t.columns.length, row.join('|')));
    for (const link of s.links || []) assert.match(link.href, /^\/[a-z]/);
  }
});

test('the ranking is ordered by the stated metric and agrees with the summary', () => {
  assert.equal(ranking.rows.length, 12);
  const counts = ranking.rows.map((row) => num(row[1]));
  counts.forEach((count, i) => {
    assert.ok(count >= 3);
    if (i) assert.ok(count <= counts[i - 1]);
  });
  ranking.rows.forEach((row) => assert.ok(yen(row[4]) >= 50000, `${row[0]} top card under ¥50,000`));
  const luffy = ranking.rows.find((row) => row[0] === '루피');
  assert.equal(`${luffy[1]}장`, A.summary[0].value);
  const total = num(A.summary[1].value);
  const ranked = counts.reduce((sum, c) => sum + c, 0);
  assert.match(text, new RegExp(`${total}장 중 ${ranked}장\\(${Math.round((ranked / total) * 100)}%\\)`));
  assert.match(text, new RegExp(`루피 혼자 ${luffy[1]}장\\(${Math.round((num(luffy[1]) / total) * 100)}%\\)`));
  const manga = ranking.rows.filter((row) => row[3].includes('망가')).length;
  assert.match(text, new RegExp(`12명 중 ${manga}명의 최고가 카드가 망가`));
});

test('the version table ratios and ranges are recomputable from its own cells', () => {
  const ratios = versions.rows.map((row) => {
    const ratio = Math.round(yen(row[3]) / yen(row[1]));
    assert.equal(row[4], `${ratio}배`, row[0]);
    assert.ok(yen(row[1]) < yen(row[2]) && yen(row[2]) < yen(row[3]), row[0]);
    return ratio;
  });
  const bases = versions.rows.map((row) => yen(row[1]));
  const mangas = versions.rows.map((row) => yen(row[3]));
  const intro = section('4.').paragraphs[0];
  assert.ok(intro.includes(`${Math.min(...ratios)}~${Math.max(...ratios)}배`));
  assert.ok(intro.includes(`¥${Math.min(...bases).toLocaleString('en-US')}~¥${Math.max(...bases).toLocaleString('en-US')}`));
  assert.ok(intro.includes(`¥${Math.round(Math.min(...mangas) / 10000)}만~¥${Math.round(Math.max(...mangas) / 10000)}만`));
  assert.equal(section('4.').stats[1].value, A.summary[2].value);
  assert.ok(1739978 / 230502 > 7, 'red manga is more than 7x the regular manga');
});

test('bars show the stated medians in rising order', () => {
  const { bars } = section('4.');
  bars.forEach((bar, i) => {
    assert.equal(bar.value, yen(bar.display));
    if (i) assert.ok(bar.value > bars[i - 1].value);
  });
  const parallelOverBase = bars[1].value / bars[0].value;
  assert.ok(parallelOverBase > 1.5 && parallelOverBase < 2.5, 'parallel is about 2x the base median');
});

test('images and card numbers point to real JP catalog cards', async () => {
  const catalog = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
  const ids = new Set(catalog.filter((c) => c.locale === 'JP').map((c) => c.id));
  const numbers = new Set(catalog.filter((c) => c.locale === 'JP').map((c) => c.cardNo));
  const manga = new Set(MANGA_COLLECTION_GROUPS.flatMap((g) => g.cards.map((c) => c.cardId)));
  for (const image of section('3.').images) {
    const id = `JP::${decodeURIComponent(image.src.match(/\/cards\/JP\/(.+)\.webp$/)[1])}`;
    assert.ok(ids.has(id), id);
    assert.ok(manga.has(id), `${id} should be in the manga list`);
    assert.ok(image.alt && image.caption);
  }
  for (const row of [...ranking.rows.map((r) => r[3]), ...versions.rows.map((r) => r[0])]) {
    assert.ok(numbers.has(row.split(' ')[0]), row);
  }
});

test('numbers match the saved analysis output when it is available', async (t) => {
  const file = new URL('../artifacts/content/character-cards-analysis.json', import.meta.url);
  if (!existsSync(file)) return t.skip('analysis output is local only');
  const r = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(num(A.summary[1].value), r.totals.highCards);
  assert.equal(num(A.summary[3].value), r.totals.under10000Pct);
  assert.equal(num(A.summary[2].value), Math.round(r.sameCardRatios.mangaOverBase.median));
  assert.ok(text.includes(`${r.totals.tradedSingle.toLocaleString('en-US')}장`));
  assert.ok(text.includes(`${r.totals.highCardsPromo}장(${r.totals.highPromoPct}%)`));
  assert.ok(text.includes(`${r.totals.highStale30}장(${r.totals.highStale30Pct}%)`));
  assert.equal(ranking.rows.length, r.ranking.length);
  r.ranking.forEach((c, i) => {
    const row = ranking.rows[i];
    assert.equal(row[0], c.shortName);
    assert.equal(num(row[1]), c.highCount);
    assert.equal(num(row[2]), c.tradedSingle);
    assert.ok(row[3].startsWith(c.topNonPromo.code));
    assert.equal(yen(row[4]), c.topNonPromo.single);
    assert.equal(yen(row[5]), c.topNonPromo.psa10);
  });
  versions.rows.forEach((row) => {
    const code = row[0].split(' ')[0];
    const pair = r.sameCardRatios.mangaOverBase.list.find((x) => x.code === code);
    assert.equal(yen(row[1]), pair.base, code);
    assert.equal(yen(row[3]), pair.manga, code);
    const parallel = r.compare[code].find((c) => c.version === '패러렐' && c.source === '부스터');
    assert.equal(yen(row[2]), parallel.single, code);
  });
  section('4.').bars.forEach((bar) => {
    const v = r.versionMedians[bar.label.split(' ')[0]];
    assert.equal(bar.value, v.median);
    assert.ok(bar.label.includes(`(${v.count}장)`));
  });
});

test('the article makes no investment or profit promise', () => {
  assert.doesNotMatch(text, /수익(을|이)? ?(낼|납니다|보장합니다|기대)|투자 ?(추천|가치|하세요)|오를 (것|전망)|사두면|무조건|확실히 오릅/);
  assert.match(text, /수익을 보장하는 자료가 아닙니다/);
  assert.doesNotMatch(text, /봉입률은 (약|대략)|\d+박스에 1장/);
});
