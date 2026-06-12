import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'data/d1-market-history-seed');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGE_SIZE = 500;
const USD_TO_JPY = 155;
const nowIso = new Date().toISOString();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertSql(table, columns, rows, batchSize = 25) {
  const statements = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch
      .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
      .join(',\n');
    statements.push(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES\n${values};`);
  }
  return `${statements.join('\n\n')}\n`;
}

function conditionKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'a') return 'a';
  if (text === 'psa10' || text === 'psa 10') return 'psa10';
  return text.replace(/\s+/g, '_') || 'unknown';
}

function toJpy(amount, currency) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return String(currency || '').toUpperCase() === 'JPY' ? Math.round(value) : Math.round(value * USD_TO_JPY);
}

function dayKey(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function fetchAll(table, select, order) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams();
    params.set('select', select);
    if (order) params.set('order', order);
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Range: `${offset}-${offset + PAGE_SIZE - 1}`
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${table} fetch failed: ${response.status} ${text}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function latestSnapshots(rows) {
  const latest = new Map();
  for (const row of rows) {
    const key = `${row.source || 'snkrdunk'}:${row.apparel_id}`;
    const prev = latest.get(key);
    if (!prev || new Date(row.captured_at).getTime() > new Date(prev.captured_at).getTime()) {
      latest.set(key, row);
    }
  }
  return [...latest.values()].map((row) => ({
    source: row.source || 'snkrdunk',
    apparel_id: Number(row.apparel_id),
    locale: row.locale || 'JP',
    code: row.code || '',
    min_price_amount: Number(row.min_price_amount || 0) || null,
    min_price_currency: row.min_price_currency || null,
    min_price_text: row.min_price_text || null,
    listing_count: Number.isFinite(Number(row.listing_count)) ? Number(row.listing_count) : null,
    captured_at: row.captured_at,
    raw_payload_r2_key: null,
    updated_at: nowIso
  }));
}

function dailyChartPoints(rows) {
  const groups = new Map();
  for (const row of rows) {
    const amount = toJpy(row.price_amount, row.price_currency);
    const pointDate = dayKey(row.point_date);
    const key = conditionKey(row.condition_key);
    if (!amount || !pointDate || !key) continue;
    const groupKey = `${row.source || 'snkrdunk'}|${row.apparel_id}|${key}|${pointDate}`;
    const group = groups.get(groupKey) || {
      source: row.source || 'snkrdunk',
      apparel_id: Number(row.apparel_id),
      locale: row.locale || 'JP',
      code: row.code || '',
      condition_key: key,
      point_date: pointDate,
      values: []
    };
    group.values.push(amount);
    groups.set(groupKey, group);
  }
  return [...groups.values()]
    .map((group) => ({
      source: group.source,
      apparel_id: group.apparel_id,
      locale: group.locale,
      code: group.code,
      condition_key: group.condition_key,
      point_date: group.point_date,
      median_price_jpy: median(group.values),
      min_price_jpy: Math.min(...group.values),
      max_price_jpy: Math.max(...group.values),
      trade_count: group.values.length,
      source_count: group.values.length,
      updated_at: nowIso
    }))
    .sort((a, b) => (
      a.source.localeCompare(b.source) ||
      a.apparel_id - b.apparel_id ||
      a.condition_key.localeCompare(b.condition_key) ||
      a.point_date.localeCompare(b.point_date)
    ));
}

function recentTradeRows(rows) {
  return rows
    .map((row) => ({
      source: row.source || 'snkrdunk',
      apparel_id: Number(row.apparel_id),
      locale: row.locale || 'JP',
      code: row.code || '',
      condition_key: conditionKey(row.condition),
      trade_date: row.last_seen_at || row.first_seen_at || null,
      trade_date_text: row.trade_date_text || null,
      price_amount_jpy: toJpy(row.price_amount, row.price_currency),
      price_text: row.price_text || null,
      first_seen_at: row.first_seen_at || null,
      last_seen_at: row.last_seen_at || null,
      raw_payload_json: null
    }))
    .filter((row) => row.apparel_id && row.price_amount_jpy > 0);
}

function collectionRunRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    source: row.source || 'snkrdunk',
    collector_version: row.collector_version || null,
    schedule_interval: row.schedule_interval || null,
    status: row.status || null,
    target_count: Number(row.target_count || 0),
    ok_count: Number(row.ok_count || 0),
    locked_count: Number(row.locked_count || 0),
    with_history_count: Number(row.with_history_count || 0),
    with_chart_count: Number(row.with_chart_count || 0),
    error_count: Number(row.error_count || 0),
    started_at: row.started_at || null,
    finished_at: row.finished_at || null,
    notes: row.notes || null,
    meta_json: row.meta ? JSON.stringify(row.meta) : null,
    raw_payload_r2_prefix: null
  }));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const snapshotRows = await fetchAll(
    'market_price_snapshots',
    'id,source,apparel_id,locale,code,captured_at,min_price_amount,min_price_currency,min_price_text,listing_count',
    'id.asc'
  );
  const chartRows = await fetchAll(
    'market_chart_points',
    'id,source,apparel_id,locale,code,condition_key,point_date,price_amount,price_currency',
    'id.asc'
  );
  const tradeRows = await fetchAll(
    'market_recent_trades',
    'id,source,apparel_id,locale,code,condition,trade_date_text,price_amount,price_currency,price_text,first_seen_at,last_seen_at',
    'id.asc'
  );
  const runRows = await fetchAll(
    'market_collection_runs',
    'id,source,collector_version,schedule_interval,status,target_count,ok_count,locked_count,with_history_count,with_chart_count,error_count,started_at,finished_at,notes,meta',
    'started_at.asc'
  );

  const latestRows = latestSnapshots(snapshotRows);
  const dailyRows = dailyChartPoints(chartRows);
  const recentRows = recentTradeRows(tradeRows);
  const runs = collectionRunRows(runRows);

  await writeFile(path.join(outDir, '101_market_price_latest_snapshots.sql'), insertSql('market_price_latest_snapshots', [
    'source', 'apparel_id', 'locale', 'code', 'min_price_amount', 'min_price_currency',
    'min_price_text', 'listing_count', 'captured_at', 'raw_payload_r2_key', 'updated_at'
  ], latestRows), 'utf8');

  await writeFile(path.join(outDir, '102_market_chart_daily_points.sql'), insertSql('market_chart_daily_points', [
    'source', 'apparel_id', 'locale', 'code', 'condition_key', 'point_date',
    'median_price_jpy', 'min_price_jpy', 'max_price_jpy', 'trade_count', 'source_count', 'updated_at'
  ], dailyRows), 'utf8');

  await writeFile(path.join(outDir, '103_market_recent_trades.sql'), insertSql('market_recent_trades', [
    'source', 'apparel_id', 'locale', 'code', 'condition_key', 'trade_date', 'trade_date_text',
    'price_amount_jpy', 'price_text', 'first_seen_at', 'last_seen_at', 'raw_payload_json'
  ], recentRows), 'utf8');

  await writeFile(path.join(outDir, '104_market_collection_runs.sql'), insertSql('market_collection_runs', [
    'id', 'source', 'collector_version', 'schedule_interval', 'status', 'target_count',
    'ok_count', 'locked_count', 'with_history_count', 'with_chart_count', 'error_count',
    'started_at', 'finished_at', 'notes', 'meta_json', 'raw_payload_r2_prefix'
  ], runs), 'utf8');

  const report = {
    ok: true,
    generatedAt: nowIso,
    sourceRows: {
      market_price_snapshots: snapshotRows.length,
      market_chart_points: chartRows.length,
      market_recent_trades: tradeRows.length,
      market_collection_runs: runRows.length
    },
    d1Rows: {
      market_price_latest_snapshots: latestRows.length,
      market_chart_daily_points: dailyRows.length,
      market_recent_trades: recentRows.length,
      market_collection_runs: runs.length
    }
  };

  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
