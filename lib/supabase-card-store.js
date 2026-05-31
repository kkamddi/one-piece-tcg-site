import { hasSupabaseAdmin, supabaseAdmin } from './supabase-admin.js';

const STATIC_CARD_CACHE_TTL_MS = 5 * 60 * 1000;
const cardQueryCache = new Map();
let seriesRowsCache = null;
let seriesMapCache = null;

function readCache(entry) {
  if (!entry || Date.now() - entry.createdAt > STATIC_CARD_CACHE_TTL_MS) return null;
  return entry.value;
}

function writeCache(map, key, value) {
  map.set(key, { value, createdAt: Date.now() });
  if (map.size > 80) {
    const [oldestKey] = map.keys();
    map.delete(oldestKey);
  }
}

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function toLegacySeries(row = {}) {
  return {
    id: row.id,
    locale: row.locale,
    baseSeriesId: row.base_series_id,
    koName: row.name,
    enName: row.name_en || row.name,
    kindKo: row.kind_ko || '',
    kindEn: row.kind_en || '',
    queryLabel: row.official_series_keyword || row.name,
    officialUrl: row.official_url || '',
    description: row.description || '',
    releaseOrder: row.release_order || 0
  };
}

function toLegacyCard(row = {}, seriesMap = new Map()) {
  const series = seriesMap.get(row.series_id);
  return {
    id: row.id,
    locale: row.locale,
    cardNo: row.card_no,
    baseCardNo: row.card_no_base,
    variantKey: row.variant_key || '',
    series: row.series_id,
    baseSeriesId: row.base_series_id,
    originSeries: row.origin_series_id || row.series_id,
    originBaseSeriesId: row.origin_base_series_id || row.base_series_id,
    name: row.name,
    nameEn: row.name_en || '',
    rarity: row.rarity || '',
    category: row.category || '',
    categoryKo: row.category_ko || '',
    color: row.color || '',
    colorKo: row.color_ko || '',
    cost: row.cost || '',
    power: row.power || '',
    counter: row.counter || '',
    attribute: row.attribute || '',
    attributeKo: row.attribute_ko || '',
    type: row.type || '',
    effect: row.effect || '',
    imageUrl: row.image_url || '',
    officialUrl: row.official_url || '',
    marketCode: row.market_code || row.card_no,
    seriesName: series?.koName || row.series_id,
    seriesNameEn: series?.enName || row.series_id,
    isReprint: Boolean(row.is_reprint)
  };
}

async function fetchSeriesRows() {
  if (!hasSupabaseAdmin) return null;
  const cached = readCache(seriesRowsCache);
  if (cached) return cached;
  const { data, error } = await supabaseAdmin
    .from('card_series')
    .select('*')
    .order('locale', { ascending: true })
    .order('release_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  const rows = data || [];
  seriesRowsCache = { value: rows, createdAt: Date.now() };
  return rows;
}

async function fetchSeriesMap() {
  const cached = readCache(seriesMapCache);
  if (cached) return cached;
  const rows = await fetchSeriesRows();
  if (!rows) return null;
  const seriesMap = new Map(rows.map((row) => [row.id, toLegacySeries(row)]));
  seriesMapCache = { value: seriesMap, createdAt: Date.now() };
  return seriesMap;
}

export async function readSupabaseSeries() {
  const rows = await fetchSeriesRows();
  return rows ? rows.map(toLegacySeries) : null;
}

export async function readSupabaseCards(filters = {}) {
  if (!hasSupabaseAdmin) return null;
  const requestedLimit = Number(filters.limit);
  const requestedPage = Number(filters.page);
  const requestedOffset = Number(filters.offset);
  const hasLimit = Number.isFinite(requestedLimit) && requestedLimit > 0;
  const safeLimit = hasLimit ? Math.min(Math.floor(requestedLimit), 500) : 0;
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const safeOffset = Number.isFinite(requestedOffset) && requestedOffset >= 0
    ? Math.floor(requestedOffset)
    : (safePage - 1) * safeLimit;
  const cacheKey = JSON.stringify({
    locale: filters.locale || '',
    series: filters.series || '',
    rarity: filters.rarity || '',
    q: normalizeSearch(filters.q || ''),
    limit: safeLimit || '',
    offset: safeLimit ? safeOffset : ''
  });
  const cached = readCache(cardQueryCache.get(cacheKey));
  if (cached) return cached;

  const seriesMap = await fetchSeriesMap();
  const pageSize = 1000;
  const rows = [];

  const startAt = safeLimit ? safeOffset : 0;
  const endAt = safeLimit ? safeOffset + safeLimit - 1 : null;

  for (let start = startAt; ; start += pageSize) {
    let query = supabaseAdmin.from('cards').select('*');

    if (filters.locale) query = query.eq('locale', filters.locale);
    if (filters.series) query = query.eq('series_id', filters.series);
    if (filters.rarity) query = query.eq('rarity', filters.rarity);
    if (filters.q) {
      query = query.ilike('search_text_normalized', `%${normalizeSearch(filters.q)}%`);
    }

    const rangeEnd = safeLimit ? Math.min(start + pageSize - 1, endAt) : start + pageSize - 1;
    const { data, error } = await query
      .order('locale', { ascending: true })
      .order('series_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('card_no', { ascending: true })
      .range(start, rangeEnd);

    if (error) throw error;
    rows.push(...(data || []));
    if (safeLimit || !data || data.length < pageSize) break;
  }

  const cards = rows.map((row) => toLegacyCard(row, seriesMap));
  writeCache(cardQueryCache, cacheKey, cards);
  return cards;
}

export async function readSupabaseCardById(id) {
  if (!hasSupabaseAdmin || !id) return null;
  const seriesMap = await fetchSeriesMap();
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toLegacyCard(data, seriesMap) : null;
}
