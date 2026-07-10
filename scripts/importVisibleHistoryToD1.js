import fs from 'node:fs';
import { buildFilteredDailyRows } from '../lib/market-outlier-filter.js';

function loadEnvFile(filePath = '.env.local') {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim();
  }
}

loadEnvFile();

const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || 'ed82677cb22fd8679792f6cff73a00d6').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || 'da59fbad-d4bb-4f4a-88cc-37b0a698646a').trim();
const inputPaths = process.argv.slice(2);
const USD_TO_JPY = 155;

if (!D1_API_TOKEN) throw new Error('Missing CLOUDFLARE_API_TOKEN');
if (!inputPaths.length) throw new Error('Usage: node scripts/importVisibleHistoryToD1.js <json...>');

function conditionKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'a') return 'a';
  if (text === 'psa 10' || text === 'psa10') return 'psa10';
  return '';
}

function parseDate(value) {
  const text = String(value || '').replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
  const match = text.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})$/);
  if (match) {
    const month = new Date(`${match[1]} 1, 2000 UTC`).getUTCMonth();
    if (Number.isFinite(month)) {
      return new Date(Date.UTC(Number(match[3]), month, Number(match[2]))).toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(`${text} UTC`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function parseChartDateLabel(value) {
  const text = String(value || '').trim();
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const jpMonthYear = text.match(/^(\d{4})年(\d{1,2})月$/);
  if (jpMonthYear) return Date.UTC(Number(jpMonthYear[1]), Number(jpMonthYear[2]) - 1, 1);
  const jp = text.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jp) return normalizeChartTimestamp(Date.UTC(currentYear, Number(jp[1]) - 1, Number(jp[2])));
  const enMonthYear = text.match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (enMonthYear) {
    const month = new Date(`${enMonthYear[1]} 1, ${enMonthYear[2]} UTC`).getUTCMonth();
    if (Number.isFinite(month)) return Date.UTC(Number(enMonthYear[2]), month, 1);
  }
  const en = text.match(/^([A-Za-z]{3,})\s+(\d{1,2})$/);
  if (en) {
    const month = new Date(`${en[1]} 1, ${currentYear} UTC`).getUTCMonth();
    if (Number.isFinite(month)) return normalizeChartTimestamp(Date.UTC(currentYear, month, Number(en[2])));
  }
  const parsed = Date.parse(`${text} UTC`);
  return Number.isFinite(parsed) ? normalizeChartTimestamp(parsed) : 0;
}

function normalizeChartTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const futureCutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (timestamp > futureCutoff) {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate());
  }
  return timestamp;
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

function addDailyValue(group, amountJpy) {
  if (!amountJpy) return;
  group.values.push(amountJpy);
}

async function queryD1(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${D1_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(`D1 query failed: ${body?.errors?.[0]?.message || response.status}`);
  }
  return body.result?.[0]?.results || [];
}

const now = new Date().toISOString();
const trades = [];
const dailyGroups = new Map();

for (const inputPath of inputPaths) {
  const items = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  for (const item of items) {
    for (const trade of item.history || []) {
      const day = parseDate(trade.date);
      const amountUsd = Number(trade.priceUsd || 0);
      const amountJpy = Math.round(amountUsd * USD_TO_JPY);
      const key = conditionKey(trade.condition);
      if (!day || !amountJpy || !key) continue;

      trades.push({
        source: 'snkrdunk',
        apparel_id: Number(item.apparelId),
        locale: item.locale || 'JP',
        code: item.code || '',
        condition_key: key,
        trade_date: day,
        trade_date_text: trade.date,
        price_amount_jpy: amountJpy,
        price_text: trade.priceText || `US $${amountUsd}`,
        first_seen_at: now,
        last_seen_at: now,
        raw_payload_json: JSON.stringify(trade),
      });

      const groupKey = `snkrdunk|${item.apparelId}|${key}|${day}`;
      const group = dailyGroups.get(groupKey) || {
        source: 'snkrdunk',
        apparel_id: Number(item.apparelId),
        locale: item.locale || 'JP',
        code: item.code || '',
        condition_key: key,
        point_date: day,
        values: [],
      };
      addDailyValue(group, amountJpy);
      dailyGroups.set(groupKey, group);
    }

    for (const chart of Object.values(item.charts || {})) {
      const key = conditionKey(chart.condition);
      if (!['a', 'psa10'].includes(key)) continue;
      const xFit = linearFit((chart.xLabels || [])
        .map((label) => [Number(label.x), parseChartDateLabel(label.text)])
        .filter(([, timestamp]) => timestamp > 0));
      const yFit = linearFit((chart.yLabels || [])
        .map((label) => [Number(label.y), parseChartNumber(label.text)])
        .filter(([, price]) => price >= 0));
      if (!xFit || !yFit) continue;
      const translate = chart.seriesTranslate || { x: 0, y: 0 };
      for (const point of parsePathPoints(chart.path)) {
        const timestamp = Math.round(xFit(point.x + Number(translate.x || 0)));
        const day = new Date(timestamp).toISOString().slice(0, 10);
        const amountJpy = Math.round(yFit(point.y + Number(translate.y || 0)) * USD_TO_JPY);
        const groupKey = `snkrdunk|${item.apparelId}|${key}|${day}`;
        if (dailyGroups.has(groupKey)) continue;
        dailyGroups.set(groupKey, {
          source: 'snkrdunk',
          apparel_id: Number(item.apparelId),
          locale: item.locale || 'JP',
          code: item.code || '',
          condition_key: key,
          point_date: day,
          values: [amountJpy],
        });
      }
    }
  }
}

for (const row of trades) {
  await queryD1(
    `insert or replace into market_recent_trades
      (source, apparel_id, locale, code, condition_key, trade_date, trade_date_text, price_amount_jpy, price_text, first_seen_at, last_seen_at, raw_payload_json)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.source,
      row.apparel_id,
      row.locale,
      row.code,
      row.condition_key,
      row.trade_date,
      row.trade_date_text,
      row.price_amount_jpy,
      row.price_text,
      row.first_seen_at,
      row.last_seen_at,
      row.raw_payload_json,
    ],
  );
}

let dailyCount = 0;
for (const group of buildFilteredDailyRows([...dailyGroups.values()], { now })) {
  await queryD1(
    `insert or replace into market_chart_daily_points
      (source, apparel_id, locale, code, condition_key, point_date, median_price_jpy, min_price_jpy, max_price_jpy, trade_count, source_count, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      group.source,
      group.apparel_id,
      group.locale,
      group.code,
      group.condition_key,
      group.point_date,
      group.median_price_jpy,
      group.min_price_jpy,
      group.max_price_jpy,
      group.trade_count,
      group.source_count,
      now,
    ],
  );
  dailyCount += 1;
}

console.log(JSON.stringify({ trades: trades.length, dailyPoints: dailyCount }, null, 2));
