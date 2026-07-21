import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import marketCards from '../src/data/market-cards.js';
import currentPopularIds from '../src/data/snkrdunk-popular-cards.js';

const CATALOG_URL = 'https://snkrdunk.com/en/v1/trading-cards';
const OUTPUT_URL = new URL('../src/data/snkrdunk-popular-cards.js', import.meta.url);
const POPULAR_RESULT_COUNT = 20;
const MIN_RESULT_COUNT = 15;
const MIN_KNOWN_CARD_COUNT = 10;

function toTokyoDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function fetchPopularCards() {
  const url = new URL(CATALOG_URL);
  url.searchParams.set('brandId', 'onepiece');
  url.searchParams.set('categoryId', '25');
  url.searchParams.set('order', 'popular');
  url.searchParams.set('page', '1');
  url.searchParams.set('perPage', String(POPULAR_RESULT_COUNT));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 CardPonePopularSync/1.0'
    }
  });
  if (!response.ok) throw new Error(`SNKRDUNK popular-card request failed (${response.status})`);

  const body = await response.json();
  return Array.isArray(body?.tradingCards) ? body.tradingCards : [];
}

function serializePopularCards(ids) {
  const rows = [];
  for (let index = 0; index < ids.length; index += 5) {
    rows.push(`  ${ids.slice(index, index + 5).map((id) => `'${id}'`).join(', ')}`);
  }
  return `const SNKRDUNK_POPULAR_APPAREL_IDS = Object.freeze([\n${rows.join(',\n')}\n]);\n\nexport const SNKRDUNK_POPULAR_UPDATED_AT = '${toTokyoDate(new Date())}';\nexport default SNKRDUNK_POPULAR_APPAREL_IDS;\n`;
}

async function main() {
  const products = await fetchPopularCards();
  const ids = [...new Set(products.map((item) => String(Number(item?.id) || '')).filter(Boolean))];
  if (ids.length < MIN_RESULT_COUNT) {
    throw new Error(`SNKRDUNK popular-card result is incomplete (${ids.length}/${POPULAR_RESULT_COUNT})`);
  }

  const knownIds = new Set(marketCards.map((item) => String(item.apparelId || '')));
  const knownCount = ids.filter((id) => knownIds.has(id)).length;
  if (knownCount < MIN_KNOWN_CARD_COUNT) {
    throw new Error(`Too few popular cards match the local market catalog (${knownCount}/${ids.length})`);
  }

  if (JSON.stringify(ids) === JSON.stringify(currentPopularIds)) {
    console.log(`SNKRDUNK popular-card ranking is unchanged. cards=${ids.length} known=${knownCount}`);
    return;
  }

  await writeFile(fileURLToPath(OUTPUT_URL), serializePopularCards(ids), 'utf8');
  console.log(`Updated SNKRDUNK popular-card ranking. cards=${ids.length} known=${knownCount} ids=${ids.join(',')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
