const CACHE_SECONDS = 60 * 10;
const USD_TO_JPY = 155;
const USD_TO_KRW = 1360;
const PSA_SPEC_URLS = {
  'JP::P-046': 'https://www.psacard.com/spec/psa/9555289'
};

function getD1Binding() {
  const binding = process.env?.OPTCG_PUBLIC_D1 || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

function usdToJpy(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * USD_TO_JPY) : 0;
}

function usdToKrw(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * USD_TO_KRW) : 0;
}

function toTimestamp(dateText) {
  const timestamp = Date.parse(dateText);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSpecUrl(link) {
  if (PSA_SPEC_URLS[link?.card_id]) return PSA_SPEC_URLS[link.card_id];
  try {
    const basis = JSON.parse(link?.match_basis_json || '[]');
    const url = Array.isArray(basis) ? basis.find((item) => /^https:\/\/www\.psacard\.com\/spec\/psa\//.test(String(item))) : '';
    return url || '';
  } catch {
    return '';
  }
}

function filterRange(points, range) {
  if (range === 'all') return points;
  const days = range === '1m' ? 30 : 7;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return points.filter((point) => toTimestamp(point.point_date || point.date) >= cutoff);
}

function toSeriesPoint(row) {
  const usd = Number(row.median_usd || 0);
  return {
    date: row.point_date,
    price: usdToJpy(usd),
    priceUsd: usd,
    priceKrw: usdToKrw(usd),
    tradeCount: Number(row.trade_count || 0),
    sources: row.sources_json ? JSON.parse(row.sources_json) : [],
    timestamp: toTimestamp(row.point_date)
  };
}

function toRecentSale(row) {
  const usd = Number(row.price_usd || 0);
  return {
    date: row.sold_at,
    condition: 'PSA10',
    price: usdToJpy(usd),
    priceUsd: usd,
    priceKrw: Number(row.price_krw || usdToKrw(usd)),
    platform: row.platform || row.source || 'PSA',
    source: row.source || 'psa',
    title: row.title || '',
    sourceUrl: row.source_url || '',
    timestamp: toTimestamp(row.sold_at)
  };
}

function toLatestSummary(row) {
  const usd = Number(row.price_usd || 0);
  return {
    cardId: row.card_id,
    cardNo: row.card_no,
    priceUsd: usd,
    priceKrw: Number(row.price_krw || usdToKrw(usd)),
    date: row.sold_at || '',
    platform: row.platform || row.source || 'PSA',
    source: row.source || 'psa',
    sourceUrl: getSpecUrl(row) || row.source_url || ''
  };
}

export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const d1 = getD1Binding();
  if (!d1) return response.status(503).json({ error: 'd1_not_configured' });

  const summary = String(request.query?.summary || '').trim().toLowerCase();
  if (summary === 'latest') {
    const rowsResult = await d1.prepare(`
      SELECT
        l.card_id,
        l.card_no,
        l.locale,
        l.name,
        l.match_basis_json,
        t.sold_at,
        t.price_usd,
        t.price_krw,
        t.platform,
        t.source,
        t.source_url
      FROM psa10_market_links l
      LEFT JOIN psa10_market_trades t
        ON t.id = (
          SELECT id
          FROM psa10_market_trades
          WHERE card_id = l.card_id
            AND grade = 'PSA10'
            AND status = 'approved'
          ORDER BY sold_at DESC
          LIMIT 1
        )
      WHERE l.status = 'approved'
      ORDER BY l.card_no ASC
    `).all();
    const items = (rowsResult?.results || [])
      .map(toLatestSummary)
      .filter((item) => item.cardId && item.priceUsd > 0);

    response.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    return response.status(200).json({ items });
  }

  const cardId = String(request.query?.cardId || '').trim();
  if (!cardId) return response.status(400).json({ error: 'missing_card_id' });

  const link = await d1.prepare(`
    SELECT card_id, card_no, locale, name, grade, search_query, match_basis_json, status, confidence, notes
    FROM psa10_market_links
    WHERE card_id = ? AND status = 'approved'
    LIMIT 1
  `).bind(cardId).first();

  if (!link) {
    response.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    return response.status(404).json({ error: 'psa10_link_not_found', cardId });
  }

  const pointsResult = await d1.prepare(`
    SELECT point_date, median_usd, min_usd, max_usd, trade_count, sources_json
    FROM psa10_market_daily_points
    WHERE card_id = ? AND grade = 'PSA10' AND source = 'integrated'
    ORDER BY point_date ASC
  `).bind(cardId).all();

  const tradesResult = await d1.prepare(`
    SELECT sold_at, price_usd, price_krw, platform, source, title, source_url
    FROM psa10_market_trades
    WHERE card_id = ? AND grade = 'PSA10' AND status = 'approved'
    ORDER BY sold_at DESC
    LIMIT 30
  `).bind(cardId).all();

  const allPoints = (pointsResult?.results || []).map(toSeriesPoint);
  const recentSales = (tradesResult?.results || []).map(toRecentSale);
  const latest = recentSales[0] || null;
  const specUrl = getSpecUrl(link);

  response.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
  return response.status(200).json({
    cardId,
    link,
    defaultCondition: 'psa10',
    conditions: [{ key: 'psa10', label: 'PSA10 통합' }],
    ranges: [
      { key: '7d', label: '7D' },
      { key: '1m', label: '1M' },
      { key: 'all', label: 'ALL' }
    ],
    latestByCondition: {
      psa10: latest ? {
        price: latest.price,
        priceUsd: latest.priceUsd,
        priceKrw: latest.priceKrw,
        platform: latest.platform,
        date: latest.date,
        sourceUrl: specUrl || latest.sourceUrl
      } : null
    },
    series: {
      psa10: {
        '7d': filterRange(allPoints, '7d'),
        '1m': filterRange(allPoints, '1m'),
        all: allPoints
      }
    },
    recentSalesByCondition: {
      psa10: recentSales
    }
  });
}
