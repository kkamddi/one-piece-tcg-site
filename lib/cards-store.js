import { readSupabaseCardById, readSupabaseCards, readSupabaseSeries } from './supabase-card-store.js';

let bundledCardsPromise;
let bundledSeriesPromise;
let bundledShopsPromise;

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

export async function readCards(filters = {}) {
  const supabaseCards = await readSupabaseCards(filters).catch((error) => {
    console.error('Failed to read Supabase cards, using bundled fallback', error);
    return null;
  });
  if (supabaseCards) return supabaseCards;
  return readBundledCards();
}

export async function readSeries() {
  const supabaseSeries = await readSupabaseSeries().catch((error) => {
    console.error('Failed to read Supabase series, using bundled fallback', error);
    return null;
  });
  if (supabaseSeries) return supabaseSeries;
  return readBundledSeries();
}

export async function readCardById(id) {
  const supabaseCard = await readSupabaseCardById(id).catch((error) => {
    console.error('Failed to read Supabase card, using bundled fallback', error);
    return null;
  });
  if (supabaseCard) return supabaseCard;
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

  return shops.filter((shop) => {
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
}
