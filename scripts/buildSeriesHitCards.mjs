// Builds src/data/series-hit-cards.json: per random-pack booster (OP / EB / PRB), the top 10 cards by
// SNKRDUNK Single (A grade) latest-trade price, manga/SP/parallel counts and the sealed box price
// (box trade when collected, otherwise the SNKRDUNK box listing minimum from box-market-prices.json).
// Source: Card Pone's latest-trade summary (Japanese SNKRDUNK products, JPY) + local market/link/catalog data.
// Usage: node scripts/buildSeriesHitCards.mjs [--input trade-latest.json] [--date YYYY-MM-DD]
// If the summary cannot be fetched or looks wrong, the committed file is left as is (exit 0) so the
// daily catalog sync keeps working.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  TRADE_LATEST_API,
  TRADE_LATEST_BASIS,
  buildKoreanNameResolver,
  buildSetProductMap,
  classifyScope,
  classifyVersion,
  formatVersionLabel,
  getCardImageUrl,
  getVersionGroup,
  isJapaneseMarketItem,
  positivePrice
} from '../lib/snkrdunk-trade-cards.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(rootDir, 'src', 'data', 'series-hit-cards.json');
const HIT_CARD_LIMIT = 10;
const MIN_API_ITEMS = 500;
export const HIT_CARD_SET_PATTERN = /^(OP|EB|PRB)\d{2}$/;

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : '';
};

async function loadModule(relativePath) {
  return import(pathToFileURL(path.join(rootDir, relativePath)).href);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`trade-latest API ${response.status}`);
  return response.json();
}

// The bulk summary covers card products only; sealed boxes are asked for by id (the API takes up to 250).
async function loadPayload(boxApparelIds) {
  const input = argValue('--input');
  if (input) return JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const payload = await fetchJson(TRADE_LATEST_API);
  const ids = [...new Set(boxApparelIds)].slice(0, 250);
  if (ids.length) {
    try {
      const boxes = await fetchJson(`${TRADE_LATEST_API}&apparelIds=${ids.join(',')}`);
      const known = new Set(payload.items.map((item) => Number(item.apparelId)));
      payload.items.push(...(boxes.items || []).filter((item) => !known.has(Number(item.apparelId))));
    } catch (error) {
      console.warn(`[series-hit-cards] box trades unavailable: ${error.message}`);
    }
  }
  return payload;
}

// SNKRDUNK name without the rarity token and product, e.g. "Monkey.D.Luffy SEC-RSP [OP13-118](...)" -> "Monkey.D.Luffy".
const englishName = (name) => String(name || '').replace(/\s(L|SEC|SR|R|UC|C|P|TR)(-[A-Z]+)?(?=[\s:[(]|$).*$/, '').replace(/\s*[[(].*$/, '').trim();

// Sealed booster box per set: OP-13 / OPC-TCG-OP-17 / OPC-TCG-EB-05 Box (not DON!!, special sets or precious boxes).
export function getBoxApparelIds(boxItems) {
  const map = new Map();
  for (const item of boxItems) {
    const code = String(item.code || '').replace(/^OPC-TCG-/, '').replace(/-/g, '');
    if (!HIT_CARD_SET_PATTERN.test(code) || !/\bBox\s*$/i.test(String(item.name || ''))) continue;
    if (!map.has(code)) map.set(code, Number(item.apparelId));
  }
  return map;
}

// Manga images missing an approved market link come from the curated manga list of the same product.
function buildMangaImageLookup(mangaGroups) {
  const map = new Map();
  for (const group of mangaGroups) {
    const setId = String(group.set || '').replace(/-/g, '').toUpperCase();
    for (const card of group.cards) {
      const code = String(card.cardId || '').replace(/^JP::/, '').replace(/_p\d+$/, '');
      const variant = /레드/.test(card.variant || '') ? '레드' : /골드/.test(card.variant || '') ? '골드' : '';
      map.set(`${setId}|${code}|${variant}`, card.cardId);
    }
  }
  return (setId, code, version) => map.get(`${setId}|${code}|${version === '망가 레드' ? '레드' : version === '망가 골드' ? '골드' : ''}`) || null;
}

// Unlinked SP / parallel products: the JP catalog version of the same number inside this product's series,
// used only when exactly one catalog version fits (gold/silver pairs and similar stay without an image).
function buildCatalogImageLookup(catalog) {
  const map = new Map();
  for (const card of catalog) {
    if (card.locale !== 'JP' || !/_p\d+$/.test(card.id || '')) continue;
    const key = `${String(card.series || '').replace(/^JP-/, '')}|${String(card.cardNo || '').replace(/_p\d+$/, '')}|${/^SP/i.test(String(card.rarity || '')) ? 'SP' : '패러렐'}`;
    map.set(key, [...(map.get(key) || []), card.id]);
  }
  return (setId, code, group) => {
    const ids = map.get(`${setId}|${code}|${group}`) || [];
    return ids.length === 1 ? ids[0] : null;
  };
}

// Box price: the sealed box's latest Single trade when collected, otherwise the SNKRDUNK listing minimum.
function getBoxPrice(apparelId, trades, boxPrices) {
  const trade = trades.get(apparelId);
  const tradePrice = positivePrice(trade?.aPriceJpy);
  if (tradePrice) return { basis: 'trade', priceJpy: Math.round(tradePrice), date: trade.aTradeDate || null };
  const listing = boxPrices?.items?.[String(apparelId)];
  const listingPrice = positivePrice(listing?.minPrice);
  if (listingPrice && listing.priceCurrency === 'USD') {
    return { basis: 'listing', priceUsd: listingPrice, date: String(boxPrices.updatedAt || '').slice(0, 10) || null };
  }
  return null;
}

export function buildSeriesHitCards({ payload, marketCards, cardMarketLinks, catalog, seriesList, boxItems, boxPrices, mangaGroups, updatedAt, minItems = MIN_API_ITEMS }) {
  if (payload?.basis !== TRADE_LATEST_BASIS) throw new Error(`unexpected basis ${payload?.basis}`);
  if (!Array.isArray(payload.items) || payload.items.length < minItems) throw new Error(`too few trade items (${payload?.items?.length})`);
  const trades = new Map(payload.items.map((item) => [Number(item.apparelId), item]));
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const linkByApparel = new Map(cardMarketLinks.filter((link) => link.status === 'approved').map((link) => [Number(link.apparelId), link.cardId]));
  const mangaIds = new Set(mangaGroups.flatMap((group) => group.cards.map((card) => card.cardId)));
  const setToProduct = buildSetProductMap(marketCards, linkByApparel, catalogById);
  const names = buildKoreanNameResolver(catalog);
  const mangaImage = buildMangaImageLookup(mangaGroups);
  const catalogImage = buildCatalogImageLookup(catalog);
  const setIds = [...new Set(seriesList.map((series) => String(series.baseSeriesId || '').toUpperCase()).filter((id) => HIT_CARD_SET_PATTERN.test(id)))]
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
  const boxIds = getBoxApparelIds(boxItems);

  const rowsBySet = new Map(setIds.map((id) => [id, []]));
  for (const item of marketCards) {
    const product = setToProduct.get(item.setName);
    if (!rowsBySet.has(product) || !isJapaneseMarketItem(item) || classifyScope(item) !== 'card') continue;
    const trade = trades.get(Number(item.apparelId));
    const single = positivePrice(trade?.aPriceJpy);
    if (!single) continue;
    const code = String(item.code || '').trim();
    const cardId = linkByApparel.get(Number(item.apparelId)) || null;
    const { rarity, version } = classifyVersion(item, cardId, mangaIds);
    const name = names(code);
    const group = getVersionGroup(version, rarity);
    const imageId = cardId
      || (group === '망가' ? mangaImage(product, code, version) : null)
      || (group === 'SP' || group === '패러렐' ? catalogImage(product, code, group) : null);
    rowsBySet.get(product).push({
      apparelId: Number(item.apparelId),
      code,
      name: name.kr || name.jp || englishName(item.name),
      nameJp: name.jp || englishName(item.name),
      version: formatVersionLabel(rarity, version, item, { withProduct: false }),
      group,
      image: getCardImageUrl(imageId),
      singleJpy: Math.round(single),
      singleDate: trade.aTradeDate || null,
      psa10Jpy: positivePrice(trade.psa10PriceJpy) ? Math.round(trade.psa10PriceJpy) : null
    });
  }

  const sets = {};
  for (const id of setIds) {
    const rows = rowsBySet.get(id).sort((left, right) => right.singleJpy - left.singleJpy || left.apparelId - right.apparelId);
    const box = boxIds.has(id) ? getBoxPrice(boxIds.get(id), trades, boxPrices) : null;
    if (!rows.length && !box) continue;
    sets[id] = {
      hitCards: rows.slice(0, HIT_CARD_LIMIT).map(({ apparelId, group, ...card }) => card),
      counts: {
        manga: rows.filter((row) => row.group === '망가').length,
        sp: rows.filter((row) => row.group === 'SP').length,
        parallel: rows.filter((row) => row.group === '패러렐' || row.group === '슈퍼 패러렐').length
      },
      box
    };
  }
  return { updatedAt, basis: TRADE_LATEST_BASIS, source: TRADE_LATEST_API, sets };
}

// One set per block and one card per line keeps the file small and its daily diffs readable.
export function serializeSeriesHitCards(data) {
  const setBlocks = Object.entries(data.sets).map(([id, set]) => [
    `    ${JSON.stringify(id)}: {`,
    `      "hitCards": [${set.hitCards.length ? `\n${set.hitCards.map((card) => `        ${JSON.stringify(card)}`).join(',\n')}\n      ` : ''}],`,
    `      "counts": ${JSON.stringify(set.counts)},`,
    `      "box": ${JSON.stringify(set.box)}`,
    '    }'
  ].join('\n'));
  return `{\n  "updatedAt": ${JSON.stringify(data.updatedAt)},\n  "basis": ${JSON.stringify(data.basis)},\n  "source": ${JSON.stringify(data.source)},\n  "sets": {\n${setBlocks.join(',\n')}\n  }\n}\n`;
}

async function main() {
  const [{ default: marketCards }, { default: cardMarketLinks }, { default: boxItems }, { MANGA_COLLECTION_GROUPS }] = await Promise.all([
    loadModule('src/data/market-cards.js'),
    loadModule('src/data/card-market-links.js'),
    loadModule('src/data/box-market-items.js'),
    loadModule('src/data/collection-guide.js')
  ]);
  let payload;
  try {
    payload = await loadPayload(getBoxApparelIds(boxItems).values());
  } catch (error) {
    console.warn(`[series-hit-cards] skipped: ${error.message}`);
    return;
  }
  const boxPrices = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'box-market-prices.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'cards.json'), 'utf8'));
  const seriesList = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'series.json'), 'utf8'));
  // KST date of this run; the guide pages print it as the price reference date.
  const updatedAt = argValue('--date') || new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  let data;
  try {
    data = buildSeriesHitCards({ payload, marketCards, cardMarketLinks, catalog, seriesList, boxItems, boxPrices, mangaGroups: MANGA_COLLECTION_GROUPS, updatedAt });
  } catch (error) {
    console.warn(`[series-hit-cards] skipped: ${error.message}`);
    return;
  }
  const text = serializeSeriesHitCards(data);
  fs.writeFileSync(outputPath, text, 'utf8');
  const missing = Object.entries(data.sets).filter(([, set]) => !set.hitCards.length || !set.box).map(([id, set]) => `${id}${set.hitCards.length ? '' : ' (no cards)'}${set.box ? '' : ' (no box)'}`);
  console.log(`[series-hit-cards] ${Object.keys(data.sets).length} sets, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB${missing.length ? `; gaps: ${missing.join(', ')}` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
