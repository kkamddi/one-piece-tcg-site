import { readD1CardById, readD1Cards, readD1Series } from './d1-card-store.js';
import { readThroughR2Json } from './r2-json-cache.js';

let bundledCardsPromise;
let bundledSeriesPromise;
let bundledShopsPromise;
const CARD_SNAPSHOT_MAX_AGE_MS = 60 * 60 * 1000;
const SERIES_SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function readBundledCards() {
  bundledCardsPromise ??= import('../src/data/cards.json', { with: { type: 'json' } }).then((module) => module.default);
  return bundledCardsPromise;
}

async function readBundledSeries() {
  bundledSeriesPromise ??= import('../src/data/series.json', { with: { type: 'json' } }).then((module) => module.default);
  return bundledSeriesPromise;
}

async function readBundledShops() {
  bundledShopsPromise ??= import('../src/data/shops.json', { with: { type: 'json' } }).then((module) => module.default);
  return bundledShopsPromise;
}

async function loadD1CardSnapshot(locale) {
  const cards = await readD1Cards({ locale });
  return Array.isArray(cards) && cards.length ? cards : null;
}

async function loadD1SeriesSnapshot() {
  const series = await readD1Series();
  return Array.isArray(series) && series.length ? series : null;
}

export async function readCards(filters = {}) {
  const locale = String(filters.locale || '').toUpperCase();
  const snapshotLocales = ['KR', 'JP'];
  const requestedLocales = snapshotLocales.includes(locale) ? [locale] : snapshotLocales;
  const snapshotCards = await Promise.all(requestedLocales.map((snapshotLocale) => (
    readThroughR2Json(
      `public-data/cards-${snapshotLocale.toLowerCase()}-v1.json`,
      CARD_SNAPSHOT_MAX_AGE_MS,
      () => loadD1CardSnapshot(snapshotLocale)
    )
  ))).catch((error) => {
    console.error('Failed to read card snapshot, using D1 fallback', error);
    return null;
  });
  if (snapshotCards?.every(Array.isArray)) return snapshotCards.flat();

  const d1Cards = await readD1Cards(filters).catch((error) => {
    console.error('Failed to read D1 cards, using fallback', error);
    return null;
  });
  if (d1Cards) return d1Cards;
  return readBundledCards();
}

export async function readSeries() {
  const d1Series = await readThroughR2Json(
    'public-data/card-series-v1.json',
    SERIES_SNAPSHOT_MAX_AGE_MS,
    loadD1SeriesSnapshot
  ).catch((error) => {
    console.error('Failed to read D1 series, using fallback', error);
    return null;
  });
  if (d1Series) return d1Series;
  return readBundledSeries();
}

export async function readCardById(id) {
  const d1Card = await readD1CardById(id).catch((error) => {
    console.error('Failed to read D1 card, using fallback', error);
    return null;
  });
  if (d1Card) return d1Card;
  const cards = await readBundledCards();
  return cards.find((item) => item.id === id) ?? null;
}

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function isCardNoQuery(value = '') {
  return /^(OP|ST|EB|PRB|P)-?\d/i.test(String(value).trim());
}

export async function readShops() {
  return readBundledShops();
}

export function filterCards(cards, filters = {}) {
  const query = normalizeSearch(filters.q || '');
  const codeOnly = query && isCardNoQuery(filters.q);

  return cards.filter((card) => {
    const matchesLocale = !filters.locale || card.locale === filters.locale;
    const matchesSeries = !filters.series || card.series === filters.series;
    const matchesRarity = !filters.rarity || card.rarity === filters.rarity;
    const matchesQuery =
      !query ||
      (codeOnly
        ? [card.cardNo, card.baseCardNo, card.marketCode]
        : [card.cardNo, card.baseCardNo, card.name, card.type, card.seriesName, card.effect]
      ).some((value) =>
        normalizeSearch(value).includes(query)
      );

    return matchesLocale && matchesSeries && matchesRarity && matchesQuery;
  });
}

export function filterShops(shops, filters = {}) {
  const query = filters.q?.trim().toLowerCase();

  const filtered = shops.filter((shop) => {
    const matchesType = !filters.type || shop.sourceType === filters.type;
    const matchesSido = !filters.sido || filters.sido === '전체' || shop.sido === filters.sido;
    const matchesGungu = !filters.gungu || filters.gungu === '전체' || shop.gungu === filters.gungu;
    const matchesQuery =
      !query ||
      [shop.name, shop.address, shop.sido, shop.gungu].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      );

    return matchesType && matchesSido && matchesGungu && matchesQuery;
  });

  const uniqueShops = new Map();
  filtered.forEach((shop) => {
    const key = [shop?.name, shop?.address]
      .map((value) => String(value ?? '').trim().toLowerCase())
      .join('|');
    const existing = uniqueShops.get(key);

    if (!existing || (existing.sourceType !== 'official' && shop?.sourceType === 'official')) {
      uniqueShops.set(key, shop);
    }
  });

  return [...uniqueShops.values()];
}
