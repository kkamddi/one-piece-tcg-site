import { supabaseAdmin } from '../lib/supabase-admin.js';

const MARKET_API_ORIGIN = (process.env.MARKET_API_ORIGIN || '').trim();
const SNKRDUNK_BASE = 'https://snkrdunk.com';
const CACHE_SECONDS = 60 * 30;
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

function buildSeries(points = [], price = 0) {
  const merged = mergeCurrentPoint(points, price);
  return {
    '7d': filterPoints(merged, '7d'),
    '1m': filterPoints(merged, '1m'),
    all: filterPoints(merged, 'all')
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
  return buildFallbackDetail(item, conditionPrices, { persistSnapshot: params.get('summary') !== '1' });
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
