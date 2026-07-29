import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import marketCards from '../src/data/market-cards.js';
import currentPopularIds from '../src/data/snkrdunk-popular-cards.js';

const CATALOG_URL = 'https://snkrdunk.com/en/v1/trading-cards';
const MARKET_API_ORIGIN = process.env.MARKET_API_ORIGIN || 'https://www.optcgkorea.com';
const OUTPUT_URL = new URL('../src/data/snkrdunk-popular-cards.js', import.meta.url);
const MARKET_OUTPUT_URL = new URL('../src/data/market-cards.js', import.meta.url);
const POPULAR_RESULT_COUNT = 20;
const MIN_RESULT_COUNT = 15;
const MIN_KNOWN_CARD_COUNT = 10;
const MARKET_USD_TO_JPY = 155;
const MARKET_USD_TO_KRW = MARKET_USD_TO_JPY * 9.4;

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

function parseListingCount(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function serializeCompactMarketCards(value) {
  const json = JSON.stringify(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `const e=JSON.parse(\`${json}\`);export{e as default};\n`;
}

function normalizeCatalogPrice(product) {
  const price = Number(product?.minPrice || 0);
  const formatted = String(product?.minPriceFormat || '');
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (/₩/.test(formatted)) return Math.round(price / MARKET_USD_TO_KRW);
  if (/[¥￥]/.test(formatted)) return Math.round(price / MARKET_USD_TO_JPY);
  if (/\$/.test(formatted)) return Math.round(price);
  return 0;
}

async function fetchPopularMarketPrice(product) {
  const apparelId = Number(product?.id || 0);
  if (!apparelId) return 0;
  try {
    const url = new URL('/api/market', MARKET_API_ORIGIN);
    url.searchParams.set('apparelId', String(apparelId));
    url.searchParams.set('summary', '1');
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'CardPonePopularSync/1.0'
      }
    });
    if (!response.ok) throw new Error(`market API ${response.status}`);
    const body = await response.json();
    const priceJpy = Number(body?.latestByCondition?.a?.price || 0);
    if (Number.isFinite(priceJpy) && priceJpy > 0) {
      return Math.round(priceJpy / MARKET_USD_TO_JPY);
    }
  } catch (error) {
    console.warn(`Popular price fallback for ${apparelId}: ${error instanceof Error ? error.message : error}`);
  }
  return normalizeCatalogPrice(product);
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

  const productsById = new Map(products.map((item) => [String(Number(item?.id) || ''), item]));
  const priceEntries = await Promise.all(products.map(async (product) => [
    String(Number(product?.id) || ''),
    await fetchPopularMarketPrice(product)
  ]));
  const pricesById = new Map(priceEntries);
  const nextMarketCards = marketCards.map((item) => {
    const id = String(item.apparelId || '');
    const product = productsById.get(id);
    if (!product) return item;
    return {
      ...item,
      minPrice: pricesById.get(id) || 0,
      minPriceFormat: pricesById.get(id) > 0 ? `US $ ${pricesById.get(id)}` : 'US $ -',
      listingCount: parseListingCount(product.listingCount)
    };
  });

  const rankingChanged = JSON.stringify(ids) !== JSON.stringify(currentPopularIds);
  const pricesChanged = JSON.stringify(nextMarketCards) !== JSON.stringify(marketCards);

  if (rankingChanged) {
    await writeFile(fileURLToPath(OUTPUT_URL), serializePopularCards(ids), 'utf8');
  }
  if (pricesChanged) {
    await writeFile(fileURLToPath(MARKET_OUTPUT_URL), serializeCompactMarketCards(nextMarketCards), 'utf8');
  }

  console.log(
    `SNKRDUNK popular-card sync complete. cards=${ids.length} known=${knownCount}`
    + ` rankingChanged=${rankingChanged} pricesChanged=${pricesChanged} ids=${ids.join(',')}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
