import { supabaseAdmin } from '../lib/supabase-admin.js';
import priceChartingMarketLinks from '../src/data/pricecharting-market-links.js';

const MARKET_API_ORIGIN = (process.env.MARKET_API_ORIGIN || '').trim();
const SNKRDUNK_BASE = 'https://snkrdunk.com';
const PRICECHARTING_BASE = 'https://www.pricecharting.com';
const CACHE_SECONDS = 60 * 30;
const PRICECHARTING_CACHE_SECONDS = 60 * 60 * 12;
const USD_TO_JPY = 155;
const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';
const SNAPSHOT_BOARD_ID = '__market_price_snapshot__';
const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SNAPSHOT_LIMIT = 180;

function isSelfRequest(request) {
  if (!MARKET_API_ORIGIN) return true;
  const host = request.headers?.host || request.headers?.get?.('host') || '';
  return host === new URL(MARKET_API_ORIGIN).host;
}

function normalizeParams(query) {
  const params = new URLSearchParams(query || {});
  if (params.get('mode') === 'summary') {
    params.delete('mode');
    params.set('summary', '1');
  }
  return params;
}

function usdToJpy(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * USD_TO_JPY);
}

function centsToJpy(value) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return usdToJpy(cents / 100);
}

function conditionKey(name) {
  const text = String(name || '').trim().toLowerCase();
  if (text === 'a') return 'a';
  if (text === 'psa 10' || text === 'psa10') return 'psa10';
  return '';
}

function getConditionPrice(conditionPrices, key) {
  const found = (conditionPrices || []).find((item) => conditionKey(item.conditionName) === key);
  return found ? usdToJpy(found.minPrice) : 0;
}

function getConditionRaw(conditionPrices, key) {
  return (conditionPrices || []).find((item) => conditionKey(item.conditionName) === key) || null;
}

async function fetchConditionPrices(apparelId) {
  if (!apparelId) return [];
  try {
    const response = await fetch(`${SNKRDUNK_BASE}/en/v1/trading-cards/${apparelId}/min-prices-by-conditions`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 OPTCGKoreaBot/1.0'
      },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.conditionPrices) ? data.conditionPrices : [];
  } catch {
    return [];
  }
}

function slugifyPriceChartingPart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function marketItemLooksVariant(item) {
  const text = `${item?.name || ''} ${item?.setName || ''}`;
  return /(?:-P\b|Parallel|Comic|Wanted|SPC|THE BEST|Premium|Promotional|Championship|Winner|Prize|Anniversary|Flagship|World Final)/i.test(text);
}

function derivePriceChartingUrl(item) {
  if (!item?.code || !item?.name || !item?.setName) return '';
  if (marketItemLooksVariant(item)) return '';

  const cleanSet = String(item.setName || '')
    .replace(/^Booster Pack\s*/i, '')
    .replace(/^Extra Booster\s*/i, '')
    .replace(/^Starter Deck\s*/i, '')
    .replace(/["“”]/g, '')
    .trim();
  const setSlug = slugifyPriceChartingPart(cleanSet);
  if (!setSlug) return '';

  const namePart = String(item.name || '')
    .replace(/\[[^\]]+\].*$/g, '')
    .replace(/\([^)]*\).*$/g, '')
    .replace(/\b(?:L|C|UC|R|SR|SEC|SP CARD|SP|P)\b.*$/i, '')
    .replace(/\b([A-Za-z]+)\s+([A-Z])\s+([A-Za-z]+)\b/g, '$1$2$3')
    .trim();
  const cardSlug = slugifyPriceChartingPart(`${namePart} ${item.code}`);
  if (!cardSlug) return '';

  return `${PRICECHARTING_BASE}/game/one-piece-japanese-${setSlug}/${cardSlug}`;
}

function getApprovedPriceChartingUrl(item) {
  const apparelId = String(item?.apparelId || '');
  if (!apparelId) return '';
  const match = (Array.isArray(priceChartingMarketLinks) ? priceChartingMarketLinks : [])
    .find((link) => (
      link?.status === 'approved'
      && String(link.apparelId || '') === apparelId
      && typeof link.priceChartingUrl === 'string'
      && link.priceChartingUrl.startsWith(`${PRICECHARTING_BASE}/game/`)
    ));
  return match?.priceChartingUrl || '';
}

function parsePriceChartingChartData(html) {
  const match = String(html || '').match(/VGPC\.chart_data\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parsePriceChartingPrice(html, label) {
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(new RegExp(`<td>\\s*${escaped}\\s*<\\/td>\\s*<td[^>]*>\\s*\\$([0-9,.]+)\\s*<\\/td>`, 'i'));
  if (!match) return 0;
  return usdToJpy(Number(match[1].replace(/,/g, '')));
}

function priceChartingPointsToJpy(points = []) {
  return (Array.isArray(points) ? points : [])
    .map(([timestamp, cents]) => ({
      timestamp: Number(timestamp),
      price: centsToJpy(cents),
      source: 'pricecharting_psa10'
    }))
    .filter((point) => Number.isFinite(point.timestamp) && point.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchPriceChartingSupplement(item) {
  const url = getApprovedPriceChartingUrl(item) || derivePriceChartingUrl(item);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 OPTCGKoreaBot/1.0'
      },
      redirect: 'manual',
      cf: { cacheTtl: PRICECHARTING_CACHE_SECONDS, cacheEverything: true }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const chartData = parsePriceChartingChartData(html);
    const psa10Points = priceChartingPointsToJpy(chartData?.manualonly);
    const psa10Price = parsePriceChartingPrice(html, 'PSA 10') || psa10Points[psa10Points.length - 1]?.price || 0;
    if (!psa10Price && !psa10Points.length) return null;
    return { url, psa10Price, psa10Points };
  } catch {
    return null;
  }
}

function mergeUniquePoints(...pointGroups) {
  const byTimestamp = new Map();
  pointGroups.flat().forEach((point) => {
    const timestamp = Number(point?.timestamp || 0);
    const price = Number(point?.price || 0);
    if (!Number.isFinite(timestamp) || price <= 0 || point.synthetic) return;
    byTimestamp.set(timestamp, { timestamp, price, source: point.source || 'market' });
  });
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function priceChartingPointsToRecentSales(points = [], label = 'PSA10') {
  return (Array.isArray(points) ? points : [])
    .slice()
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
    .slice(0, 8)
    .map((point) => ({
      date: formatSnapshotDate(point.timestamp),
      timestamp: point.timestamp,
      price: point.price,
      condition: label,
      source: point.source || 'pricecharting'
    }));
}

function applyPriceChartingSupplement(detail, supplement) {
  if (!supplement?.psa10Price && !supplement?.psa10Points?.length) return detail;
  const existingAll = detail?.series?.psa10?.all || [];
  const psa10Points = mergeUniquePoints(existingAll, supplement.psa10Points || []);
  const psa10Price = Number(supplement.psa10Price || detail?.latestByCondition?.psa10?.price || 0) || 0;
  if (!psa10Points.length && !psa10Price) return detail;

  return {
    ...detail,
    latestByCondition: {
      ...detail.latestByCondition,
      psa10: psa10Price
        ? { timestamp: Date.now(), price: psa10Price, source: 'pricecharting_psa10' }
        : detail.latestByCondition?.psa10
    },
    series: {
      ...detail.series,
      psa10: buildSeries(psa10Points, psa10Price)
    },
    recentSalesByCondition: {
      ...detail.recentSalesByCondition,
      psa10: [
        ...priceChartingPointsToRecentSales(supplement.psa10Points || [], 'PSA10'),
        ...(detail.recentSalesByCondition?.psa10 || [])
      ]
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 8)
    },
    sources: {
      ...(detail.sources || {}),
      pricecharting: {
        url: supplement.url,
        condition: 'psa10'
      }
    }
  };
}

function normalizeSnapshotContent(content) {
  if (!content) return null;
  try {
    return typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return null;
  }
}

function snapshotAuthorToken(apparelId, key) {
  return `market:${apparelId}:${key}`;
}

async function saveMarketSnapshots(item, conditionPrices = []) {
  if (!supabaseAdmin || !item?.apparelId) return;

  const now = Date.now();
  const bucketStartedAt = Math.floor(now / SNAPSHOT_INTERVAL_MS) * SNAPSHOT_INTERVAL_MS;
  const bucketDate = new Date(bucketStartedAt).toISOString();
  const rows = ['a', 'psa10'].map((key) => {
    const raw = getConditionRaw(conditionPrices, key);
    const price = raw ? usdToJpy(raw.minPrice) : 0;
    if (!price) return null;
    const authorToken = snapshotAuthorToken(item.apparelId, key);
    const content = {
      apparelId: Number(item.apparelId),
      code: item.code || '',
      condition: key,
      conditionName: raw.conditionName || key.toUpperCase(),
      conditionId: raw.conditionId || null,
      price,
      minPriceUsd: Number(raw.minPrice || 0) || 0,
      source: 'snkrdunk_min_price',
      capturedAt: new Date(now).toISOString()
    };
    return {
      id: `market-snapshot-${item.apparelId}-${key}-${bucketStartedAt}`,
      created_at: bucketDate,
      updated_at: new Date(now).toISOString(),
      board_id: SNAPSHOT_BOARD_ID,
      nickname: 'market',
      title: `${item.code || ''} ${key}`.trim(),
      card_name: item.code || '',
      image_url: item.previewImageUrl || '',
      content: JSON.stringify(content),
      likes: 0,
      views: 0,
      author_token: authorToken,
      liked_tokens: []
    };
  }).filter(Boolean);

  if (!rows.length) return;
  try {
    await supabaseAdmin.from(COMMUNITY_TABLE).upsert(rows, { onConflict: 'id' });
  } catch {
    // Snapshot persistence is best-effort. Market display must not fail because of it.
  }
}

async function readMarketSnapshots(apparelId) {
  if (!supabaseAdmin || !apparelId) return { a: [], psa10: [] };
  try {
    const { data, error } = await supabaseAdmin
      .from(COMMUNITY_TABLE)
      .select('content, created_at')
      .eq('board_id', SNAPSHOT_BOARD_ID)
      .in('author_token', [snapshotAuthorToken(apparelId, 'a'), snapshotAuthorToken(apparelId, 'psa10')])
      .order('created_at', { ascending: true })
      .limit(SNAPSHOT_LIMIT);
    if (error) return { a: [], psa10: [] };
    return (data || []).reduce((acc, row) => {
      const parsed = normalizeSnapshotContent(row.content);
      const key = conditionKey(parsed?.condition || parsed?.conditionName);
      const price = Number(parsed?.price || 0);
      const timestamp = new Date(parsed?.capturedAt || row.created_at || Date.now()).getTime();
      if ((key === 'a' || key === 'psa10') && price > 0 && Number.isFinite(timestamp)) {
        acc[key].push({ timestamp, price });
      }
      return acc;
    }, { a: [], psa10: [] });
  } catch {
    return { a: [], psa10: [] };
  }
}

function mergeCurrentPoint(points = [], price = 0) {
  const valid = points
    .map((point) => ({ timestamp: Number(point.timestamp), price: Number(point.price) }))
    .filter((point) => Number.isFinite(point.timestamp) && point.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!price) return valid;
  const now = Date.now();
  const last = valid[valid.length - 1];
  if (!last || Math.abs(now - last.timestamp) > 60 * 60 * 1000 || last.price !== price) {
    valid.push({ timestamp: now, price });
  }
  return valid;
}

function filterPoints(points = [], range) {
  if (range === 'all') return points;
  const days = range === '7d' ? 7 : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = points.filter((point) => point.timestamp >= cutoff);
  return filtered.length ? filtered : points.slice(-1);
}

function ensureDrawablePoints(points = [], range) {
  if (points.length !== 1) return points;
  const point = points[0];
  const fallbackSpan = range === '7d'
    ? 24 * 60 * 60 * 1000
    : range === '1m'
      ? 3 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
  return [
    { ...point, timestamp: point.timestamp - fallbackSpan, synthetic: true },
    point
  ];
}

function buildSeries(points = [], price = 0) {
  const merged = mergeCurrentPoint(points, price);
  return {
    '7d': ensureDrawablePoints(filterPoints(merged, '7d'), '7d'),
    '1m': ensureDrawablePoints(filterPoints(merged, '1m'), '1m'),
    all: ensureDrawablePoints(filterPoints(merged, 'all'), 'all')
  };
}

function formatSnapshotDate(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hour}:${minute}`;
}

function buildRecentSnapshots(points = [], price = 0, label = '') {
  return mergeCurrentPoint(points, price)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)
    .map((point) => ({
      date: formatSnapshotDate(point.timestamp),
      timestamp: point.timestamp,
      price: point.price,
      condition: label
    }));
}

async function buildFallbackDetail(item, conditionPrices = [], { persistSnapshot = false } = {}) {
  const basePrice = usdToJpy(item?.minPrice);
  const aPrice = getConditionPrice(conditionPrices, 'a') || basePrice;
  const psa10Price = getConditionPrice(conditionPrices, 'psa10');
  if (persistSnapshot) await saveMarketSnapshots(item, conditionPrices);
  const snapshots = await readMarketSnapshots(item?.apparelId);
  const latestByCondition = {};
  if (aPrice) latestByCondition.a = { timestamp: Date.now(), price: aPrice };
  if (psa10Price) latestByCondition.psa10 = { timestamp: Date.now(), price: psa10Price };
  return {
    item: {
      code: item?.code || '',
      apparelId: item?.apparelId || '',
      name: item?.name || '',
      setName: item?.setName || '',
      sourceUrl: item?.sourceUrl || '',
      previewImageUrl: item?.previewImageUrl || ''
    },
    conditions: [
      { key: 'a', label: 'A등급' },
      { key: 'psa10', label: 'PSA10' }
    ],
    defaultCondition: 'a',
    ranges: [
      { key: '7d', label: '7D' },
      { key: '1m', label: '1M' },
      { key: 'all', label: 'ALL' }
    ],
    series: {
      a: buildSeries(snapshots.a, aPrice),
      psa10: buildSeries(snapshots.psa10, psa10Price)
    },
    latestByCondition,
    recentSalesByCondition: {
      a: buildRecentSnapshots(snapshots.a, aPrice, 'A'),
      psa10: buildRecentSnapshots(snapshots.psa10, psa10Price, 'PSA10')
    }
  };
}

export async function collectMarketSnapshot(item) {
  if (!item?.apparelId) return { ok: false, error: 'missing_apparel_id' };
  const conditionPrices = await fetchConditionPrices(item.apparelId);
  await saveMarketSnapshots(item, conditionPrices);
  const aPrice = getConditionPrice(conditionPrices, 'a') || usdToJpy(item?.minPrice);
  const psa10Price = getConditionPrice(conditionPrices, 'psa10');
  return {
    ok: Boolean(aPrice || psa10Price),
    apparelId: item.apparelId,
    code: item.code || '',
    aPrice,
    psa10Price
  };
}

async function localFallback(params) {
  const { default: marketCards } = await import('../src/data/market-cards.js');
  const apparelId = params.get('apparelId');
  const code = (params.get('code') || '').trim().toUpperCase();
  const candidates = (Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => {
      if (apparelId) return String(item.apparelId) === String(apparelId);
      return code ? String(item.code || '').toUpperCase() === code : false;
    });
  const item = candidates[0] || null;
  if (!item) return { error: 'market_item_not_found', candidates: [] };
  const conditionPrices = await fetchConditionPrices(item.apparelId);
  const detail = await buildFallbackDetail(item, conditionPrices, { persistSnapshot: params.get('summary') !== '1' });
  if (params.get('summary') === '1') return detail;
  const priceChartingSupplement = await fetchPriceChartingSupplement(item);
  return applyPriceChartingSupplement(detail, priceChartingSupplement);
}

export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const params = normalizeParams(request.query);

  if (!MARKET_API_ORIGIN || isSelfRequest(request)) {
    const fallback = await localFallback(params);
    return response.status(fallback.error ? 404 : 200).json(fallback);
  }

  const upstream = `${MARKET_API_ORIGIN}/api/market?${params.toString()}`;
  let upstreamResponse;
  let text;
  try {
    upstreamResponse = await fetch(upstream, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    text = await upstreamResponse.text();
  } catch {
    const fallback = await localFallback(params);
    return response.status(fallback.error ? 404 : 200).json(fallback);
  }
  const contentType = upstreamResponse.headers.get('Content-Type') || '';
  if (!upstreamResponse.ok || !contentType.includes('application/json')) {
    const fallback = await localFallback(params);
    return response.status(fallback.error ? 404 : 200).json(fallback);
  }

  response.setHeader('Content-Type', contentType || 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(upstreamResponse.status).send(text);
}
