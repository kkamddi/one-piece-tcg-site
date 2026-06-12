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
const MARKET_DATA_SOURCE = String(process.env.MARKET_DATA_SOURCE || '').trim().toLowerCase();
const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const D1_BINDING_NAME = String(process.env.MARKET_D1_BINDING || 'OPTCG_PUBLIC_D1').trim();
const MARKET_WRITE_SOURCE = String(process.env.MARKET_WRITE_SOURCE || '').trim().toLowerCase();

function shouldReadD1Market() {
  return MARKET_DATA_SOURCE !== 'supabase'
    && (MARKET_DATA_SOURCE === 'd1' || Boolean(getD1Binding()) || Boolean(D1_API_TOKEN && D1_ACCOUNT_ID && D1_DATABASE_ID));
}

function shouldReadSupabaseMarket() {
  return MARKET_DATA_SOURCE === 'supabase';
}

function getD1Binding() {
  const binding = process.env?.[D1_BINDING_NAME] || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

async function queryD1(sql, params = []) {
  const binding = getD1Binding();
  if (binding) {
    const statement = binding.prepare(sql);
    const result = params.length ? await statement.bind(...params).all() : await statement.all();
    return result?.results || [];
  }
  if (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID) return [];
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${D1_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error('d1_market_query_failed');
  return body.result?.[0]?.results || [];
}

function shouldWriteD1Market() {
  return MARKET_WRITE_SOURCE === 'd1' || (MARKET_WRITE_SOURCE !== 'supabase' && Boolean(getD1Binding()));
}

function shouldWriteSupabaseMarket() {
  return MARKET_WRITE_SOURCE === 'supabase';
}

function todayDateKey(value = Date.now()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

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

function parseMarketTradeTimestamp(value) {
  const cleaned = String(value || '').replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1');
  const parsed = Date.parse(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function storedTradePriceToJpy(row) {
  const amount = Number(row?.price_amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return String(row?.price_currency || '').toUpperCase() === 'JPY' ? Math.round(amount) : usdToJpy(amount);
}

function parseChartMonthLabel(value) {
  const text = String(value || '').trim();
  const jp = text.match(/^(\d{4})年(\d{1,2})月$/);
  if (jp) return Date.UTC(Number(jp[1]), Number(jp[2]) - 1, 1);
  const jpDay = text.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jpDay) {
    const now = new Date();
    const year = now.getUTCFullYear();
    let timestamp = Date.UTC(year, Number(jpDay[1]) - 1, Number(jpDay[2]));
    if (timestamp > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      timestamp = Date.UTC(year - 1, Number(jpDay[1]) - 1, Number(jpDay[2]));
    }
    return timestamp;
  }
  const numericDay = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (numericDay) {
    const now = new Date();
    const year = now.getUTCFullYear();
    let timestamp = Date.UTC(year, Number(numericDay[1]) - 1, Number(numericDay[2]));
    if (timestamp > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      timestamp = Date.UTC(year - 1, Number(numericDay[1]) - 1, Number(numericDay[2]));
    }
    return timestamp;
  }
  const en = text.match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (en) {
    const parsed = Date.parse(`${en[1]} 1, ${en[2]} UTC`);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseChartNumber(value) {
  const number = String(value || '').replace(/[,$]/g, '').match(/-?\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 0;
}

function linearFit(pairs) {
  const valid = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (valid.length < 2) return null;
  const n = valid.length;
  const sumX = valid.reduce((sum, [x]) => sum + x, 0);
  const sumY = valid.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = valid.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumXX = valid.reduce((sum, [x]) => sum + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (!denom) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return (x) => slope * x + intercept;
}

function parseSvgPathPoints(pathText) {
  const points = [];
  const pattern = /[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let match;
  while ((match = pattern.exec(String(pathText || '')))) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return points;
}

function parseTranslate(value) {
  const match = String(value || '').match(/translate\(\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)?\s*\)/i);
  return match ? { x: Number(match[1]) || 0, y: Number(match[2]) || 0 } : { x: 0, y: 0 };
}

function stripSvgText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttrNumber(attrs, name) {
  const match = String(attrs || '').match(new RegExp(`${name}="(-?\\d+(?:\\.\\d+)?)"`, 'i'));
  return match ? Number(match[1]) : NaN;
}

function parseSvgTextLabels(svg, className) {
  const group = String(svg || '').match(new RegExp(`<g[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)</g>`, 'i'))?.[1] || '';
  const labels = [];
  const pattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match;
  while ((match = pattern.exec(group))) {
    const x = parseAttrNumber(match[1], 'x');
    const y = parseAttrNumber(match[1], 'y');
    const text = stripSvgText(match[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && text) labels.push({ x, y, text });
  }
  return labels;
}

function normalizeChartLabels(labels, svg, className) {
  const objectLabels = (labels || [])
    .filter((label) => label && typeof label === 'object')
    .map((label) => ({ x: Number(label.x), y: Number(label.y), text: String(label.text || '').trim() }))
    .filter((label) => Number.isFinite(label.x) && Number.isFinite(label.y) && label.text);
  return objectLabels.length >= 2 ? objectLabels : parseSvgTextLabels(svg, className);
}

function chartSvgToPoints(chart, source = 'snkrdunk_chart_snapshot') {
  const pathText = chart?.path || chart?.graphD || '';
  if (!pathText) return [];
  const translate = chart.seriesTranslate || parseTranslate(chart.graphTransform);
  const xLabels = normalizeChartLabels(chart.xLabels, chart.svg, 'highcharts-xaxis-labels');
  const yLabels = normalizeChartLabels(chart.yLabels, chart.svg, 'highcharts-yaxis-labels');
  const xFit = linearFit(xLabels
    .map((label) => [Number(label.x), parseChartMonthLabel(label.text)])
    .filter(([, timestamp]) => timestamp > 0));
  const yFit = linearFit(yLabels
    .map((label) => [Number(label.y), parseChartNumber(label.text)])
    .filter(([, price]) => price >= 0));
  if (!xFit || !yFit) return [];
  return parseSvgPathPoints(pathText)
    .map((point) => {
      const timestamp = Math.round(xFit(point.x + Number(translate.x || 0)));
      const priceUsd = yFit(point.y + Number(translate.y || 0));
      if (!Number.isFinite(timestamp) || !Number.isFinite(priceUsd) || timestamp <= 0 || priceUsd <= 0) return null;
      return {
        timestamp,
        price: usdToJpy(priceUsd),
        source
      };
    })
    .filter(Boolean);
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
  if (!shouldWriteSupabaseMarket()) return;
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

async function saveMarketStorageSnapshot(item, conditionPrices = []) {
  const capturedAt = new Date().toISOString();
  const apparelId = Number(item?.apparelId || 0);
  if (!apparelId) return;
  const minPriceAmount = Number(item.minPrice || 0) > 0 ? Number(item.minPrice) : null;
  const listingCount = Number.isFinite(Number(item.listingCount)) ? Number(item.listingCount) : null;
  const aRaw = getConditionRaw(conditionPrices, 'a');
  const psa10Raw = getConditionRaw(conditionPrices, 'psa10');
  const aPriceJpy = getConditionPrice(conditionPrices, 'a') || null;
  const psa10PriceJpy = getConditionPrice(conditionPrices, 'psa10') || null;

  if (shouldWriteD1Market()) {
    try {
      await queryD1(
        `insert into market_products (
          source, apparel_id, locale, code, name, set_name, source_url, preview_image_url,
          latest_a_price_jpy, latest_psa10_price_jpy, latest_min_price_amount,
          latest_min_price_currency, latest_listing_count, latest_captured_at,
          is_active, raw_market_card_json, updated_at
        ) values (
          'snkrdunk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
        )
        on conflict(source, apparel_id) do update set
          locale = excluded.locale,
          code = excluded.code,
          name = excluded.name,
          set_name = excluded.set_name,
          source_url = excluded.source_url,
          preview_image_url = excluded.preview_image_url,
          latest_a_price_jpy = excluded.latest_a_price_jpy,
          latest_psa10_price_jpy = excluded.latest_psa10_price_jpy,
          latest_min_price_amount = excluded.latest_min_price_amount,
          latest_min_price_currency = excluded.latest_min_price_currency,
          latest_listing_count = excluded.latest_listing_count,
          latest_captured_at = excluded.latest_captured_at,
          is_active = 1,
          raw_market_card_json = excluded.raw_market_card_json,
          updated_at = excluded.updated_at`,
        [
          apparelId,
          item.locale || 'JP',
          item.code || '',
          item.name || '',
          item.setName || null,
          item.sourceUrl || '',
          item.previewImageUrl || null,
          aPriceJpy,
          psa10PriceJpy,
          minPriceAmount,
          minPriceAmount ? 'USD' : null,
          listingCount,
          capturedAt,
          JSON.stringify(item || {}),
          capturedAt
        ]
      );

      const day = todayDateKey(capturedAt);
      const chartRows = [
        { key: 'a', price: aPriceJpy },
        { key: 'psa10', price: psa10PriceJpy }
      ].filter((row) => Number(row.price || 0) > 0);
      for (const row of chartRows) {
        await queryD1(
          `insert into market_chart_daily_points (
            source, apparel_id, locale, code, condition_key, point_date,
            median_price_jpy, min_price_jpy, max_price_jpy, trade_count, source_count, updated_at
          ) values (
            'snkrdunk', ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?
          )
          on conflict(source, apparel_id, condition_key, point_date) do update set
            median_price_jpy = excluded.median_price_jpy,
            min_price_jpy = excluded.min_price_jpy,
            max_price_jpy = excluded.max_price_jpy,
            source_count = excluded.source_count,
            updated_at = excluded.updated_at`,
          [
            apparelId,
            item.locale || 'JP',
            item.code || '',
            row.key,
            day,
            row.price,
            row.price,
            row.price,
            capturedAt
          ]
        );
      }
      return;
    } catch {
      if (MARKET_WRITE_SOURCE === 'd1') return;
      return;
    }
  }

  if (!shouldWriteSupabaseMarket() || !supabaseAdmin) return;

  try {
    await supabaseAdmin.from('market_products').upsert({
      source: 'snkrdunk',
      apparel_id: apparelId,
      locale: item.locale || 'JP',
      code: item.code || '',
      name: item.name || null,
      set_name: item.setName || null,
      source_url: item.sourceUrl || null,
      preview_image_url: item.previewImageUrl || null,
      latest_page_title: item.name || null,
      latest_min_price_amount: minPriceAmount,
      latest_min_price_currency: minPriceAmount ? 'USD' : null,
      latest_listing_count: listingCount,
      latest_captured_at: capturedAt,
      is_active: true,
      raw_market_card: item || {},
      updated_at: capturedAt
    }, { onConflict: 'source,apparel_id' });

    await supabaseAdmin.from('market_price_snapshots').insert({
      source: 'snkrdunk',
      apparel_id: apparelId,
      locale: item.locale || 'JP',
      code: item.code || '',
      captured_at: capturedAt,
      ok: Boolean(aRaw || psa10Raw || minPriceAmount),
      locked: false,
      has_history: false,
      has_chart: false,
      page_title: item.name || null,
      min_price_amount: minPriceAmount,
      min_price_currency: minPriceAmount ? 'USD' : null,
      min_price_text: item.minPriceFormat || null,
      listing_count: listingCount,
      raw_payload: {
        item,
        conditionPrices,
        source: 'market_collector_min_price'
      }
    });

    const chartRows = [
      { key: 'a', raw: aRaw },
      { key: 'psa10', raw: psa10Raw }
    ]
      .map(({ key, raw }) => {
        const price = raw ? getConditionPrice(conditionPrices, key) : 0;
        if (!price) return null;
        return {
          source: 'snkrdunk',
          apparel_id: apparelId,
          locale: item.locale || 'JP',
          code: item.code || '',
          condition_key: key,
          point_date: capturedAt,
          price_amount: price,
          price_currency: 'JPY',
          raw_payload: {
            source: 'market_collector_min_price',
            conditionName: raw.conditionName || key,
            conditionId: raw.conditionId || null,
            minPriceUsd: Number(raw.minPrice || 0) || 0
          }
        };
      })
      .filter(Boolean);

    if (chartRows.length) {
      await supabaseAdmin.from('market_chart_points').upsert(chartRows, {
        onConflict: 'source,apparel_id,condition_key,point_date,price_amount'
      });
    }
  } catch {
    // Dedicated market storage is best-effort. Keep the public price API available.
  }
}

async function readMarketSnapshots(apparelId) {
  if (!shouldReadSupabaseMarket()) return { a: [], psa10: [] };
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

async function readStoredMarketTrades(apparelId) {
  if (shouldReadD1Market() && apparelId) {
    try {
      const rows = await queryD1(
        `select condition_key, trade_date_text, price_amount_jpy, price_text, last_seen_at
         from market_recent_trades
         where source = 'snkrdunk' and apparel_id = ? and condition_key in ('a', 'psa10')
         order by coalesce(trade_date, last_seen_at) desc
         limit 500`,
        [Number(apparelId)]
      );
      const grouped = (rows || []).reduce((acc, row) => {
        const key = conditionKey(row.condition_key);
        const price = Number(row.price_amount_jpy || 0);
        const timestamp = parseMarketTradeTimestamp(row.trade_date_text) || new Date(row.last_seen_at || 0).getTime();
        if ((key === 'a' || key === 'psa10') && price > 0 && timestamp > 0) {
          acc[key].push({
            timestamp,
            price,
            condition: key === 'psa10' ? 'PSA 10' : 'A',
            dateText: row.trade_date_text,
            priceText: row.price_text,
            source: 'd1_snkrdunk_recent_trade'
          });
        }
        return acc;
      }, { a: [], psa10: [] });
      if (grouped.a.length || grouped.psa10.length) return grouped;
    } catch {
      return { a: [], psa10: [] };
    }
  }
  if (!shouldReadSupabaseMarket()) return { a: [], psa10: [] };
  if (!supabaseAdmin || !apparelId) return { a: [], psa10: [] };
  try {
    const { data, error } = await supabaseAdmin
      .from('market_recent_trades')
      .select('condition, trade_date_text, price_amount, price_currency, price_text, last_seen_at')
      .eq('source', 'snkrdunk')
      .eq('apparel_id', Number(apparelId))
      .in('condition', ['A', 'PSA 10'])
      .limit(500);
    if (error) return { a: [], psa10: [] };
    return (data || []).reduce((acc, row) => {
      const key = conditionKey(row.condition);
      const price = storedTradePriceToJpy(row);
      const timestamp = parseMarketTradeTimestamp(row.trade_date_text);
      if ((key === 'a' || key === 'psa10') && price > 0 && timestamp > 0) {
        acc[key].push({
          timestamp,
          price,
          condition: row.condition,
          dateText: row.trade_date_text,
          priceText: row.price_text,
          source: 'snkrdunk_recent_trade'
        });
      }
      return acc;
    }, { a: [], psa10: [] });
  } catch {
    return { a: [], psa10: [] };
  }
}

async function readStoredMarketChartPoints(apparelId) {
  if (shouldReadD1Market() && apparelId) {
    try {
      const rows = await queryD1(
        `select condition_key, point_date, median_price_jpy
         from market_chart_daily_points
         where source = 'snkrdunk' and apparel_id = ? and condition_key in ('a', 'psa10')
         order by point_date asc
         limit 1200`,
        [Number(apparelId)]
      );
      const points = (rows || []).reduce((acc, row) => {
        const key = conditionKey(row.condition_key);
        const price = Number(row.median_price_jpy || 0);
        const timestamp = new Date(row.point_date).getTime();
        if ((key === 'a' || key === 'psa10') && price > 0 && Number.isFinite(timestamp)) {
          acc[key].push({
            timestamp,
            price: Math.round(price),
            source: 'd1_snkrdunk_chart_daily'
          });
        }
        return acc;
      }, { a: [], psa10: [] });
      if (points.a.length || points.psa10.length) return points;
    } catch {
      return { a: [], psa10: [] };
    }
  }
  if (!shouldReadSupabaseMarket()) return { a: [], psa10: [] };
  if (!supabaseAdmin || !apparelId) return { a: [], psa10: [] };
  const fromSnapshots = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('market_price_snapshots')
        .select('raw_payload, captured_at')
        .eq('source', 'snkrdunk')
        .eq('apparel_id', Number(apparelId))
        .order('captured_at', { ascending: false })
        .limit(5);
      if (error) return { a: [], psa10: [] };
      return (data || []).reduce((acc, row) => {
        const charts = row.raw_payload?.charts || {};
        const aPoints = chartSvgToPoints(charts.A, 'snkrdunk_chart_snapshot');
        const psa10Points = chartSvgToPoints(charts['PSA 10'], 'snkrdunk_chart_snapshot');
        if (!acc.a.length && aPoints.length) acc.a = aPoints;
        if (!acc.psa10.length && psa10Points.length) acc.psa10 = psa10Points;
        return acc;
      }, { a: [], psa10: [] });
    } catch {
      return { a: [], psa10: [] };
    }
  };

  try {
    const { data, error } = await supabaseAdmin
      .from('market_chart_points')
      .select('condition_key, point_date, price_amount, price_currency')
      .eq('source', 'snkrdunk')
      .eq('apparel_id', Number(apparelId))
      .in('condition_key', ['a', 'psa10'])
      .order('point_date', { ascending: true })
      .limit(1200);
    if (error) return fromSnapshots();
    const points = (data || []).reduce((acc, row) => {
      const key = conditionKey(row.condition_key);
      const amount = Number(row.price_amount || 0);
      const timestamp = new Date(row.point_date).getTime();
      if ((key === 'a' || key === 'psa10') && amount > 0 && Number.isFinite(timestamp)) {
        acc[key].push({
          timestamp,
          price: String(row.price_currency || '').toUpperCase() === 'JPY' ? Math.round(amount) : usdToJpy(amount),
          source: 'snkrdunk_chart'
        });
      }
      return acc;
    }, { a: [], psa10: [] });
    if (!points.a.length && !points.psa10.length) return fromSnapshots();
    return points;
  } catch {
    return fromSnapshots();
  }
}

function mergeCurrentPoint(points = [], price = 0, source = '') {
  const futureCutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const valid = points
    .map((point) => ({ ...point, timestamp: Number(point.timestamp), price: Number(point.price) }))
    .filter((point) => (
      Number.isFinite(point.timestamp)
      && point.timestamp > 0
      && point.timestamp <= futureCutoff
      && point.price > 0
    ))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!price) return valid;
  const now = Date.now();
  const last = valid[valid.length - 1];
  if (!last || Math.abs(now - last.timestamp) > 60 * 60 * 1000 || last.price !== price) {
    valid.push({ timestamp: now, price, source });
  }
  return valid;
}

function medianNumber(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function aggregateDailyMedian(points = []) {
  const dayMs = 24 * 60 * 60 * 1000;
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const groups = new Map();

  for (const point of points) {
    const timestamp = Number(point.timestamp);
    const price = Number(point.price);
    if (!Number.isFinite(timestamp) || price <= 0) continue;
    const dayKey = Math.floor((timestamp + kstOffsetMs) / dayMs);
    const group = groups.get(dayKey) || [];
    group.push({ ...point, timestamp, price });
    groups.set(dayKey, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => {
      const prices = group.map((point) => point.price);
      const timestamps = group.map((point) => point.timestamp).sort((a, b) => a - b);
      const sourceText = group.map((point) => point.source || '').join(' ').toLowerCase();
      return {
        ...group[group.length - 1],
        timestamp: medianNumber(timestamps),
        price: medianNumber(prices),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        count: group.length,
        source: sourceText.includes('snkrdunk') ? 'snkrdunk_daily_median' : group.length > 1 ? 'daily_median' : group[0].source
      };
    });
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

function buildSeries(points = [], price = 0, source = '') {
  const merged = aggregateDailyMedian(mergeCurrentPoint(points, price, source));
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

function buildRecentSnapshots(points = [], price = 0, label = '', source = '') {
  return aggregateDailyMedian(points)
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)
    .map((point) => ({
      date: formatSnapshotDate(point.timestamp),
      timestamp: point.timestamp,
      price: point.price,
      condition: label,
      source: point.source || source || '',
      platform: /snkrdunk/i.test(String(point.source || source || '')) ? 'SNKR' : point.platform
    }));
}

function latestPointPrice(points = []) {
  const latest = (points || [])
    .filter((point) => Number(point?.timestamp || 0) > 0 && Number(point?.price || 0) > 0)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
  return Number(latest?.price || 0) || 0;
}

async function buildFallbackDetail(item, conditionPrices = [], { persistSnapshot = false } = {}) {
  const basePrice = usdToJpy(item?.minPrice);
  const storedTrades = await readStoredMarketTrades(item?.apparelId);
  const storedChartPoints = await readStoredMarketChartPoints(item?.apparelId);
  const aTradePrice = latestPointPrice(storedTrades.a);
  const psa10TradePrice = latestPointPrice(storedTrades.psa10);
  const aChartPrice = latestPointPrice(storedChartPoints.a);
  const psa10ChartPrice = latestPointPrice(storedChartPoints.psa10);
  const aPrice = getConditionPrice(conditionPrices, 'a') || aTradePrice || aChartPrice || basePrice;
  const psa10Price = getConditionPrice(conditionPrices, 'psa10') || psa10TradePrice || psa10ChartPrice;
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
      a: buildSeries([...storedChartPoints.a, ...snapshots.a, ...storedTrades.a], aPrice, 'snkrdunk_current_price'),
      psa10: buildSeries([...storedChartPoints.psa10, ...snapshots.psa10, ...storedTrades.psa10], psa10Price, 'snkrdunk_current_price')
    },
    latestByCondition,
    recentSalesByCondition: {
      a: buildRecentSnapshots([...storedChartPoints.a, ...snapshots.a, ...storedTrades.a], aPrice, 'A', 'snkrdunk_current_price'),
      psa10: buildRecentSnapshots([...storedChartPoints.psa10, ...snapshots.psa10, ...storedTrades.psa10], psa10Price, 'PSA10', 'snkrdunk_current_price')
    }
  };
}

export async function collectMarketSnapshot(item) {
  if (!item?.apparelId) return { ok: false, error: 'missing_apparel_id' };
  const conditionPrices = await fetchConditionPrices(item.apparelId);
  await saveMarketSnapshots(item, conditionPrices);
  await saveMarketStorageSnapshot(item, conditionPrices);
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
  const normalizeMarketCode = (value) => String(value || '').trim().toUpperCase().replace(/^OPC-/, '');
  const candidates = (Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => {
      if (apparelId) return String(item.apparelId) === String(apparelId);
      if (!code) return false;
      const itemCode = String(item.code || '').toUpperCase();
      const name = String(item.name || '').toUpperCase();
      return itemCode === code || normalizeMarketCode(itemCode) === code || name.includes(`[${code}]`);
    })
    .sort((a, b) => {
      const jpDelta = (String(b.locale || '').toUpperCase() === 'JP') - (String(a.locale || '').toUpperCase() === 'JP');
      if (jpDelta) return jpDelta;
      const stockDelta = Number(b.listingCount || 0) - Number(a.listingCount || 0);
      if (stockDelta) return stockDelta;
      return Number(b.minPrice || 0) - Number(a.minPrice || 0);
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
