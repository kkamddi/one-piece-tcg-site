import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { buildSeriesHitCards, getBoxApparelIds, serializeSeriesHitCards } from './buildSeriesHitCards.mjs';
import { classifyScope, classifyVersion, getCardImageUrl } from '../lib/snkrdunk-trade-cards.js';
import { getSeriesGuideContext } from '../src/lib/series-guide-analysis.js';

const dataUrl = new URL('../src/data/series-hit-cards.json', import.meta.url);
const data = JSON.parse(await readFile(dataUrl, 'utf8'));
const IMAGE_PATTERN = /^https:\/\/cards\.optcgkorea\.com\/cards\/JP\/(?:OP|EB|ST|PRB)\d{2}-\d{3}(?:_p\d+)?\.webp$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

test('series-hit-cards.json keeps a compact, fixed shape', async () => {
  assert.match(data.updatedAt, DATE_PATTERN);
  assert.equal(data.basis, 'snkrdunk_latest_trade_day_median');
  assert.ok((await stat(dataUrl)).size < 80 * 1024);
  const ids = Object.keys(data.sets);
  assert.ok(ids.length >= 20);
  for (const id of ['OP13', 'OP14', 'OP16', 'EB04', 'PRB01']) assert.ok(ids.includes(id), id);
  for (const [id, set] of Object.entries(data.sets)) {
    // Random-pack boosters only; starter decks never get hit cards.
    assert.match(id, /^(OP|EB|PRB)\d{2}$/);
    assert.ok(set.hitCards.length <= 10, id);
    assert.deepEqual(Object.keys(set.counts).sort(), ['manga', 'parallel', 'sp']);
    Object.values(set.counts).forEach((count) => assert.ok(Number.isInteger(count) && count >= 0));
    for (const card of set.hitCards) {
      assert.deepEqual(Object.keys(card), ['code', 'name', 'nameJp', 'version', 'image', 'singleJpy', 'singleDate', 'psa10Jpy']);
      assert.match(card.code, /^[A-Z]+\d{2}-\d{3}$/);
      assert.ok(card.name && card.nameJp && card.version, `${id} ${card.code}`);
      assert.ok(Number.isInteger(card.singleJpy) && card.singleJpy > 0);
      assert.match(card.singleDate, DATE_PATTERN);
      assert.ok(card.psa10Jpy === null || (Number.isInteger(card.psa10Jpy) && card.psa10Jpy > 0));
      assert.ok(card.image === null || IMAGE_PATTERN.test(card.image), card.image);
    }
    if (set.box) {
      assert.ok(['trade', 'listing'].includes(set.box.basis));
      assert.ok(set.box.basis === 'trade' ? set.box.priceJpy > 0 : set.box.priceUsd > 0);
      assert.match(set.box.date, DATE_PATTERN);
    }
  }
  assert.ok(!ids.some((id) => id.startsWith('ST')));
  assert.equal(getSeriesGuideContext({ baseSeriesId: 'ST01', locale: 'KR' }, { hitCards: data }), null);
});

test('hit cards are the top Single trades, highest first, with no prize or promo cards', () => {
  for (const [id, set] of Object.entries(data.sets)) {
    const prices = set.hitCards.map((card) => card.singleJpy);
    assert.deepEqual(prices, [...prices].sort((left, right) => right - left), id);
    assert.ok(!set.hitCards.some((card) => /^P-/.test(card.code)), id);
  }
  // OP13: red manga Luffy leads; leader super parallels and pirate crew super parallels are not manga.
  assert.equal(data.sets.OP13.hitCards[0].code, 'OP13-118');
  assert.match(data.sets.OP13.hitCards[0].version, /망가/);
  const op17 = data.sets.OP17?.hitCards || [];
  op17.filter((card) => ['EB04-061', 'OP17-118', 'OP17-079'].includes(card.code) && /슈퍼 패러렐/.test(card.version))
    .forEach((card) => assert.doesNotMatch(card.version, /망가/));
});

test('manga rule, scope rule and image URLs follow the shared SNKRDUNK rules', () => {
  const version = (name, cardId = null, manga = new Set()) => classifyVersion({ name }, cardId, manga).version;
  assert.equal(version('Shanks SR-SP (Comic Parallel) [OP09-004](Booster Pack)'), '망가');
  assert.equal(version('Sakazuki SR-SP (Manga Alt Art) [OP16-065](Booster Pack)'), '망가');
  assert.equal(version('Nico Robin L-SP (Manga Alt Art) [EB05-010](Extra Booster)'), '리더 슈퍼 패러렐');
  assert.equal(version('Monkey.D.Luffy L-SP (Manga Alt Art) [OP17-079](Booster Pack)'), '리더 슈퍼 패러렐');
  assert.equal(version('Monkey.D.Luffy SEC-SP (Manga Alt Art) :Pirate Crew Super Parallel [EB04-061](Booster Pack)'), '해적단 슈퍼 패러렐');
  assert.equal(version('Rocks D. Xebec SEC-SP (Manga Alt Art) :Pirate Crew Super Parallel [OP17-118](Booster Pack)'), '해적단 슈퍼 패러렐');
  assert.equal(version('Monkey.D.Luffy SEC-RSP [OP13-118](Booster Pack)'), '망가 레드');
  assert.equal(version('Ace SR-SPC [OP02-013](Booster Pack)'), 'SP');
  assert.equal(version('Ace SR-SPC [OP02-013](Booster Pack)', 'JP::OP02-013_p2', new Set(['JP::OP02-013_p2'])), '망가');
  assert.equal(classifyScope({ name: 'Luffy SEC :Serial Numbered :Champion\'s Prize [EB04-061]', setName: 'Promotional Card "Flagship Battle"', code: 'EB04-061' }), 'prize');
  assert.equal(classifyScope({ name: 'Yamato P [P-046]', setName: 'ONE PIECE magazine', code: 'P-046' }), 'promo');
  assert.equal(classifyScope({ name: 'DON!! Card (Luffy)', setName: 'Booster Pack', code: 'OP13-DON' }), 'sealedOrDon');
  assert.equal(getCardImageUrl('JP::OP13-118_p3'), 'https://cards.optcgkorea.com/cards/JP/OP13-118_p3.webp');
  assert.equal(getCardImageUrl('KR::OP13-118'), null);
});

test('the builder keeps each booster to its own product and reads box prices', () => {
  const booster = 'Booster Pack "CARRYING ON HIS WILL"';
  const marketCards = [
    { apparelId: 1, code: 'OP13-118', locale: 'JP', name: 'Monkey.D.Luffy SEC-RSP [OP13-118](Booster Pack)', setName: booster },
    { apparelId: 2, code: 'OP13-118', locale: 'JP', name: 'Monkey.D.Luffy SEC [OP13-118](Booster Pack)', setName: booster },
    { apparelId: 3, code: 'OP09-004', locale: 'JP', name: 'Shanks SR-SPC :Gold Background [OP09-004](Booster Pack)', setName: booster },
    { apparelId: 4, code: 'OP13-118', locale: 'JP', name: 'Monkey.D.Luffy SEC :Serial Numbered :Winner Prize [OP13-118]', setName: 'Promotional Card "Flagship Battle"' },
    { apparelId: 5, code: 'OP13-118', locale: 'JP', name: 'Monkey.D.Luffy SEC-P [OP13-118](Premium Booster)', setName: 'Premium Booster "One Piece Card The Best vol.3"' },
    { apparelId: 6, code: 'OP13-118', locale: 'EN', name: 'Monkey.D.Luffy SEC [OP13-118] [EN]', setName: booster },
    { apparelId: 7, code: 'ST01-012', locale: 'JP', name: 'Luffy SR [ST01-012](Start Deck)', setName: 'Start Deck "Straw Hat Crew"' }
  ];
  const payload = {
    basis: 'snkrdunk_latest_trade_day_median',
    items: [1, 2, 3, 4, 5, 6, 7, 9].map((apparelId) => ({ apparelId, aPriceJpy: apparelId === 9 ? 15000 : 100000 - apparelId * 1000, psa10PriceJpy: null, aTradeDate: '2026-10-05', psa10TradeDate: null }))
  };
  const catalog = [
    { id: 'JP::OP13-118', locale: 'JP', cardNo: 'OP13-118', name: 'モンキー・Ｄ・ルフィ', series: 'JP-OP13', baseSeriesId: 'OP13' },
    { id: 'JP::OP13-118_p3', locale: 'JP', cardNo: 'OP13-118', name: 'モンキー・Ｄ・ルフィ', series: 'JP-OP13', baseSeriesId: 'OP13', rarity: 'SEC' },
    { id: 'KR::OP13-118', locale: 'KR', cardNo: 'OP13-118', name: '몽키 D. 루피', series: 'KR-OP13', baseSeriesId: 'OP13' }
  ];
  const result = buildSeriesHitCards({
    payload,
    marketCards,
    cardMarketLinks: [{ apparelId: 1, cardId: 'JP::OP13-118_p3', status: 'approved' }],
    catalog,
    seriesList: [{ id: 'KR-OP13', baseSeriesId: 'OP13', locale: 'KR' }, { id: 'JP-ST01', baseSeriesId: 'ST01', locale: 'JP' }],
    boxItems: [{ code: 'OP-13', apparelId: 9, name: 'ONE PIECE Card Game Booster Pack "CARRYING ON HIS WILL" Box' }, { code: 'OP-13-DON', apparelId: 10, name: 'DON!! Card' }],
    boxPrices: { updatedAt: '2026-10-08T00:00:00Z', items: {} },
    mangaGroups: [],
    updatedAt: '2026-10-09',
    minItems: 1
  });
  assert.deepEqual(Object.keys(result.sets), ['OP13']);
  const { hitCards, counts, box } = result.sets.OP13;
  assert.deepEqual(hitCards.map((card) => [card.code, card.version, card.singleJpy]), [
    ['OP13-118', 'SEC 망가 레드', 99000],
    ['OP13-118', 'SEC', 98000],
    ['OP09-004', 'SR SP 금색', 97000]
  ]);
  assert.equal(hitCards[0].name, '몽키 D. 루피');
  assert.equal(hitCards[0].image, 'https://cards.optcgkorea.com/cards/JP/OP13-118_p3.webp');
  assert.deepEqual(counts, { manga: 1, sp: 1, parallel: 0 });
  assert.deepEqual(box, { basis: 'trade', priceJpy: 15000, date: '2026-10-05' });
  assert.deepEqual([...getBoxApparelIds([{ code: 'OPC-TCG-EB-05', apparelId: 3, name: 'Extra Booster "Heroines Edition Vol.2" Box' }, { code: 'EB-03-SP', apparelId: 4, name: 'Special Set' }])], [['EB05', 3]]);
  // Listing fallback when no box trade exists.
  const listing = buildSeriesHitCards({
    payload: { ...payload, items: payload.items.filter((item) => item.apparelId !== 9) },
    marketCards,
    cardMarketLinks: [],
    catalog,
    seriesList: [{ id: 'KR-OP13', baseSeriesId: 'OP13', locale: 'KR' }],
    boxItems: [{ code: 'OP-13', apparelId: 9, name: 'Booster Pack Box' }],
    boxPrices: { updatedAt: '2026-10-08T00:00:00Z', items: { 9: { minPrice: 114, priceCurrency: 'USD' } } },
    mangaGroups: [],
    updatedAt: '2026-10-09',
    minItems: 1
  });
  assert.deepEqual(listing.sets.OP13.box, { basis: 'listing', priceUsd: 114, date: '2026-10-08' });
  assert.match(serializeSeriesHitCards(listing), /^\{\n {2}"updatedAt": "2026-10-09",/);
  assert.deepEqual(JSON.parse(serializeSeriesHitCards(listing)), listing);
  assert.throws(() => buildSeriesHitCards({ payload: { basis: 'other', items: [] } }), /unexpected basis/);
});
