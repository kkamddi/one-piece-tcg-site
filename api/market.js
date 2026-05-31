const MARKET_API_ORIGIN = 'https://7a03ca96.optcgkorea-static.pages.dev';

function isSelfRequest(request) {
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

function buildFallbackDetail(item) {
  const price = Number(item?.minPrice || 0) || 0;
  const now = Date.now();
  const point = price ? [{ timestamp: now, price }] : [];
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
      a: { '7d': point, '1m': point, all: point },
      psa10: { '7d': [], '1m': [], all: [] }
    },
    latestByCondition: price ? { a: { timestamp: now, price } } : {},
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
  return item ? buildFallbackDetail(item) : { error: 'market_item_not_found', candidates: [] };
}

export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const params = normalizeParams(request.query);

  if (isSelfRequest(request)) {
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

  response.setHeader('Content-Type', upstreamResponse.headers.get('Content-Type') || 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(upstreamResponse.status).send(text);
}
