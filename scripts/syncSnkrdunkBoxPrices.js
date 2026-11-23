import { readFile, writeFile } from 'node:fs/promises';
import boxMarketItems from '../src/data/box-market-items.js';

const OUTPUT_URL = new URL('../src/data/box-market-prices.json', import.meta.url);
// The English product API (en/v1/products/SW---<id>) started returning 404 on 2026-11-19; the Japanese apparel API
// still serves the same listing data, priced in yen.
const PRODUCT_API_BASE = 'https://snkrdunk.com/v1/apparels/';
const FX_URL = 'https://www.optcgkorea.com/api/fx';
const CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;
let USD_TO_JPY = 155;
const JPY_TO_KRW = 9.4;

function normalizeReleaseDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizePriceToUsd(amount, currency) {
  const value = Number(amount) || 0;
  if (value <= 0) return 0;
  if (currency === 'KRW') return Math.round(value / (USD_TO_JPY * JPY_TO_KRW));
  if (currency === 'JPY') return Math.round(value / USD_TO_JPY);
  return Math.round(value);
}

async function readPreviousSnapshot() {
  try {
    return JSON.parse(await readFile(OUTPUT_URL, 'utf8'));
  } catch {
    return { updatedAt: '', items: {} };
  }
}

async function fetchPrice(item) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${PRODUCT_API_BASE}${item.apparelId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 CardPoneCatalogBot/1.0'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // Single DON!! cards are listed as "used"; the English API counted both kinds of listing.
      const yenPrices = [data?.minPrice, data?.usedMinPrice].map(Number).filter((value) => value > 0);
      const minPrice = normalizePriceToUsd(yenPrices.length ? Math.min(...yenPrices) : 0, 'JPY');
      return {
        minPrice,
        minPriceFormat: minPrice > 0 ? `US $${minPrice.toLocaleString('en-US')}` : '',
        priceCurrency: 'USD',
        listingCount: (Number(data?.listingCount) || 0) + (Number(data?.usedListingCount) || 0),
        previewImageUrl: data?.primaryMedia?.imageUrl ? `${data.primaryMedia.imageUrl}?size=s` : '',
        releaseDate: normalizeReleaseDate(data?.releasedAt)
      };
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await wait(500 * attempt);
    }
  }
  return null;
}

async function loadUsdToJpy() {
  try {
    const response = await fetch(FX_URL, { signal: AbortSignal.timeout(15000) });
    const rate = Number((await response.json())?.jpyPerUsd);
    if (rate > 50 && rate < 500) USD_TO_JPY = rate;
  } catch (error) {
    console.warn(`[box-price] fx unavailable, using JPY ${USD_TO_JPY}/USD: ${error.message}`);
  }
}

async function main() {
  await loadUsdToJpy();
  const previous = await readPreviousSnapshot();
  const nextItems = { ...(previous.items || {}) };
  let cursor = 0;
  let updated = 0;
  let failed = 0;

  async function worker() {
    while (cursor < boxMarketItems.length) {
      const item = boxMarketItems[cursor];
      cursor += 1;
      const key = String(item.apparelId);
      try {
        const snapshot = await fetchPrice(item);
        nextItems[key] = snapshot;
        updated += 1;
      } catch (error) {
        failed += 1;
        console.warn(`[box-price] ${item.code} (${key}) failed: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const validIds = new Set(boxMarketItems.map((item) => String(item.apparelId)));
  for (const key of Object.keys(nextItems)) {
    if (!validIds.has(key)) delete nextItems[key];
  }

  const sortedItems = Object.fromEntries(
    Object.entries(nextItems).sort(([left], [right]) => Number(left) - Number(right))
  );
  await writeFile(OUTPUT_URL, `${JSON.stringify({
    updatedAt: new Date().toISOString(),
    items: sortedItems
  }, null, 2)}\n`, 'utf8');

  console.log(`[box-price] updated=${updated} failed=${failed} total=${boxMarketItems.length}`);
  if (failed > 0 && updated === 0) process.exitCode = 1;
}

await main();
