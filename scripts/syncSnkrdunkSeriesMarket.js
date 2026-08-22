import fs from 'node:fs';
import path from 'node:path';
import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';

const CARDS_PATH = path.resolve('src/data/cards.json');
const MARKET_PATH = path.resolve('src/data/market-cards.js');
const LINKS_PATH = path.resolve('src/data/card-market-links.js');
const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const seriesPattern = new RegExp(args.find((arg) => arg.startsWith('--series-pattern='))?.slice(17) || 'WORLD.?S STRONGEST WARRIORS|世界最強の戦士', 'i');
const officialSeriesPattern = new RegExp(args.find((arg) => arg.startsWith('--official-series-pattern='))?.slice(26) || '世界最強の戦士', 'i');
const maxPages = Number(args.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1] || 8);

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseSetName(name) {
  return normalize(String(name || '').match(/\(([^()]+)\)\s*$/)?.[1]);
}

function parseCount(value) {
  return Number(String(value ?? '').match(/\d+/)?.[0] || 0);
}

function toMarketCard(item) {
  const apparelId = Number(item.id);
  return {
    code: normalize(item.productNumber),
    locale: 'JP',
    apparelId,
    name: normalize(item.name),
    setName: parseSetName(item.name),
    minPrice: Number(item.minPrice || 0),
    minPriceFormat: item.minPriceFormat || 'US $ -',
    listingCount: parseCount(item.listingCount),
    sourceUrl: `https://snkrdunk.com/en/trading-cards/${apparelId}?slide=right`,
    previewImageUrl: item.thumbnailUrl || ''
  };
}

async function fetchPage(page) {
  const url = new URL('https://snkrdunk.com/en/v1/trading-cards');
  url.searchParams.set('brandId', 'onepiece');
  url.searchParams.set('categoryId', '25');
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', '100');
  url.searchParams.set('order', 'release');
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 OPTCGKorea/1.0' }
  });
  if (!response.ok) throw new Error(`SNKRDUNK catalog page ${page}: ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.tradingCards) ? payload.tradingCards : [];
}

function suffix(cardId) {
  return String(cardId || '').match(/(_p\d+)$/)?.[1] || '';
}

function rarityPattern(rarity, parallel) {
  const token = normalize(rarity).toUpperCase();
  if (!token || /SPカード/.test(token)) return null;
  return new RegExp(`\\b${token}${parallel ? '-P' : ''}\\b`, 'i');
}

function isSpecialMarketName(name) {
  return /-P\b|-SP\b|-SPC\b|-KSP\b|Manga|Comic|Parallel|Treasure/i.test(name);
}

function assignCandidates(cards, candidates) {
  const assigned = new Map();
  const used = new Set();
  for (const card of cards) {
    const cardSuffix = suffix(card.id);
    if (cardSuffix && cardSuffix !== '_p1') continue;
    const pattern = rarityPattern(card.rarity, cardSuffix === '_p1');
    if (!pattern) continue;
    const matches = candidates.filter((item) => {
      if (used.has(item.apparelId) || !pattern.test(item.name)) return false;
      return cardSuffix === '_p1' ? /-P\b/i.test(item.name) : !isSpecialMarketName(item.name);
    });
    if (matches.length === 1) {
      assigned.set(card.id, matches[0]);
      used.add(matches[0].apparelId);
    }
  }
  const remainingCards = cards.filter((card) => !assigned.has(card.id));
  const remainingCandidates = candidates.filter((item) => !used.has(item.apparelId));
  if (remainingCards.length === 1 && remainingCandidates.length === 1) {
    assigned.set(remainingCards[0].id, remainingCandidates[0]);
  }
  return assigned;
}

function serializeCompact(value) {
  const json = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `const e=JSON.parse(\`${json}\`);export{e as default};\n`;
}

function serializeLinks(value) {
  return `const cardMarketLinks = ${JSON.stringify(value, null, 2)};\n\nexport default cardMarketLinks;\n`;
}

async function main() {
  const fetched = [];
  for (let page = 1; page <= maxPages; page += 1) fetched.push(...await fetchPage(page));
  const seriesItems = fetched
    .filter((item) => seriesPattern.test(normalize(item.name)))
    .filter((item) => !/\[(EN|FR|CN|KR|TW|TH|ID|ES|DE|IT|PT)\]/i.test(normalize(item.name)))
    .filter((item) => Number(item.id) > 0 && normalize(item.productNumber))
    .map(toMarketCard);

  const byId = new Map(marketCards.map((item) => [Number(item.apparelId), item]));
  for (const item of seriesItems) byId.set(item.apparelId, { ...(byId.get(item.apparelId) || {}), ...item });
  const nextMarketCards = [...byId.values()].sort((a, b) => normalize(a.code).localeCompare(normalize(b.code), 'en') || Number(a.apparelId) - Number(b.apparelId));

  const officialCards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'))
    .filter((card) => officialSeriesPattern.test(normalize(card.seriesName)));
  const candidatesByCode = new Map();
  for (const item of seriesItems) {
    const list = candidatesByCode.get(item.code) || [];
    list.push(item);
    candidatesByCode.set(item.code, list);
  }
  const cardsByCode = new Map();
  for (const card of officialCards) {
    const list = cardsByCode.get(card.cardNo) || [];
    list.push(card);
    cardsByCode.set(card.cardNo, list);
  }
  const generated = [];
  for (const [code, cards] of cardsByCode) {
    const candidates = candidatesByCode.get(code) || [];
    const assigned = assignCandidates(cards, candidates);
    for (const card of cards) {
      const match = assigned.get(card.id);
      generated.push({
        cardId: card.id,
        cardNo: card.cardNo,
        locale: 'JP',
        variantKey: '',
        apparelId: match?.apparelId || null,
        status: match ? 'approved' : 'pending',
        note: match ? `OP17 auto approved: ${match.name}` : `OP17 pending: ${candidates.length} candidate(s)`
      });
    }
  }
  const officialIds = new Set(officialCards.map((card) => card.id));
  const nextLinks = [...cardMarketLinks.filter((link) => !officialIds.has(link.cardId)), ...generated];

  if (shouldWrite) {
    fs.writeFileSync(MARKET_PATH, serializeCompact(nextMarketCards));
    fs.writeFileSync(LINKS_PATH, serializeLinks(nextLinks));
  }
  console.log(JSON.stringify({
    write: shouldWrite,
    fetched: fetched.length,
    seriesMarketItems: seriesItems.length,
    seriesMarketCodes: new Set(seriesItems.map((item) => item.code)).size,
    officialCards: officialCards.length,
    approved: generated.filter((link) => link.status === 'approved').length,
    pending: generated.filter((link) => link.status === 'pending').length,
    finalMarketCards: nextMarketCards.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
