const MARKET_API_ORIGIN = (process.env.MARKET_API_ORIGIN || '').trim();
const SNKRDUNK_BASE = 'https://snkrdunk.com';
const CACHE_SECONDS = 60 * 30;
const USD_TO_JPY = 155;

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

function buildSeriesPoint(price) {
  const now = Date.now();
  return price ? [{ timestamp: now, price }] : [];
}

function buildFallbackDetail(item, conditionPrices = []) {
  const basePrice = usdToJpy(item?.minPrice);
  const aPrice = getConditionPrice(conditionPrices, 'a') || basePrice;
  const psa10Price = getConditionPrice(conditionPrices, 'psa10');
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
      a: { '7d': buildSeriesPoint(aPrice), '1m': buildSeriesPoint(aPrice), all: buildSeriesPoint(aPrice) },
      psa10: { '7d': buildSeriesPoint(psa10Price), '1m': buildSeriesPoint(psa10Price), all: buildSeriesPoint(psa10Price) }
    },
    latestByCondition,
    recentSalesByCondition: { a: [], psa10: [] }
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
  return buildFallbackDetail(item, conditionPrices);
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
