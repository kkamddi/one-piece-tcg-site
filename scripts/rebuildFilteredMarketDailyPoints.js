import fs from 'node:fs';
import { buildFilteredDailyRows, toDateKey } from '../lib/market-outlier-filter.js';

function loadEnvFile(filePath = '.env.local') {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
}

loadEnvFile();
loadEnvFile('.env');

const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const CONDITIONS = String(process.env.MARKET_DAILY_CONDITIONS || 'a,psa10')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter((item) => item === 'a' || item === 'psa10');
const SOURCE = String(process.env.MARKET_DAILY_SOURCE || 'snkrdunk').trim();
const PAGE_SIZE = Math.max(100, Math.min(5000, Number(process.env.MARKET_DAILY_REBUILD_PAGE_SIZE || 5000) || 5000));

if (!D1_API_TOKEN) throw new Error('Missing CLOUDFLARE_API_TOKEN');
if (!D1_ACCOUNT_ID) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
if (!D1_DATABASE_ID) throw new Error('Missing D1_DATABASE_ID');
if (!CONDITIONS.length) throw new Error('Missing MARKET_DAILY_CONDITIONS');

async function queryD1(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${D1_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(60000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`D1 query failed: ${body?.errors?.[0]?.message || response.status}`);
  }
  return body.result?.[0]?.results || [];
}

async function insertRows(tableName, columns, rows, chunkSize = 40) {
  if (!rows.length) return 0;
  const safeChunkSize = Math.max(1, Math.min(chunkSize, Math.floor(96 / columns.length)));
  let written = 0;
  for (let start = 0; start < rows.length; start += safeChunkSize) {
    const chunk = rows.slice(start, start + safeChunkSize);
    const valuesSql = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const params = chunk.flatMap((row) => columns.map((column) => row[column]));
    await queryD1(
      `insert or replace into ${tableName} (${columns.join(',')}) values ${valuesSql}`,
      params
    );
    written += chunk.length;
  }
  return written;
}

async function fetchTrades() {
  const rows = [];
  const placeholders = CONDITIONS.map(() => '?').join(',');
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await queryD1(
      `select source, apparel_id, locale, code, condition_key, trade_date, price_amount_jpy
       from market_recent_trades
       where source = ?
         and condition_key in (${placeholders})
         and trade_date is not null
         and price_amount_jpy > 0
       order by source asc, apparel_id asc, condition_key asc, trade_date asc, price_amount_jpy asc
       limit ${PAGE_SIZE} offset ${offset}`,
      [SOURCE, ...CONDITIONS]
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function buildDailyGroups(trades) {
  const groups = new Map();
  for (const trade of trades) {
    const apparelId = Number(trade.apparel_id || 0);
    const conditionKey = String(trade.condition_key || '').trim();
    const date = toDateKey(trade.trade_date);
    const price = Number(trade.price_amount_jpy || 0);
    if (!apparelId || !conditionKey || !date || !Number.isFinite(price) || price <= 0) continue;
    const key = `${trade.source}|${apparelId}|${conditionKey}|${date}`;
    const group = groups.get(key) || {
      source: trade.source || SOURCE,
      apparel_id: apparelId,
      locale: trade.locale || 'JP',
      code: trade.code || '',
      condition_key: conditionKey,
      point_date: date,
      prices: []
    };
    group.prices.push(price);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const trades = await fetchTrades();
const rawGroups = buildDailyGroups(trades);
const filteredRows = buildFilteredDailyRows(rawGroups);

await queryD1(
  `delete from market_chart_daily_points
   where source = ?
     and condition_key in (${CONDITIONS.map(() => '?').join(',')})`,
  [SOURCE, ...CONDITIONS]
);
const written = await insertRows('market_chart_daily_points', [
  'source',
  'apparel_id',
  'locale',
  'code',
  'condition_key',
  'point_date',
  'median_price_jpy',
  'min_price_jpy',
  'max_price_jpy',
  'trade_count',
  'source_count',
  'updated_at'
], filteredRows);

console.log(JSON.stringify({
  source: SOURCE,
  conditions: CONDITIONS,
  trades: trades.length,
  rawDailyPoints: rawGroups.length,
  filteredDailyPoints: filteredRows.length,
  removedDailyPoints: rawGroups.length - filteredRows.length,
  written
}, null, 2));
