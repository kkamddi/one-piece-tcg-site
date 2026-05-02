import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cardsFile = path.resolve(__dirname, '../src/data/cards.json');
const seriesFile = path.resolve(__dirname, '../src/data/series.json');

export async function readCards() {
  const raw = await readFile(cardsFile, 'utf8');
  return JSON.parse(raw);
}

export async function readSeries() {
  const raw = await readFile(seriesFile, 'utf8');
  return JSON.parse(raw);
}

export function filterCards(cards, filters = {}) {
  const query = filters.q?.trim().toLowerCase();

  return cards.filter((card) => {
    const matchesSeries = !filters.series || card.series === filters.series;
    const matchesRarity = !filters.rarity || card.rarity === filters.rarity;
    const matchesQuery =
      !query ||
      [card.cardNo, card.name, card.type, card.seriesName].some((value) =>
        String(value).toLowerCase().includes(query)
      );

    return matchesSeries && matchesRarity && matchesQuery;
  });
}
