import fs from 'node:fs';
import path from 'node:path';
import marketCards from '../src/data/market-cards.js';

const MARKET_PATH = path.resolve('src/data/market-cards.js');
const ids = [...new Set(process.argv.slice(2)
  .filter((arg) => /^\d+$/.test(arg))
  .map(Number)
  .filter((id) => id > 0))];
const shouldWrite = process.argv.includes('--write');

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function parseSetName(name = '') {
  const match = String(name).match(/\(([^()]*)\)\s*$/);
  return match?.[1]?.trim() || '';
}

function parseListingCount(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function serializeCompactMarketCards(value) {
  const json = JSON.stringify(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `const e=JSON.parse(\`${json}\`);export{e as default};\n`;
}

async function fetchMarketProduct(apparelId) {
  const sourceUrl = `https://snkrdunk.com/en/trading-cards/${apparelId}?slide=right`;
  const response = await fetch(sourceUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 CardPoneBot/1.0'
    }
  });
  if (!response.ok) throw new Error(`SNKRDUNK ${apparelId} failed: ${response.status}`);
  const html = await response.text();
  const match = html.match(/:trading-card="([\s\S]*?)"\s*(?:\r?\n)\s*:product-id=/);
  if (!match) throw new Error(`SNKRDUNK ${apparelId} product data not found`);
  const product = JSON.parse(decodeHtml(match[1]));
  const localeMatch = String(product.name || '').match(/\[(EN|JP)\]/i);
  const previewImageUrl = String(product.thumbnailUrl || '').replace(/\?size=[^&]+/, '?size=m');
  return {
    code: String(product.productNumber || '').trim(),
    locale: localeMatch?.[1]?.toUpperCase() || 'JP',
    apparelId: Number(product.id || apparelId),
    name: String(product.name || '').trim(),
    setName: parseSetName(product.name),
    minPrice: 0,
    minPriceFormat: 'US $ -',
    listingCount: parseListingCount(product.listingCount),
    sourceUrl,
    previewImageUrl
  };
}

async function main() {
  if (!ids.length) throw new Error('Provide one or more numeric SNKRDUNK apparel IDs');
  const fetched = [];
  for (const id of ids) fetched.push(await fetchMarketProduct(id));

  const byId = new Map(marketCards.map((item) => [Number(item.apparelId), item]));
  const inserted = [];
  const updated = [];
  for (const item of fetched) {
    const previous = byId.get(item.apparelId);
    byId.set(item.apparelId, previous ? { ...previous, ...item } : item);
    (previous ? updated : inserted).push(item.apparelId);
  }

  const nextMarketCards = [...byId.values()].sort((a, b) => {
    const codeCompare = String(a.code || '').localeCompare(String(b.code || ''), 'en');
    if (codeCompare) return codeCompare;
    const localeCompare = String(a.locale || '').localeCompare(String(b.locale || ''), 'en');
    if (localeCompare) return localeCompare;
    return Number(a.apparelId || 0) - Number(b.apparelId || 0);
  });

  if (shouldWrite) fs.writeFileSync(MARKET_PATH, serializeCompactMarketCards(nextMarketCards));
  console.log(JSON.stringify({ write: shouldWrite, inserted, updated, items: fetched, total: nextMarketCards.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
