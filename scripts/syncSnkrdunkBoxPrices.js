import { readFile, writeFile } from 'node:fs/promises';
import boxMarketItems from '../src/data/box-market-items.js';

const OUTPUT_URL = new URL('../src/data/box-market-prices.json', import.meta.url);
const PRODUCT_API_BASE = 'https://snkrdunk.com/en/v1/products/SW---';
const CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;
const USD_TO_JPY = 155;
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
      const sourceCurrency = String(data?.currency || data?.productRetail?.currency || 'USD').toUpperCase();
      const minPrice = normalizePriceToUsd(data?.minPrice, sourceCurrency);
      return {
        minPrice,
        minPriceFormat: minPrice > 0 ? `US $${minPrice.toLocaleString('en-US')}` : '',
        priceCurrency: 'USD',
        listingCount: Number(data?.listingCount) || 0,
        previewImageUrl: String(data?.product?.thumbnailUrl || ''),
        releaseDate: normalizeReleaseDate(data?.productRetail?.releaseDate)
      };
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await wait(500 * attempt);
    }
  }
  return null;
}

async function main() {
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
