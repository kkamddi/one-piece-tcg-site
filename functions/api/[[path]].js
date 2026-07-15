const MAX_BODY_BYTES = 512 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMITS = {
  auth: 30,
  admin: 60,
  me: 60,
  communityIndex: 60,
  communityId: 60,
  cardsIndex: 180,
  cardsSearch: 180,
  cardsId: 240,
  shopsIndex: 120,
  shopsRegions: 120,
  series: 120,
  cardImage: 240,
  cardThumb: 300,
  market: 120,
  marketplace: 120,
  psa10Market: 120,
  marketCollector: 120,
  pushSubscriptions: 60,
  portfolio: 90,
  boxMarket: 30,
  cardMarketLinkOverrides: 120
};
const rateLimitBuckets = new Map();
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Frame-Options': 'SAMEORIGIN'
};

function applySecurityHeaders(headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return headers;
}

function ensureProcessEnv(env) {
  globalThis.process = globalThis.process || {};
  globalThis.process.env = {
    ...(globalThis.process.env || {}),
    ...env
  };
}

function headersToObject(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function getClientIp(headers) {
  return headers.get('cf-connecting-ip')
    || headers.get('x-real-ip')
    || String(headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unknown';
}

function isClearlyBlockedBot(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return false;
  const allowedSearchBots = [
    'googlebot',
    'bingbot',
    'oai-searchbot',
    'perplexitybot',
    'naverbot'
  ];
  if (allowedSearchBots.some((bot) => ua.includes(bot))) return false;
  return [
    'bytespider',
    'ccbot',
    'claudebot',
    'dataforseobot',
    'semrushbot',
    'ahrefsbot',
    'mj12bot',
    'dotbot'
  ].some((bot) => ua.includes(bot));
}

function isRateLimited(request, routeKey) {
  const max = RATE_LIMITS[routeKey];
  if (!max) return false;
  const now = Date.now();
  const ip = getClientIp(request.headers);
  const bucketKey = `${routeKey}:${ip}`;
  const bucket = rateLimitBuckets.get(bucketKey);

  if (!bucket || now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(bucketKey, { count: 1, startedAt: now });
    if (rateLimitBuckets.size > 1000) {
      for (const [key, value] of rateLimitBuckets.entries()) {
        if (now - value.startedAt > RATE_LIMIT_WINDOW_MS) rateLimitBuckets.delete(key);
      }
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > max;
}

async function parseBody(request, maxBodyBytes = MAX_BODY_BYTES) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBodyBytes) {
    const error = new Error('payload_too_large');
    error.statusCode = 413;
    throw error;
  }
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBodyBytes) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    try {
      return text ? JSON.parse(text) : undefined;
    } catch {
      const error = new Error('invalid_json');
      error.statusCode = 400;
      throw error;
    }
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBodyBytes) {
    const error = new Error('payload_too_large');
    error.statusCode = 413;
    throw error;
  }
  return text;
}

function createResponseShim() {
  const headers = new Headers();
  let status = 200;
  let body = null;
  let sentResponse = null;

  return {
    response: {
      setHeader(name, value) {
        headers.set(name, String(value));
      },
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
        body = JSON.stringify(payload);
        sentResponse = new Response(body, { status, headers: applySecurityHeaders(headers) });
        return sentResponse;
      },
      send(payload) {
        body = payload;
        sentResponse = new Response(body, { status, headers: applySecurityHeaders(headers) });
        return sentResponse;
      },
      end(payload = null) {
        if (sentResponse && payload === null) return sentResponse;
        body = payload;
        sentResponse = new Response(body, { status, headers: applySecurityHeaders(headers) });
        return sentResponse;
      }
    },
    finalize() {
      return sentResponse || new Response(body, { status, headers: applySecurityHeaders(headers) });
    }
  };
}

function routeApi(pathParts) {
  const [first, second] = pathParts.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  if (first === 'auth') return { key: 'auth' };
  if (first === 'admin') return { key: 'admin' };
  if (first === 'me') return { key: 'me' };
  if (first === 'community' && !second) return { key: 'communityIndex' };
  if (first === 'community' && second) return { key: 'communityId', params: { id: second } };
  if (first === 'cards' && !second) return { key: 'cardsIndex' };
  if (first === 'cards' && second === 'search') return { key: 'cardsSearch' };
  if (first === 'cards' && second) return { key: 'cardsId', params: { id: second } };
  if (first === 'shops' && !second) return { key: 'shopsIndex' };
  if (first === 'shops' && second === 'regions') return { key: 'shopsRegions' };
  if (first === 'series') return { key: 'series' };
  if (first === 'card-image') return { key: 'cardImage' };
  if (first === 'card-thumb') return { key: 'cardThumb' };
  if (first === 'market') return { key: 'market' };
  if (first === 'marketplace') return { key: 'marketplace' };
  if (first === 'psa10-market') return { key: 'psa10Market' };
  if (first === 'market-collector') return { key: 'marketCollector' };
  if (first === 'box-market') return { key: 'boxMarket' };
  if (first === 'market-index') return { key: 'marketIndex' };
  if (first === 'price-alerts') return { key: 'priceAlerts' };
  if (first === 'portfolio') return { key: 'portfolio' };
  if (first === 'push-subscriptions') return { key: 'pushSubscriptions' };
  if (first === 'card-market-link-overrides') return { key: 'cardMarketLinkOverrides' };
  return null;
}

async function loadHandler(key) {
  if (key === 'auth') return (await import('../../api/auth/index.js')).default;
  if (key === 'admin') return (await import('../../api/admin/index.js')).default;
  if (key === 'me') return (await import('../../api/me.js')).default;
  if (key === 'communityIndex') return (await import('../../api/community/index.js')).default;
  if (key === 'communityId') return (await import('../../api/community/[id].js')).default;
  if (key === 'cardsIndex') return (await import('../../api/cards/index.js')).default;
  if (key === 'cardsSearch') return (await import('../../api/cards/search.js')).default;
  if (key === 'cardsId') return (await import('../../api/cards/[id].js')).default;
  if (key === 'shopsIndex') return (await import('../../api/shops/index.js')).default;
  if (key === 'shopsRegions') return (await import('../../api/shops/regions.js')).default;
  if (key === 'series') return (await import('../../api/series.js')).default;
  if (key === 'cardImage') return (await import('../../api/card-image.js')).default;
  if (key === 'cardThumb') return (await import('../../api/card-thumb.js')).default;
  if (key === 'market') return (await import('../../api/market.js')).default;
  if (key === 'marketplace') return (await import('../../api/marketplace.js')).default;
  if (key === 'psa10Market') return (await import('../../api/psa10-market.js')).default;
  if (key === 'marketCollector') return (await import('../../api/market-collector.js')).default;
  if (key === 'boxMarket') return (await import('../../api/box-market.js')).default;
  if (key === 'marketIndex') return (await import('../../api/market-index.js')).default;
  if (key === 'priceAlerts') return (await import('../../api/price-alerts.js')).default;
  if (key === 'portfolio') return (await import('../../api/portfolio.js')).default;
  if (key === 'pushSubscriptions') return (await import('../../api/push-subscriptions.js')).default;
  if (key === 'cardMarketLinkOverrides') return (await import('../../api/card-market-link-overrides.js')).default;
  return null;
}

export async function onRequest(context) {
  ensureProcessEnv(context.env);

  const url = new URL(context.request.url);
  const pathParts = (context.params.path || [])
    .flatMap((part) => String(part).split('/'))
    .filter(Boolean);
  const route = routeApi(pathParts);

  if (!route) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: applySecurityHeaders(new Headers({ 'Content-Type': 'application/json; charset=utf-8' }))
    });
  }
  if (isClearlyBlockedBot(context.request.headers.get('user-agent'))) {
    return new Response(JSON.stringify({ error: 'bot_blocked' }), {
      status: 403,
      headers: applySecurityHeaders(new Headers({ 'Content-Type': 'application/json; charset=utf-8' }))
    });
  }
  if (isRateLimited(context.request, route.key)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: applySecurityHeaders(new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': '60'
      }))
    });
  }

  const query = Object.fromEntries(url.searchParams.entries());
  let body;
  try {
    const maxBodyBytes = route.key === 'marketplace' ? 1536 * 1024 : MAX_BODY_BYTES;
    body = await parseBody(context.request, maxBodyBytes);
  } catch (error) {
    if (error?.statusCode === 400 || error?.statusCode === 413) {
      return new Response(JSON.stringify({ error: error.message || 'invalid_request' }), {
        status: error.statusCode,
        headers: applySecurityHeaders(new Headers({ 'Content-Type': 'application/json; charset=utf-8' }))
      });
    }
    throw error;
  }
  const request = {
    method: context.request.method,
    headers: headersToObject(context.request.headers),
    query: { ...query, ...(route.params || {}) },
    body
  };
  const { response, finalize } = createResponseShim();
  try {
    const handler = await loadHandler(route.key);
    const result = await handler(request, response);
    return result instanceof Response ? result : finalize();
  } catch {
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: applySecurityHeaders(new Headers({ 'Content-Type': 'application/json; charset=utf-8' }))
    });
  }
}
