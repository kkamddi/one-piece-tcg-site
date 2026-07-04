import fs from 'node:fs';
import path from 'node:path';
import marketCards from '../src/data/market-cards.js';

const MARKET_PATH = path.resolve('src/data/market-cards.js');
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const shouldUpdateExisting = args.has('--update-existing');
const perPage = Number(process.argv.find((arg) => arg.startsWith('--per-page='))?.split('=')[1] || 100);
const delayMs = Number(process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || 400);
const maxPages = Number(process.argv.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1] || 200);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseSetName(name) {
  const match = String(name || '').match(/\(([^()]+)\)\s*$/);
  return match ? match[1].trim() : '';
}

function parseListingCount(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '-') return 0;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function isJapaneseProduct(item) {
  const name = String(item?.name || '');
  return !/\[(EN|FR|CN|KR|TW|TH|ID|ES|DE|IT|PT)\]/i.test(name);
}

function toMarketCard(item) {
  const apparelId = Number(item.id);
  return {
    code: normalizeText(item.productNumber),
    locale: 'JP',
    apparelId,
    name: normalizeText(item.name),
    setName: parseSetName(item.name),
    minPrice: Number(item.minPrice || 0),
    minPriceFormat: item.minPriceFormat || 'US $ -',
    listingCount: parseListingCount(item.listingCount),
    sourceUrl: `https://snkrdunk.com/en/trading-cards/${apparelId}?slide=right`,
    previewImageUrl: item.thumbnailUrl || ''
  };
}

async function fetchPage(page) {
  const url = new URL('https://snkrdunk.com/en/v1/trading-cards');
  url.searchParams.set('brandId', 'onepiece');
  url.searchParams.set('categoryId', '25');
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', String(perPage));
  url.searchParams.set('order', 'release');

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 OPTCGKorea/1.0'
    }
  });
  const text = (await response.text()).replace(/^\uFEFF/, '');
  if (!response.ok) {
    throw new Error(`SNKRDUNK page ${page} failed: ${response.status} ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  return Array.isArray(data.tradingCards) ? data.tradingCards : [];
}

function serializeCompactMarketCards(value) {
  const json = JSON.stringify(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `const e=JSON.parse(\`${json}\`);export{e as default};\n`;
}

async function main() {
  const fetched = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const items = await fetchPage(page);
    fetched.push(...items);
    console.log(`page ${page}: ${items.length}`);
    if (items.length < perPage) break;
    await wait(delayMs);
  }

  const fetchedMarketCards = fetched
    .filter((item) => Number.isFinite(Number(item.id)))
    .filter((item) => normalizeText(item.productNumber))
    .filter(isJapaneseProduct)
    .map(toMarketCard);

  const byId = new Map(marketCards.map((item) => [Number(item.apparelId), item]));
  const beforeCount = byId.size;
  let inserted = 0;
  let updated = 0;
  let skippedExisting = 0;

  for (const item of fetchedMarketCards) {
    const previous = byId.get(item.apparelId);
    if (!previous) {
      inserted += 1;
      byId.set(item.apparelId, item);
      continue;
    }
    if (!shouldUpdateExisting) {
      skippedExisting += 1;
      continue;
    }
    updated += 1;
    byId.set(item.apparelId, { ...previous, ...item });
  }

  const nextMarketCards = [...byId.values()].sort((a, b) => {
    const codeCompare = String(a.code || '').localeCompare(String(b.code || ''), 'en');
    if (codeCompare) return codeCompare;
    const localeCompare = String(a.locale || '').localeCompare(String(b.locale || ''), 'en');
    if (localeCompare) return localeCompare;
    return Number(a.apparelId || 0) - Number(b.apparelId || 0);
  });

  if (shouldWrite) {
    fs.writeFileSync(MARKET_PATH, serializeCompactMarketCards(nextMarketCards));
  }

  const report = {
    write: shouldWrite,
    existingRows: marketCards.length,
    existingUniqueApparelIds: beforeCount,
    fetchedRows: fetched.length,
    fetchedJapaneseRows: fetchedMarketCards.length,
    inserted,
    updated,
    skippedExisting,
    finalRows: nextMarketCards.length,
    examplesInserted: fetchedMarketCards.filter((item) => !marketCards.some((old) => Number(old.apparelId) === item.apparelId)).slice(0, 10)
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
