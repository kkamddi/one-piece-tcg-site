import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  analyzeSeriesCards,
  getJapaneseVersionLabel,
  getRandomPackGuideDescription,
  getSeriesGuideContext,
  getSeriesGuideSections,
  getSeriesReleaseDates,
  getSeriesTopListings,
  isRandomPackSeries
} from '../src/lib/series-guide-analysis.js';

test('normalizes Korean, Japanese and English card fields into the same facts', () => {
  const cards = [
    { cardNo: 'OP09-001', name: '샹크스', category: 'LEADER', colorKo: '적색', type: '빨간 머리 해적단', effect: '' },
    { cardNo: 'OP09-002', name: 'A', category: 'CHARACTER', colorKo: '色 赤, 녹색', cost: 'コスト 3', counter: 'カウンター 1000', type: '特徴 四皇/赤髪海賊団', effect: 'テキスト 【登場時】 【ブロッカー】' },
    { cardNo: 'OP09-002_p1', name: 'A', category: 'CHARACTER', colorKo: '色 赤', cost: '3', counter: '1000', type: '四皇', effect: '' },
    { cardNo: 'OP09-003', name: 'B', category: 'CHARACTER', colorKo: 'Color Blue', cost: 'Cost 5', counter: '-', type: 'Type Navy', effect: 'Effect [On Play] draw' },
    { cardNo: 'OP09-004', name: 'C', category: 'EVENT', colorKo: '청색', counter: '-', type: '', effect: '【카운터】' }
  ];
  const result = analyzeSeriesCards(cards);
  assert.equal(result.baseCount, 4);
  assert.equal(result.variantCount, 1);
  assert.deepEqual(result.leaders, [{ cardNo: 'OP09-001', name: '샹크스', colors: ['red'] }]);
  assert.deepEqual(result.colors, [['blue', 2], ['red', 1], ['green', 1]]);
  assert.deepEqual(result.categories, [['LEADER', 1], ['CHARACTER', 2], ['EVENT', 1]]);
  assert.deepEqual(result.costCurve, [[3, 1], [5, 1]]);
  assert.deepEqual(result.counters, [[1000, 1], [0, 1]]);
  assert.deepEqual(result.keywords, [['onPlay', 2], ['blocker', 1], ['counter', 1]]);
});

test('top listings stay within the main product even when SNKRDUNK spells it differently', () => {
  const series = { baseSeriesId: 'OP06', locale: 'KR' };
  const market = [
    { code: 'OP06-118', locale: 'JP', setName: 'Booster Pack Wings of Captain', name: 'Zoro SEC', minPrice: 7, apparelId: 1 },
    { code: 'OP06-118', locale: 'JP', setName: 'Booster Pack "Wings Of The Captain"', name: 'Zoro SEC-SP', minPrice: 2665, apparelId: 2 },
    { code: 'OP06-001', locale: 'JP', setName: 'Booster Pack Wings of Captain', name: 'Uta L', minPrice: 45, apparelId: 3 },
    { code: 'OP06-118', locale: 'JP', setName: 'Premium Booster "One Piece Card The Best"', name: 'Zoro reprint', minPrice: 5000, apparelId: 4 },
    { code: 'OP06-119', locale: 'EN', setName: 'Booster Pack Wings of Captain', name: 'EN Sanji', minPrice: 900, apparelId: 5 }
  ];
  const listings = getSeriesTopListings(series, market);
  assert.equal(listings.locale, 'JP');
  assert.deepEqual(listings.items.map((item) => item.apparelId), [2, 3, 1]);
  assert.deepEqual(getSeriesTopListings({ baseSeriesId: '', locale: 'JP' }, market).items, []);
});

test('sections label prices as listings and skip empty data', () => {
  const analysis = analyzeSeriesCards([{ cardNo: 'ST01-001', name: 'L', category: 'LEADER', colorKo: '적색', type: '', effect: '' }]);
  const sections = getSeriesGuideSections(analysis, { locale: 'JP', setName: 'Start Deck', items: [{ name: 'Card', minPrice: 10 }] }, 'KR');
  assert.deepEqual(sections.map((section) => section.heading), ['리더 1종', '카드 종류와 색상', '힛카드(고가 카드) TOP 1']);
  assert.match(sections.at(-1).paragraphs[0], /등록 최저가/);
  assert.deepEqual(sections.at(-1).table.rows[0], ['Card', 'US $10', '₩14,570']);
  assert.equal(getSeriesGuideSections(analysis, { items: [] }, 'JP').length, 2);
});

test('the guide page and its pre-rendered HTML use the same section builder', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const seo = await readFile(new URL('./seriesGuideSeo.js', import.meta.url), 'utf8');
  assert.match(app, /getSeriesGuideSections\(analyzeSeriesCards\(cards\), getSeriesTopListings\(series, marketItems\), isJp \? 'JP' : 'KR', guideContext\)/);
  assert.match(app, /getSeriesGuideContext\(series, \{ hitCards: seriesHitCards, topics: topicsData, cardCount \}\)/);
  // /jp series guides render Japanese text, matching their Japanese pre-rendered HTML.
  assert.match(app, /const isJp = getPathLocale\(window\.location\.pathname\) === 'JP';/);
  assert.match(app, /tx\('수록 카드 전체 보기', '収録カードをすべて見る'\)/);
  assert.match(seo, /getSeriesGuideSections\(analysis, getSeriesTopListings\(series, marketItems\), japanese \? 'JP' : 'KR', context\)/);
  assert.match(seo, /getSeriesGuideContext\(series, \{ hitCards: seriesHitCards, topics: topicsData, cardCount, today \}\)/);
  // Meta descriptions for OP / EB / PRB guides come from one function on both sides.
  assert.match(app, /getRandomPackGuideDescription\(guideContext, \{ name, cardCount, localeLabel, japanese: true \}\)/);
  assert.match(seo, /getRandomPackGuideDescription\(context, \{ name, cardCount, localeLabel, japanese \}\)/);
  assert.doesNotMatch(app, /이 시리즈에서 바로 확인할 것/);
});

test('box facts count JP hit cards and spread listings from the main product only', async () => {
  const { analyzeBoxSeries, getBoxGuideSections } = await import('../src/lib/series-guide-analysis.js');
  const cards = [
    { id: 'JP::OP09-118', locale: 'JP', series: 'JP-OP09', rarity: 'SEC' },
    { id: 'JP::OP09-118_p1', locale: 'JP', series: 'JP-OP09', rarity: 'SEC' },
    { id: 'JP::OP09-004_p1', locale: 'JP', series: 'JP-OP09', rarity: 'SR' },
    { id: 'JP::OP09-010', locale: 'JP', series: 'JP-OP09', rarity: 'R' },
    { id: 'JP::OP09-051_p1', locale: 'JP', series: 'JP-OP09', rarity: 'SPカード' },
    { id: 'KR::OP09-118', locale: 'KR', series: 'KR-OP09', rarity: 'SEC' }
  ];
  const market = Array.from({ length: 12 }, (_, index) => ({ code: `OP09-${String(index).padStart(3, '0')}`, locale: 'JP', setName: 'Booster Pack "Emperors In The New World"', name: index === 0 ? 'Luffy SEC-SP (Comic Parallel)' : 'Card', minPrice: [800, 150, 30, 5][index % 4] }));
  market.push({ code: 'OP09-001', locale: 'JP', setName: 'Premium Booster', name: 'Reprint', minPrice: 9999 });
  const manga = [{ set: 'OP-09', cards: [{ nameKo: '버기', variant: '' }, { nameKo: '루피', variant: 'SEC' }] }, { set: 'OP-10', cards: [{ nameKo: '다른 카드' }] }];
  const box = analyzeBoxSeries('OP09', cards, market, manga);
  assert.deepEqual({ secret: box.secret, special: box.special, parallel: box.parallel, manga: box.manga, priced: box.priced }, { secret: 1, special: 1, parallel: 2, manga: 2, priced: 12 });
  assert.deepEqual(box.mangaNames, ['버기', '루피 (SEC)']);
  assert.deepEqual(box.buckets.map((bucket) => bucket[2]), [3, 3, 3, 3]);
  const sections = getBoxGuideSections(box);
  assert.deepEqual(sections.map((section) => section.heading), ['히트 카드 구성', 'SNKRDUNK 등록가 분포']);
  assert.deepEqual(sections[0].stats.map((stat) => stat.value), ['1종', '1종', '2종', '2종']);
  assert.equal(sections[0].items.at(-1), '망가 레어: 버기 · 루피 (SEC)');
  assert.equal(sections[1].stats[0].value, 'US $90 / ₩131,130');
  assert.deepEqual(sections[1].bars.map((bar) => bar.value), [3, 3, 3, 3]);
  assert.equal(getBoxGuideSections({ ...box, priced: 2 }).length, 1);
});

test('the box guide and its pre-rendered HTML use the same section builder', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const seo = await readFile(new URL('./boxRecommendationSeo.js', import.meta.url), 'utf8');
  assert.match(app, /getBoxGuideSections\(analyzeBoxSeries\(detailSeriesId, cards, marketCards, MANGA_COLLECTION_GROUPS\)\)/);
  assert.match(seo, /getBoxGuideSections\(analyzeBoxSeries\(seriesId, cardsData, marketItems, MANGA_COLLECTION_GROUPS\)\)/);
  assert.doesNotMatch(seo, /heading: '확인 순서'/);
});

const hitData = {
  updatedAt: '2026-10-09',
  sets: {
    OP13: {
      hitCards: [
        { code: 'OP13-118', name: '몽키 D. 루피', nameJp: 'モンキー・Ｄ・ルフィ', version: 'SEC 망가 레드', image: 'https://cards.optcgkorea.com/cards/JP/OP13-118_p3.webp', singleJpy: 1739978, singleDate: '2026-10-05', psa10Jpy: 2547198 },
        { code: 'OP09-004', name: '샹크스', nameJp: 'シャンクス', version: 'SR SP 금색', image: null, singleJpy: 82809, singleDate: '2025-12-03', psa10Jpy: null }
      ],
      counts: { manga: 6, sp: 11, parallel: 35 },
      box: { basis: 'listing', priceUsd: 114, date: '2026-10-08' }
    }
  }
};
const topics = [
  { calendarKind: 'release', locale: 'JP', scheduleDate: '2025-08-23', title: 'ブースターパック 受け継がれる意志【OP-13】' },
  { calendarKind: 'release', locale: 'KR', scheduleDate: '2026-06-26', title: '[OPK-13] 부스터 팩 계승되는 의지' },
  { calendarKind: 'release', locale: 'JP', scheduleDate: '2026-01-31', title: 'エクストラブースター EGGHEAD CRISIS【EB-04】' },
  { calendarKind: 'release', locale: 'KR', scheduleDate: '2026-10-23', title: '[EBK-04] 엑스트라 부스터 팩 EGGHEAD CRISIS' }
];
const opCards = [
  { cardNo: 'OP13-001', name: '루피', category: 'LEADER', rarity: 'L', colorKo: '적색', type: '', effect: '' },
  { cardNo: 'OP13-118', name: '루피', category: 'CHARACTER', rarity: 'SEC', colorKo: '적색', cost: '10', counter: '-', type: '', effect: '' },
  { cardNo: 'OP13-118_p1', name: '루피', category: 'CHARACTER', rarity: 'SEC', colorKo: '적색', type: '', effect: '' }
];

test('random-pack guides lead with release, hit-card trades and box price, then condensed card facts', () => {
  assert.equal(isRandomPackSeries('KR-OP13'), true);
  assert.equal(isRandomPackSeries('PRB01'), true);
  assert.equal(isRandomPackSeries('ST01'), false);
  assert.deepEqual(getSeriesReleaseDates('OP13', topics), { jp: '2025-08-23', kr: '2026-06-26' });
  const context = getSeriesGuideContext({ baseSeriesId: 'OP13', locale: 'KR' }, { hitCards: hitData, topics, cardCount: 192, today: '2026-10-09' });
  assert.equal(context.market, hitData.sets.OP13);
  const sections = getSeriesGuideSections(analyzeSeriesCards(opCards), { locale: 'JP', setName: 'x', items: [{ name: 'Listing', minPrice: 1 }] }, 'KR', context);
  assert.deepEqual(sections.map((section) => section.heading), ['발매 정보', 'OP13 힛카드 TOP 2', '박스 시세', '리더 1종', '레어도 구성', '카드 종류와 색상', '가격 기준']);
  const [release, hits, box] = sections;
  assert.deepEqual(release.table.rows, [['2025.08.23', '2026.06.26', '192장 (기본 2종)']]);
  assert.equal(release.paragraphs[0], '한글판은 일본판보다 307일 늦게 발매됐습니다.');
  // Korean guides read Japanese SNKRDUNK trades and say so.
  assert.match(hits.paragraphs[0], /^일본판 SNKRDUNK 최근 Single 거래가 순이며, 거래가 있는 망가는 6종·SP는 11종입니다\.$/);
  assert.deepEqual(hits.table.rows[0], ['1', '몽키 D. 루피', 'OP13-118', 'SEC 망가 레드', '¥1,739,978', '10-05']);
  assert.equal(hits.table.rows[1][5], '2025-12-03');
  assert.deepEqual(hits.images.map((image) => image.caption), ['1위 몽키 D. 루피 SEC 망가 레드']);
  assert.match(box.paragraphs[0], /US \$114\(약 ₩166,098\)/);
  assert.deepEqual(box.links.map((link) => link.href), ['/guide/box-recommendation']);
  assert.match(sections.at(-1).paragraphs[0], /2026\.10\.09 기준 일본판 SNKRDUNK 거래가\(박스는 등록가\).*한국판 가격과 다르고 수익을 보장하지 않습니다/);
  // Each section is one lead plus one table or list; low-value gameplay blocks are gone.
  for (const section of sections) {
    assert.ok((section.paragraphs || []).length <= 1, section.heading);
    assert.ok([section.table, section.stats, section.bars, section.items?.length ? section.items : null].filter(Boolean).length <= 1, section.heading);
  }
  assert.ok(!sections.some((section) => /효과 키워드|주요 특징|코스트/.test(section.heading)));
});

test('Japanese random-pack guides use Japanese names and version labels', () => {
  const context = getSeriesGuideContext({ baseSeriesId: 'OP13', locale: 'JP' }, { hitCards: hitData, topics, cardCount: 192, today: '2026-10-09' });
  const sections = getSeriesGuideSections(analyzeSeriesCards(opCards), null, 'JP', context);
  assert.deepEqual(sections.slice(0, 3).map((section) => section.heading), ['発売情報', 'OP13 高額カード TOP 2', 'BOX相場']);
  assert.deepEqual(sections[1].table.rows[0], ['1', 'モンキー・Ｄ・ルフィ', 'OP13-118', 'SEC コミパラ(赤)', '¥1,739,978', '10-05']);
  assert.equal(getJapaneseVersionLabel('해적단 슈퍼 패러렐'), '海賊団スーパーパラレル');
  assert.equal(getJapaneseVersionLabel('SR SP 은색'), 'SR SP 銀');
  assert.equal(getJapaneseVersionLabel('리더 패러렐'), 'リーダー パラレル');
});

test('random-pack fallbacks: upcoming Korean release, no trades, English editions', () => {
  const upcoming = getSeriesGuideContext({ baseSeriesId: 'EB04', locale: 'JP' }, { hitCards: hitData, topics, cardCount: 10, today: '2026-10-09' });
  const sections = getSeriesGuideSections(analyzeSeriesCards([]), { locale: 'JP', setName: 'EGGHEAD CRISIS', items: [{ name: 'Card', minPrice: 10 }] }, 'KR', upcoming);
  assert.deepEqual(sections.map((section) => section.heading), ['발매 정보', '힛카드(고가 카드) TOP 1']);
  assert.equal(sections[0].paragraphs[0], '한글판은 일본판보다 265일 늦은 2026.10.23 발매 예정입니다.');
  assert.deepEqual(sections[0].table.rows[0], ['2026.01.31', '2026.10.23 예정', '10장']);
  assert.match(sections[1].paragraphs[0], /등록 최저가/);
  const english = getSeriesGuideContext({ baseSeriesId: 'OP13', locale: 'EN' }, { hitCards: hitData, topics });
  assert.equal(english.market, null);
  assert.equal(getSeriesGuideContext({ baseSeriesId: 'ST01', locale: 'KR' }, { hitCards: hitData, topics }), null);
  const description = getRandomPackGuideDescription(upcoming, { name: 'EGGHEAD CRISIS', cardCount: 10, localeLabel: '일본판' });
  assert.equal(description, '원피스카드 일본판 EB04 EGGHEAD CRISIS의 발매일, 힛카드, 수록 카드 10장 구성.');
});

test('random-pack guide HTML: OP13 has trades, starter decks keep their sections', async () => {
  const { getSeriesGuideEntries } = await import('./seriesGuideSeo.js');
  const entries = getSeriesGuideEntries({ today: '2026-10-09' });
  const op13 = entries.find((entry) => entry.pathname === '/guides/series/krop13').seo;
  assert.match(op13.title, /^OP13 계승되는 의지 \(13탄\) 카드 리스트·힛카드/);
  assert.match(op13.description, /힛카드 TOP 10 실거래가, 박스 시세/);
  assert.equal(op13.sections[0].heading, '발매 정보');
  assert.equal(op13.sections[1].heading, 'OP13 힛카드 TOP 10');
  const st01 = entries.find((entry) => entry.pathname === '/guides/series/krst01').seo;
  assert.deepEqual(st01.sections.map((section) => section.heading).slice(0, 2), ['레어도 구성', '수록 카드 예시']);
  assert.ok(!st01.sections.some((section) => /발매 정보|가격 기준/.test(section.heading)));
  const japanese = getSeriesGuideEntries({ japanese: true, today: '2026-10-09' }).find((entry) => entry.pathname === '/jp/guides/series/jpop16').seo;
  assert.equal(japanese.sections[1].heading, 'OP16 高額カード TOP 10');
});
