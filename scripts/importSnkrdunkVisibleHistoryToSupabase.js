import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const inputPath = process.argv[2] || path.join('tmp', 'snkrdunk-visible-history-iab.json');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const upsertChunkSize = Math.max(1, Number(process.env.MARKET_UPSERT_CHUNK_SIZE || 400));

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function uniqueBy(items, makeKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = makeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseMoneyText(text) {
  const source = String(text || '');
  const amount = source.match(/[\d,]+(?:\.\d+)?/)?.[0]?.replace(/,/g, '');
  if (!amount) return { amount: null, currency: null };
  const currency = /US\s*\$/i.test(source) ? 'USD' : null;
  return { amount: Number(amount), currency };
}

function normalizePrice(item) {
  if (Number.isFinite(Number(item.priceUsd))) return { amount: Number(item.priceUsd), currency: 'USD' };
  return parseMoneyText(item.priceText);
}

function normalizeMinPrice(item) {
  if (Number.isFinite(Number(item.minPrice)) && Number(item.minPrice) > 0) {
    return { amount: Number(item.minPrice), currency: 'USD' };
  }
  return parseMoneyText(item.minPriceFormat);
}

function chartConditionKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'all') return 'all';
  if (text === 'a') return 'a';
  if (text === 'psa 10' || text === 'psa10') return 'psa10';
  return '';
}

function parseMonthLabel(value) {
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
    const month = Date.parse(`${en[1]} 1, ${en[2]} UTC`);
    return Number.isFinite(month) ? month : 0;
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

function parsePathPoints(pathText) {
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

function chartToPoints(item, chart) {
  const conditionKey = chartConditionKey(chart?.condition || chart?.label);
  const pathText = chart?.path || chart?.graphD || '';
  if (!conditionKey || !pathText) return [];
  const translate = chart.seriesTranslate || parseTranslate(chart.graphTransform);
  const xLabels = normalizeChartLabels(chart.xLabels, chart.svg, 'highcharts-xaxis-labels');
  const yLabels = normalizeChartLabels(chart.yLabels, chart.svg, 'highcharts-yaxis-labels');
  const xFit = linearFit(xLabels
    .map((label) => [Number(label.x), parseMonthLabel(label.text)])
    .filter(([, timestamp]) => timestamp > 0));
  const yFit = linearFit(yLabels
    .map((label) => [Number(label.y), parseChartNumber(label.text)])
    .filter(([, price]) => price >= 0));
  if (!xFit || !yFit) return [];
  return parsePathPoints(pathText)
    .map((point) => {
      const actualX = point.x + Number(translate.x || 0);
      const actualY = point.y + Number(translate.y || 0);
      const timestamp = Math.round(xFit(actualX));
      const priceUsd = yFit(actualY);
      const futureCutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
      if (
        !Number.isFinite(timestamp)
        || !Number.isFinite(priceUsd)
        || timestamp <= 0
        || timestamp > futureCutoff
        || priceUsd <= 0
      ) return null;
      return {
        run_id: runId,
        source: 'snkrdunk',
        apparel_id: Number(item.apparelId),
        locale: item.locale || 'JP',
        code: item.code,
        condition_key: conditionKey,
        point_date: new Date(timestamp).toISOString(),
        price_amount: Math.round(priceUsd * 155),
        price_currency: 'JPY',
        raw_x: point.x,
        raw_y: point.y,
        raw_payload: {
          priceUsd,
          condition: chart.condition,
          xLabels: chart.xLabels,
          yLabels: chart.yLabels,
          seriesTranslate: translate
        }
      };
    })
    .filter(Boolean);
}

async function upsertRows(table, rows, options = {}) {
  for (const batch of chunk(rows, upsertChunkSize)) {
    const { error } = await supabase.from(table).upsert(batch, options);
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const now = new Date().toISOString();
const runId = process.env.MARKET_RUN_ID || randomUUID();

const summary = {
  target_count: raw.length,
  ok_count: raw.filter((item) => item.ok).length,
  locked_count: raw.filter((item) => item.locked).length,
  with_history_count: raw.filter((item) => item.history?.length).length,
  with_chart_count: raw.filter((item) => item.chart).length,
  error_count: raw.filter((item) => item.error).length
};

const { error: runInsertError } = await supabase.from('market_collection_runs').insert({
  id: runId,
  source: 'snkrdunk',
  collector_version: 'visible-history-iab-v1',
  schedule_interval: '12h',
  status: 'running',
  started_at: now,
  ...summary,
  meta: { inputPath }
});
if (runInsertError) throw new Error(`market_collection_runs insert failed: ${runInsertError.message}`);

const products = raw.map((item) => {
  const minPrice = normalizeMinPrice(item);
  const capturedAt = item.scrapedAt || now;
  return {
    source: 'snkrdunk',
    apparel_id: Number(item.apparelId),
    locale: item.locale || 'JP',
    code: item.code,
    name: item.name || null,
    set_name: item.setName || null,
    source_url: item.sourceUrl || null,
    preview_image_url: item.previewImageUrl || null,
    latest_page_title: item.pageTitleLine || item.pageTitle || null,
    latest_min_price_amount: minPrice.amount,
    latest_min_price_currency: minPrice.currency,
    latest_listing_count: Number.isFinite(Number(item.listingCount)) ? Number(item.listingCount) : null,
    latest_captured_at: capturedAt,
    is_active: true,
    raw_market_card: item,
    updated_at: now
  };
});

const snapshots = raw.map((item) => {
  const minPrice = normalizeMinPrice(item);
  return {
    run_id: runId,
    source: 'snkrdunk',
    apparel_id: Number(item.apparelId),
    locale: item.locale || 'JP',
    code: item.code,
    captured_at: item.scrapedAt || now,
    ok: Boolean(item.ok),
    locked: Boolean(item.locked),
    has_history: Boolean(item.history?.length),
    has_chart: Boolean(item.chart),
    page_title: item.pageTitleLine || item.pageTitle || null,
    min_price_amount: minPrice.amount,
    min_price_currency: minPrice.currency,
    min_price_text: item.minPriceFormat || null,
    listing_count: Number.isFinite(Number(item.listingCount)) ? Number(item.listingCount) : null,
    elapsed_ms: Number.isFinite(Number(item.elapsedMs)) ? Number(item.elapsedMs) : null,
    raw_payload: item
  };
});

const trades = uniqueBy(raw.flatMap((item) =>
  (item.history || []).map((historyItem) => {
    const price = normalizePrice(historyItem);
    return {
      source: 'snkrdunk',
      apparel_id: Number(item.apparelId),
      locale: item.locale || 'JP',
      code: item.code,
      condition: historyItem.condition || null,
      trade_date_text: historyItem.date || '',
      price_amount: price.amount,
      price_currency: price.currency,
      price_text: historyItem.priceText || null,
      first_seen_run_id: runId,
      last_seen_run_id: runId,
      last_seen_at: now,
      raw_payload: historyItem
    };
  }).filter((row) => row.trade_date_text)
), (row) => [
  row.source,
  row.apparel_id,
  row.trade_date_text,
  row.condition || '',
  row.price_amount ?? '',
  row.price_currency || ''
].join('|'));

const charts = raw
  .filter((item) => item.chart)
  .map((item) => ({
    run_id: runId,
    source: 'snkrdunk',
    apparel_id: Number(item.apparelId),
    locale: item.locale || 'JP',
    code: item.code,
    captured_at: item.scrapedAt || now,
    chart_type: item.chart?.type || null,
    svg_path: item.chart?.path || null,
    x_labels: item.chart?.xLabels || [],
    y_labels: item.chart?.yLabels || [],
    raw_chart: item.chart || {}
  }));

const chartPoints = uniqueBy(raw.flatMap((item) => {
  const conditionCharts = item.charts && typeof item.charts === 'object'
    ? Object.values(item.charts)
    : (item.chart ? [item.chart] : []);
  return conditionCharts.flatMap((chart) => chartToPoints(item, chart));
}), (row) => [
  row.source,
  row.apparel_id,
  row.condition_key,
  row.point_date,
  row.price_amount
].join('|'));

await upsertRows('market_products', products, { onConflict: 'source,apparel_id' });
await upsertRows('market_price_snapshots', snapshots, { onConflict: 'run_id,source,apparel_id' });
await upsertRows('market_recent_trades', trades, {
  onConflict: 'source,apparel_id,trade_date_text,condition,price_amount,price_currency'
});
await upsertRows('market_chart_snapshots', charts, { onConflict: 'run_id,source,apparel_id' });
let chartPointsInserted = chartPoints.length;
try {
  await upsertRows('market_chart_points', chartPoints, {
    onConflict: 'source,apparel_id,condition_key,point_date,price_amount'
  });
} catch (error) {
  if (!String(error?.message || '').includes("market_chart_points")) throw error;
  chartPointsInserted = 0;
  console.warn('market_chart_points table is unavailable; chart data remains stored in market_price_snapshots.raw_payload.charts.');
}

const { error: runUpdateError } = await supabase
  .from('market_collection_runs')
  .update({ status: 'completed', finished_at: new Date().toISOString(), ...summary })
  .eq('id', runId);
if (runUpdateError) throw new Error(`market_collection_runs update failed: ${runUpdateError.message}`);

console.log(JSON.stringify({ runId, products: products.length, snapshots: snapshots.length, trades: trades.length, charts: charts.length, chartPoints: chartPointsInserted, chartPointsParsed: chartPoints.length }, null, 2));
