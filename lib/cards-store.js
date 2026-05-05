import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cardsFile = path.resolve(__dirname, '../src/data/cards.json');
const seriesFile = path.resolve(__dirname, '../src/data/series.json');
const shopsFile = path.resolve(__dirname, '../src/data/shops.json');

export async function readCards() {
  const raw = await readFile(cardsFile, 'utf8');
  return JSON.parse(raw);
}

export async function readSeries() {
  const raw = await readFile(seriesFile, 'utf8');
  return JSON.parse(raw);
}

export async function readShops() {
  const raw = await readFile(shopsFile, 'utf8');
  return JSON.parse(raw);
}

export function filterCards(cards, filters = {}) {
  const query = filters.q?.trim().toLowerCase();

  return cards.filter((card) => {
    const matchesLocale = !filters.locale || card.locale === filters.locale;
    const matchesSeries = !filters.series || card.series === filters.series;
    const matchesRarity = !filters.rarity || card.rarity === filters.rarity;
    const matchesQuery =
      !query ||
      [card.cardNo, card.name, card.type, card.seriesName, card.effect].some((value) =>
        String(value).toLowerCase().includes(query)
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
