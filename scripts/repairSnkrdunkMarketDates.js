import fs from 'node:fs';
import { buildFilteredDailyRows } from '../lib/market-outlier-filter.js';
import { marketTradeDateKey } from '../lib/market-trade-date.js';

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
const SOURCE = 'snkrdunk';
const CONDITIONS = ['a', 'psa10'];
const PAGE_SIZE = 5000;
const INSERT_CHUNK_SIZE = 250;
const DRY_RUN = !['0', 'false', 'no', 'off'].includes(
  String(process.env.MARKET_DATE_REPAIR_DRY_RUN ?? '1').trim().toLowerCase()
);
const REPAIR_TAG = String(process.env.MARKET_DATE_REPAIR_TAG || 'kst_20260717_v1')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, '_');

if (!D1_API_TOKEN) throw new Error('Missing CLOUDFLARE_API_TOKEN');
if (!D1_ACCOUNT_ID) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
if (!D1_DATABASE_ID) throw new Error('Missing D1_DATABASE_ID');
if (!REPAIR_TAG) throw new Error('Missing MARKET_DATE_REPAIR_TAG');

const RAW_BACKUP_TABLE = `market_trade_date_backup_${REPAIR_TAG}`;
const DAILY_BACKUP_TABLE = `market_daily_points_backup_${REPAIR_TAG}`;
const STAGE_TABLE = `market_daily_points_stage_${REPAIR_TAG}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callD1(sql, params = [], attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${D1_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql, params }),
          signal: AbortSignal.timeout(60000)
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.errors?.[0]?.message || `D1 HTTP ${response.status}`);
      }
      return body.result?.[0] || { results: [], meta: {} };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1000);
    }
  }
  throw lastError || new Error('D1 query failed');
}

async function queryD1(sql, params = []) {
  return (await callD1(sql, params)).results || [];
}

async function tableExists(tableName) {
  const rows = await queryD1(
    `select name from sqlite_master where type = 'table' and name = ? limit 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function fetchTrades() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await queryD1(
      `select id, source, apparel_id, locale, code, condition_key,
              trade_date, trade_date_text, price_amount_jpy
       from market_recent_trades
       where source = ?
         and condition_key in ('a', 'psa10')
         and trade_date_text is not null
         and price_amount_jpy > 0
       order by id asc
       limit ${PAGE_SIZE} offset ${offset}`,
      [SOURCE]
    );
    rows.push(...page);
    console.log(JSON.stringify({ event: 'read', offset, rows: rows.length }));
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function buildDailyGroups(trades) {
  const groups = new Map();
  for (const trade of trades) {
    const expectedDate = marketTradeDateKey(trade.trade_date_text);
    const apparelId = Number(trade.apparel_id || 0);
    const conditionKey = String(trade.condition_key || '').trim();
    const price = Number(trade.price_amount_jpy || 0);
    if (!expectedDate || !apparelId || !CONDITIONS.includes(conditionKey) || price <= 0) continue;
    const key = `${SOURCE}|${apparelId}|${conditionKey}|${expectedDate}`;
    const group = groups.get(key) || {
      source: SOURCE,
      apparel_id: apparelId,
      locale: trade.locale || 'JP',
      code: trade.code || '',
      condition_key: conditionKey,
      point_date: expectedDate,
      prices: []
    };
    group.prices.push(price);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric SQL value');
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function insertLiteralRows(tableName, columns, rows, eventName) {
  let written = 0;
  for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + INSERT_CHUNK_SIZE);
    const values = chunk.map((row) => (
      `(${columns.map((column) => sqlLiteral(row[column])).join(',')})`
    )).join(',');
    await callD1(
      `insert into ${tableName} (${columns.join(',')}) values ${values}`
    );
    written += chunk.length;
    console.log(JSON.stringify({ event: eventName, written, total: rows.length }));
  }
  return written;
}

async function insertStageRows(rows) {
  return insertLiteralRows(STAGE_TABLE, [
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
  ], rows, 'stage');
}

async function restoreBackups() {
  if (await tableExists(RAW_BACKUP_TABLE)) {
    await callD1(`
      update market_recent_trades
      set trade_date = (
        select backup.old_trade_date
        from ${RAW_BACKUP_TABLE} backup
        where backup.id = market_recent_trades.id
      )
      where id in (select id from ${RAW_BACKUP_TABLE})
    `);
  }
  if (await tableExists(DAILY_BACKUP_TABLE)) {
    await callD1(`
      delete from market_chart_daily_points
      where source = '${SOURCE}' and condition_key in ('a', 'psa10')
    `);
    await callD1(`
      insert into market_chart_daily_points (
        source, apparel_id, locale, code, condition_key, point_date,
        median_price_jpy, min_price_jpy, max_price_jpy,
        trade_count, source_count, updated_at
      )
      select source, apparel_id, locale, code, condition_key, point_date,
             median_price_jpy, min_price_jpy, max_price_jpy,
             trade_count, source_count, updated_at
      from ${DAILY_BACKUP_TABLE}
    `);
  }
}

const trades = await fetchTrades();
const mismatches = trades.filter((trade) => {
  const expectedDate = marketTradeDateKey(trade.trade_date_text);
  return expectedDate && expectedDate !== trade.trade_date;
});
const mismatchByCondition = Object.fromEntries(CONDITIONS.map((condition) => [
  condition,
  mismatches.filter((trade) => trade.condition_key === condition).length
]));
const affectedCards = new Set(mismatches.map((trade) => Number(trade.apparel_id))).size;
const dailyGroups = buildDailyGroups(trades);
const filteredRows = buildFilteredDailyRows(dailyGroups);

console.log(JSON.stringify({
  event: 'audit',
  dryRun: DRY_RUN,
  source: SOURCE,
  trades: trades.length,
  mismatches: mismatches.length,
  mismatchByCondition,
  affectedCards,
  rawDailyPoints: dailyGroups.length,
  filteredDailyPoints: filteredRows.length
}));

if (DRY_RUN || !mismatches.length) process.exit(0);

for (const tableName of [RAW_BACKUP_TABLE, DAILY_BACKUP_TABLE, STAGE_TABLE]) {
  if (await tableExists(tableName)) throw new Error(`Repair table already exists: ${tableName}`);
}

let repairStarted = false;
try {
  await callD1(`
    create table ${RAW_BACKUP_TABLE} (
      id integer primary key,
      old_trade_date text,
      new_trade_date text not null
    )
  `);
  const rawBackupRows = mismatches.map((trade) => ({
    id: Number(trade.id),
    old_trade_date: trade.trade_date,
    new_trade_date: marketTradeDateKey(trade.trade_date_text)
  }));
  const rawBackupWritten = await insertLiteralRows(
    RAW_BACKUP_TABLE,
    ['id', 'old_trade_date', 'new_trade_date'],
    rawBackupRows,
    'raw-backup'
  );
  if (rawBackupWritten !== mismatches.length) {
    throw new Error(`Raw backup row mismatch: ${rawBackupWritten}/${mismatches.length}`);
  }
  await callD1(`
    create table ${DAILY_BACKUP_TABLE} as
    select * from market_chart_daily_points
    where source = '${SOURCE}' and condition_key in ('a', 'psa10')
  `);
  await callD1(`
    create table ${STAGE_TABLE} (
      source text not null,
      apparel_id integer not null,
      locale text not null,
      code text not null,
      condition_key text not null,
      point_date text not null,
      median_price_jpy integer not null,
      min_price_jpy integer not null,
      max_price_jpy integer not null,
      trade_count integer not null,
      source_count integer not null,
      updated_at text
    )
  `);
  const written = await insertStageRows(filteredRows);
  const stageCount = Number((await queryD1(`select count(*) as count from ${STAGE_TABLE}`))[0]?.count || 0);
  if (written !== filteredRows.length || stageCount !== filteredRows.length) {
    throw new Error(`Stage row mismatch: written=${written}, stored=${stageCount}, expected=${filteredRows.length}`);
  }

  repairStarted = true;
  await callD1(`
    update market_recent_trades
    set trade_date = (
      select backup.new_trade_date
      from ${RAW_BACKUP_TABLE} backup
      where backup.id = market_recent_trades.id
    )
    where id in (select id from ${RAW_BACKUP_TABLE})
  `);
  const remainingMismatches = Number((await queryD1(`
    select count(*) as count
    from market_recent_trades trades
    join ${RAW_BACKUP_TABLE} backup on backup.id = trades.id
    where trades.trade_date <> backup.new_trade_date
  `))[0]?.count || 0);
  if (remainingMismatches !== 0) throw new Error(`Raw date audit failed: ${remainingMismatches}`);

  await callD1(`
    delete from market_chart_daily_points
    where source = '${SOURCE}' and condition_key in ('a', 'psa10')
  `);
  await callD1(`
    insert into market_chart_daily_points (
      source, apparel_id, locale, code, condition_key, point_date,
      median_price_jpy, min_price_jpy, max_price_jpy,
      trade_count, source_count, updated_at
    )
    select source, apparel_id, locale, code, condition_key, point_date,
           median_price_jpy, min_price_jpy, max_price_jpy,
           trade_count, source_count, updated_at
    from ${STAGE_TABLE}
  `);
  const dailyCount = Number((await queryD1(`
    select count(*) as count from market_chart_daily_points
    where source = '${SOURCE}' and condition_key in ('a', 'psa10')
  `))[0]?.count || 0);
  if (dailyCount !== stageCount) {
    throw new Error(`Daily row audit failed: stored=${dailyCount}, expected=${stageCount}`);
  }

  await callD1(`drop table ${STAGE_TABLE}`);
  console.log(JSON.stringify({
    event: 'done',
    repairedRows: mismatches.length,
    mismatchByCondition,
    affectedCards,
    dailyPointsWritten: dailyCount,
    remainingMismatches,
    rawBackupTable: RAW_BACKUP_TABLE,
    dailyBackupTable: DAILY_BACKUP_TABLE
  }));
} catch (error) {
  if (repairStarted) {
    console.error(JSON.stringify({ event: 'rollback', reason: error?.message || String(error) }));
    await restoreBackups();
  }
  throw error;
}
