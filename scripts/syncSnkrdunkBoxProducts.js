import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import boxMarketItems from '../src/data/box-market-items.js';

const CATALOG_URL = 'https://snkrdunk.com/en/v1/trading-cards';
const OUTPUT_URL = new URL('../src/data/box-market-items.js', import.meta.url);
const DEFAULT_LOOKBACK_DAYS = 21;
const FUTURE_WINDOW_DAYS = 45;
const MAX_PAGES = 3;
const PAGE_SIZE = 100;

function readNumberFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function toTokyoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function parseDateKey(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? NaN : date.getTime();
}

function isJapaneseProduct(product) {
  const number = String(product.productNumber || '').trim();
  const name = String(product.name || '').trim();
  if (!number.startsWith('OPC-TCG-')) return false;
  return !/(?:^|[-\s])EN(?:[-\s]|$)|\[EN\]/i.test(`${number} ${name}`);
}

function isBoxMarketProduct(product) {
  const name = String(product.name || '');
  return /\b(?:box|pack|deck|collection|set)\b|booster|starter|anniversary/i.test(name);
}

function getProductPreference(product) {
  const name = String(product.name || '');
  if (/\bbox\b/i.test(name)) return 3;
  if (/\bdeck\b/i.test(name)) return 2;
  return 1;
}

function normalizeCode(product) {
  const code = String(product.productNumber || '').trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return code || `SNKR-${product.id}`;
}

function formatItem(product) {
  const releaseDate = toTokyoDate(product.releasedAt);
  const previewImageUrl = String(product.thumbnailUrl || '').replace(/\?size=m$/i, '?size=l');
  return `  { code: '${normalizeCode(product)}', sortOrder: ${Number(releaseDate.replaceAll('-', '')) || Number(product.id)}, name: ${JSON.stringify(String(product.name || ''), null, 0)}, apparelId: ${Number(product.id)}, sourceUrl: 'https://snkrdunk.com/en/trading-cards/${Number(product.id)}?slide=right', releaseDate: '${releaseDate}', minPrice: null, previewImageUrl: ${JSON.stringify(previewImageUrl, null, 0)} },`;
}

async function fetchCatalogPage(page) {
  const url = new URL(CATALOG_URL);
  url.searchParams.set('brandId', 'onepiece');
  url.searchParams.set('order', 'latest');
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', String(PAGE_SIZE));
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 CardPoneCatalogSync/1.0'
    }
  });
  if (!response.ok) throw new Error(`SNKRDUNK catalog request failed (${response.status})`);
  const body = await response.json();
  return Array.isArray(body?.tradingCards) ? body.tradingCards : [];
}

async function main() {
  const lookbackDays = readNumberFlag('--lookback-days', DEFAULT_LOOKBACK_DAYS);
  const now = new Date();
  const earliest = addDays(now, -lookbackDays).getTime();
  const latest = addDays(now, FUTURE_WINDOW_DAYS).getTime();
  const pages = await Promise.all(Array.from({ length: MAX_PAGES }, (_, index) => fetchCatalogPage(index + 1)));
  const candidates = pages.flat()
    .filter(isJapaneseProduct)
    .filter(isBoxMarketProduct)
    .filter((product) => {
      const releasedAt = parseDateKey(toTokyoDate(product.releasedAt));
      return Number.isFinite(releasedAt) && releasedAt >= earliest && releasedAt <= latest;
    });

  const preferredByProductNumber = new Map();
  for (const product of candidates) {
    const key = String(product.productNumber || product.id);
    const current = preferredByProductNumber.get(key);
    if (!current || getProductPreference(product) > getProductPreference(current)) {
      preferredByProductNumber.set(key, product);
    }
  }

  const existingIds = new Set(boxMarketItems.map((item) => Number(item.apparelId)));
  const additions = [...preferredByProductNumber.values()]
    .filter((product) => !existingIds.has(Number(product.id)))
    .sort((a, b) => parseDateKey(toTokyoDate(a.releasedAt)) - parseDateKey(toTokyoDate(b.releasedAt)) || Number(a.id) - Number(b.id));

  if (additions.length === 0) {
    console.log(`No new Japanese box-market products. scanned=${candidates.length}`);
    return;
  }

  const outputPath = fileURLToPath(OUTPUT_URL);
  const source = await readFile(outputPath, 'utf8');
  if (!source.trimEnd().endsWith('];')) throw new Error('Unexpected box-market-items.js format');
  const prefix = source.trimEnd().slice(0, -2).trimEnd();
  const separator = prefix.endsWith(',') ? '\n' : ',\n';
  const next = `${prefix}${separator}${additions.map(formatItem).join('\n')}\n];\n`;
  await writeFile(outputPath, next, 'utf8');
  console.log(`Added ${additions.length} Japanese box-market products: ${additions.map((product) => `${product.productNumber}#${product.id}`).join(', ')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
