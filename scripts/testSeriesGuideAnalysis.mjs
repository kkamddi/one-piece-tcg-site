import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { analyzeSeriesCards, getSeriesGuideSections, getSeriesTopListings } from '../src/lib/series-guide-analysis.js';

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
  assert.deepEqual(sections.map((section) => section.heading), ['리더 1종', '카드 종류와 색상', '고가 카드 TOP 1']);
  assert.match(sections.at(-1).paragraphs[0], /등록 최저가/);
  assert.deepEqual(sections.at(-1).table.rows[0], ['Card', 'US $10', '₩14,570']);
  assert.equal(getSeriesGuideSections(analysis, { items: [] }, 'JP').length, 2);
});

test('the guide page and its pre-rendered HTML use the same section builder', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const seo = await readFile(new URL('./seriesGuideSeo.js', import.meta.url), 'utf8');
  assert.match(app, /getSeriesGuideSections\(analyzeSeriesCards\(cards\), getSeriesTopListings\(series, marketItems\), 'KR'\)/);
  assert.match(seo, /getSeriesGuideSections\(analysis, getSeriesTopListings\(series, marketItems\), japanese \? 'JP' : 'KR'\)/);
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
