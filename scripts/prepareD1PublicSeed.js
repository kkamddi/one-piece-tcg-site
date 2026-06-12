import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'src/data');
const outDir = path.join(rootDir, 'data/d1-public-seed');

const nowIso = new Date().toISOString();

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function baseCardNo(cardNo = '') {
  return String(cardNo)
    .trim()
    .replace(/_[pr]\d+$/i, '')
    .replace(/_P\d+$/i, '');
}

function variantKey(cardNo = '', id = '') {
  const cleanId = String(id).split('::')[1] || '';
  const cleanCardNo = String(cardNo).trim();
  if (cleanId && cleanId !== cleanCardNo) {
    const suffix = cleanId.replace(cleanCardNo, '').replace(/^[_-]/, '');
    return suffix || 'base';
  }
  const match = cleanCardNo.match(/_([A-Za-z]+\d+)$/);
  return match ? match[1].toLowerCase() : 'base';
}

function seriesName(series = {}) {
  return series.koName || series.name || series.seriesName || series.id;
}

function seriesNameEn(series = {}) {
  return series.enName || series.nameEn || seriesName(series);
}

function boolInt(value) {
  return value ? 1 : 0;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertSql(table, columns, rows, batchSize = 25) {
  const statements = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch
      .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
      .join(',\n');
    statements.push(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES\n${values};`);
  }
  return `${statements.join('\n\n')}\n`;
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(dataDir, name), 'utf8'));
}

function toSeriesRow(series) {
  return {
    id: series.id,
    locale: series.locale || (String(series.id).startsWith('JP-') ? 'JP' : 'KR'),
    base_series_id: series.baseSeriesId || String(series.id).replace(/^(KR|JP)-/, ''),
    name: seriesName(series),
    name_en: seriesNameEn(series),
    kind_ko: series.kindKo || series.categoryKo || null,
    kind_en: series.kindEn || series.category || null,
    official_series_keyword: series.officialSeriesKeyword || series.queryLabel || null,
    official_url: series.officialUrl || null,
    description: series.description || null,
    release_order: Number(series.releaseOrder || series.release_order || 0),
    card_count: 0,
    is_active: 1,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function toCardRow(card) {
  const cardNo = String(card.cardNo || '').trim();
  const cardNoBase = card.baseCardNo || baseCardNo(cardNo);
  const locale = card.locale || (String(card.id).startsWith('JP::') ? 'JP' : 'KR');
  const searchText = [cardNo, card.name, card.nameEn, card.type, card.effect]
    .map((value) => normalizeSearch(value || ''))
    .filter(Boolean)
    .join(' ');
  return {
    id: card.id,
    locale,
    card_no: cardNo,
    card_no_base: cardNoBase,
    variant_key: variantKey(cardNo, card.id),
    series_id: card.series,
    base_series_id: card.baseSeriesId || String(card.series || '').replace(/^(KR|JP)-/, ''),
    origin_series_id: card.originSeries || card.series,
    origin_base_series_id: card.originBaseSeriesId || String(card.originSeries || card.series || '').replace(/^(KR|JP)-/, ''),
    name: card.name || cardNo,
    name_en: card.nameEn || null,
    name_normalized: normalizeSearch(card.name || cardNo),
    search_text_normalized: searchText,
    rarity: card.rarity || null,
    category: card.category || null,
    category_ko: card.categoryKo || null,
    color: card.color || null,
    color_ko: card.colorKo || null,
    cost: card.cost || null,
    power: card.power || null,
    counter: card.counter || null,
    attribute: card.attribute || null,
    attribute_ko: card.attributeKo || null,
    type: card.type || null,
    effect: card.effect || null,
    image_url: card.imageUrl || null,
    official_url: card.officialUrl || null,
    image_status: card.imageUrl ? 'unknown' : 'missing',
    image_checked_at: null,
    market_code: cardNoBase,
    is_reprint: boolInt(card.isReprint || card.is_reprint || (card.originSeries && card.originSeries !== card.series)),
    sort_order: Number(card.sortOrder || card.sort_order || 0),
    source_updated_at: null,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function toMarketProductRow(item) {
  return {
    source: 'snkrdunk',
    apparel_id: Number(item.apparelId),
    locale: item.locale || 'JP',
    code: item.code || '',
    name: item.name || item.code || String(item.apparelId),
    set_name: item.setName || null,
    source_url: item.sourceUrl || `https://snkrdunk.com/en/trading-cards/${item.apparelId}?slide=right`,
    preview_image_url: item.previewImageUrl || null,
    latest_a_price_jpy: null,
    latest_psa10_price_jpy: null,
    latest_min_price_amount: typeof item.minPrice === 'number' ? item.minPrice : null,
    latest_min_price_currency: 'USD',
    latest_listing_count: typeof item.listingCount === 'number' ? item.listingCount : null,
    latest_captured_at: null,
    is_active: 1,
    raw_market_card_json: JSON.stringify(item),
    created_at: nowIso,
    updated_at: nowIso
  };
}

function toCardMarketLinkRow(link) {
  return {
    card_id: link.cardId,
    source: 'snkrdunk',
    card_no: link.cardNo || '',
    locale: link.locale || 'JP',
    variant_key: link.variantKey || '',
    apparel_id: Number(link.apparelId),
    status: link.status || 'pending',
    note: link.note || null,
    updated_at: nowIso
  };
}

function toShopRow(shop, index) {
  const id = shop.id || `${shop.source || shop.sourceType || 'shop'}-${index}`;
  return {
    id,
    name: shop.name || shop.shopName || id,
    source_type: shop.sourceType || shop.source || null,
    source_label: shop.sourceLabel || shop.typeLabel || null,
    sido: shop.sido || shop.region || null,
    gungu: shop.gungu || shop.district || null,
    address: shop.address || null,
    phone: shop.phone || null,
    official_url: shop.officialUrl || shop.url || null,
    lat: typeof shop.lat === 'number' ? shop.lat : null,
    lng: typeof shop.lng === 'number' ? shop.lng : null,
    is_active: 1,
    updated_at: nowIso
  };
}

function toNewsRow(topic, index) {
  return {
    id: topic.id || `${topic.date || 'notice'}-${index}`,
    locale: topic.locale || 'KR',
    title: topic.title || topic.id || `Notice ${index + 1}`,
    summary: topic.category || null,
    body: null,
    source: topic.category || 'official',
    source_url: topic.url || null,
    published_at: topic.date || null,
    display_order: index,
    is_active: 1,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function applySeriesCounts(seriesRows, cardRows) {
  const counts = new Map();
  for (const card of cardRows) counts.set(card.series_id, (counts.get(card.series_id) || 0) + 1);
  return seriesRows.map((series) => ({ ...series, card_count: counts.get(series.id) || 0 }));
}

function validateRows({ seriesRows, cardRows, marketProductRows, cardMarketLinkRows, shopRows, newsRows }) {
  const seriesIds = new Set(seriesRows.map((row) => row.id));
  const cardIds = new Set(cardRows.map((row) => row.id));
  const marketProductKeys = new Set(marketProductRows.map((row) => `snkrdunk:${row.apparel_id}`));
  const errors = [];

  for (const card of cardRows) {
    if (!seriesIds.has(card.series_id)) errors.push(`missing series for card ${card.id}: ${card.series_id}`);
  }
  for (const link of cardMarketLinkRows) {
    if (!cardIds.has(link.card_id)) errors.push(`missing card for market link ${link.card_id}`);
    if (!marketProductKeys.has(`snkrdunk:${link.apparel_id}`)) {
      errors.push(`missing market product for link ${link.card_id}: ${link.apparel_id}`);
    }
  }

  return {
    ok: errors.length === 0,
    counts: {
      card_series: seriesRows.length,
      cards: cardRows.length,
      market_products: marketProductRows.length,
      card_market_links: cardMarketLinkRows.length,
      shops: shopRows.length,
      news: newsRows.length
    },
    errors: errors.slice(0, 200),
    errorCount: errors.length
  };
}

async function main() {
  const [series, cards, shops, topics] = await Promise.all([
    readJson('series.json'),
    readJson('cards.json'),
    readJson('shops.json'),
    readJson('topics.json').catch(() => []),
  ]);

  let seriesRows = series.map(toSeriesRow).filter((row) => row.locale === 'KR' || row.locale === 'JP');
  const allowedSeriesIds = new Set(seriesRows.map((row) => row.id));
  const cardRows = cards
    .map(toCardRow)
    .filter((row) => (row.locale === 'KR' || row.locale === 'JP') && allowedSeriesIds.has(row.series_id));
  seriesRows = applySeriesCounts(seriesRows, cardRows);

  const marketProductRows = marketCards
    .filter((item) => item && item.apparelId && item.code)
    .map(toMarketProductRow);
  const cardMarketLinkRows = cardMarketLinks
    .filter((link) => link && link.cardId && link.apparelId)
    .map(toCardMarketLinkRow);
  const shopRows = shops.map(toShopRow);
  const newsRows = topics.map(toNewsRow);

  const report = validateRows({
    seriesRows,
    cardRows,
    marketProductRows,
    cardMarketLinkRows,
    shopRows,
    newsRows
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  await writeFile(path.join(outDir, '001_card_series.sql'), insertSql('card_series', [
    'id', 'locale', 'base_series_id', 'name', 'name_en', 'kind_ko', 'kind_en',
    'official_series_keyword', 'official_url', 'description', 'release_order',
    'card_count', 'is_active', 'created_at', 'updated_at'
  ], seriesRows), 'utf8');

  await writeFile(path.join(outDir, '002_cards.sql'), insertSql('cards', [
    'id', 'locale', 'card_no', 'card_no_base', 'variant_key', 'series_id',
    'base_series_id', 'origin_series_id', 'origin_base_series_id', 'name',
    'name_en', 'name_normalized', 'search_text_normalized', 'rarity', 'category',
    'category_ko', 'color', 'color_ko', 'cost', 'power', 'counter', 'attribute',
    'attribute_ko', 'type', 'effect', 'image_url', 'official_url', 'image_status',
    'image_checked_at', 'market_code', 'is_reprint', 'sort_order', 'source_updated_at',
    'created_at', 'updated_at'
  ], cardRows), 'utf8');

  await writeFile(path.join(outDir, '003_market_products.sql'), insertSql('market_products', [
    'source', 'apparel_id', 'locale', 'code', 'name', 'set_name', 'source_url',
    'preview_image_url', 'latest_a_price_jpy', 'latest_psa10_price_jpy',
    'latest_min_price_amount', 'latest_min_price_currency', 'latest_listing_count',
    'latest_captured_at', 'is_active', 'raw_market_card_json', 'created_at', 'updated_at'
  ], marketProductRows), 'utf8');

  await writeFile(path.join(outDir, '004_card_market_links.sql'), insertSql('card_market_links', [
    'card_id', 'source', 'card_no', 'locale', 'variant_key', 'apparel_id',
    'status', 'note', 'updated_at'
  ], cardMarketLinkRows), 'utf8');

  await writeFile(path.join(outDir, '005_shops.sql'), insertSql('shops', [
    'id', 'name', 'source_type', 'source_label', 'sido', 'gungu', 'address',
    'phone', 'official_url', 'lat', 'lng', 'is_active', 'updated_at'
  ], shopRows), 'utf8');

  await writeFile(path.join(outDir, '006_news.sql'), insertSql('news', [
    'id', 'locale', 'title', 'summary', 'body', 'source', 'source_url',
    'published_at', 'display_order', 'is_active', 'created_at', 'updated_at'
  ], newsRows), 'utf8');

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
