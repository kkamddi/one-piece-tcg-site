import marketIndexes from '../src/data/market-index-components.js';
import { buildChainLinkedMarketIndex } from '../lib/market-index-chain.js';

const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const CONDITION_KEY = String(process.env.MARKET_INDEX_CONDITION || 'a').trim().toLowerCase() === 'psa10' ? 'psa10' : 'a';
const REBUILD_WINDOW_DAYS = Math.max(0, Number(process.env.MARKET_INDEX_REBUILD_WINDOW_DAYS ?? 0) || 0);
const COMPONENT_HISTORY_DAYS = 31;
const DRY_RUN = String(process.env.MARKET_INDEX_DRY_RUN || '').trim() === '1';
const INDEX_CODE_FILTER = new Set(
  String(process.env.MARKET_INDEX_CODES || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

function requiredEnv() {
  const missing = [];
  if (!D1_API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN');
  if (!D1_ACCOUNT_ID) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!D1_DATABASE_ID) missing.push('D1_DATABASE_ID');
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);
}

async function queryD1(sql, params = []) {
  const signal = AbortSignal.timeout(60000);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${D1_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params }),
    signal
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`D1 query failed: ${body?.errors?.[0]?.message || response.status}`);
  }
  return body.result?.[0]?.results || [];
}

async function insertRows(tableName, columns, rows, chunkSize = 40) {
  if (!rows.length) return;
  const safeChunkSize = Math.max(1, Math.min(chunkSize, Math.floor(96 / columns.length)));
  for (let start = 0; start < rows.length; start += safeChunkSize) {
    const chunk = rows.slice(start, start + safeChunkSize);
    const valuesSql = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const params = chunk.flatMap((row) => columns.map((column) => row[column]));
    await queryD1(
      `insert or replace into ${tableName} (${columns.join(',')}) values ${valuesSql}`,
      params
    );
  }
}

async function fetchDailyPointRows(apparelIds, baseDate) {
  const rows = [];
  const chunkSize = 80;
  for (let start = 0; start < apparelIds.length; start += chunkSize) {
    const chunk = apparelIds.slice(start, start + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const chunkRows = await queryD1(
      `select apparel_id, point_date, median_price_jpy
       from market_chart_daily_points
       where source = 'snkrdunk'
         and condition_key = ?
         and apparel_id in (${placeholders})
         and point_date >= ?
       order by apparel_id asc, point_date asc`,
      [CONDITION_KEY, ...chunk, baseDate]
    );
    rows.push(...chunkRows);
  }
  return rows;
}

function getRebuildStartDate() {
  if (!REBUILD_WINDOW_DAYS) return null;
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() - REBUILD_WINDOW_DAYS);
  return kstNow.toISOString().slice(0, 10);
}

function shiftDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildIndexRows(indexConfig, rows) {
  const built = buildChainLinkedMarketIndex(indexConfig, rows, {
    minimumBaseCoverage: CONDITION_KEY === 'psa10' ? indexConfig.psa10MinimumBaseCoverage : 0
  });
  const componentStartDate = shiftDate(built.endDate, -(COMPONENT_HISTORY_DAYS - 1));
  return {
    dataComponents: built.dataComponents,
    effectiveBaseDate: built.baseDate,
    indexRows: built.indexPoints.map((point) => ({
      index_code: indexConfig.code,
      condition_key: CONDITION_KEY,
      point_date: point.date,
      index_value: point.value,
      active_component_count: point.activeCount,
      component_count: point.componentCount,
      source: 'snkrdunk'
    })),
    componentRows: built.componentPoints.filter((point) => point.date >= componentStartDate).map((point) => ({
      index_code: indexConfig.code,
      condition_key: CONDITION_KEY,
      apparel_id: point.apparelId,
      point_date: point.date,
      price_jpy: point.price,
      base_price_jpy: point.basePrice,
      component_index_value: point.componentIndexValue,
      source: 'snkrdunk'
    }))
  };
}

async function rebuildIndex(indexConfig) {
  const apparelIds = indexConfig.components.map((item) => Number(item.apparelId)).filter(Boolean);
  const rows = await fetchDailyPointRows(apparelIds, indexConfig.baseDate);
  const rebuildStartDate = getRebuildStartDate();

  const builtRows = buildIndexRows(indexConfig, rows);
  const dataComponents = builtRows.dataComponents || [];

  if (DRY_RUN) {
    const last = builtRows.indexRows.at(-1) || null;
    let maxDailyChange = 0;
    for (let index = 1; index < builtRows.indexRows.length; index += 1) {
      const previous = Number(builtRows.indexRows[index - 1].index_value || 0);
      const current = Number(builtRows.indexRows[index].index_value || 0);
      if (previous > 0 && current > 0) maxDailyChange = Math.max(maxDailyChange, Math.abs((current / previous) - 1) * 100);
    }
    console.log(`${indexConfig.code}: base ${builtRows.effectiveBaseDate}, current ${last?.index_value || 0}, max daily ${maxDailyChange.toFixed(2)}%, components ${dataComponents.length}`);
    return;
  }

  await queryD1(
    `insert or replace into market_indexes (code, name, base_date, base_value, description, updated_at)
     values (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [indexConfig.code, indexConfig.name, builtRows.effectiveBaseDate || indexConfig.baseDate, indexConfig.baseValue, `${indexConfig.name} from SNKRDUNK chain-linked daily median prices`]
  );
  await queryD1('delete from market_index_components where index_code = ?', [indexConfig.code]);
  await insertRows('market_index_components', [
    'index_code',
    'apparel_id',
    'card_id',
    'locale',
    'code',
    'set_code',
    'card_name',
    'card_name_ko',
    'rarity',
    'note',
    'weight',
    'active'
  ], indexConfig.components.map((component) => ({
    index_code: indexConfig.code,
    apparel_id: Number(component.apparelId),
    card_id: component.cardId || '',
    locale: 'JP',
    code: component.code,
    set_code: component.set,
    card_name: component.name,
    card_name_ko: component.nameKo || '',
    rarity: component.rarity || '',
    note: component.note || '',
    weight: 1,
    active: 1
  })));

  const indexRows = rebuildStartDate
    ? builtRows.indexRows.filter((row) => row.point_date >= rebuildStartDate)
    : builtRows.indexRows;
  const componentRows = rebuildStartDate
    ? builtRows.componentRows.filter((row) => row.point_date >= rebuildStartDate)
    : builtRows.componentRows;
  if (rebuildStartDate) {
    await queryD1('delete from market_index_daily_points where index_code = ? and condition_key = ? and point_date >= ?', [indexConfig.code, CONDITION_KEY, rebuildStartDate]);
    await queryD1('delete from market_index_component_daily_points where index_code = ? and condition_key = ? and point_date >= ?', [indexConfig.code, CONDITION_KEY, rebuildStartDate]);
  } else {
    await queryD1('delete from market_index_daily_points where index_code = ? and condition_key = ?', [indexConfig.code, CONDITION_KEY]);
    await queryD1('delete from market_index_component_daily_points where index_code = ? and condition_key = ?', [indexConfig.code, CONDITION_KEY]);
  }
  const componentHistoryStartDate = shiftDate(builtRows.indexRows.at(-1)?.point_date || indexConfig.baseDate, -(COMPONENT_HISTORY_DAYS - 1));
  await queryD1('delete from market_index_component_daily_points where index_code = ? and condition_key = ? and point_date < ?', [indexConfig.code, CONDITION_KEY, componentHistoryStartDate]);
  await insertRows('market_index_daily_points', [
    'index_code',
    'condition_key',
    'point_date',
    'index_value',
    'active_component_count',
    'component_count',
    'source'
  ], indexRows);
  await insertRows('market_index_component_daily_points', [
    'index_code',
    'condition_key',
    'apparel_id',
    'point_date',
    'price_jpy',
    'base_price_jpy',
    'component_index_value',
    'source'
  ], componentRows);
  console.log(`${indexConfig.code}: ${indexRows.length} index points, ${componentRows.length} component points${rebuildStartDate ? ` since ${rebuildStartDate}` : ' full rebuild'}`);
}

requiredEnv();
for (const indexConfig of marketIndexes.filter((item) => !INDEX_CODE_FILTER.size || INDEX_CODE_FILTER.has(item.code))) {
  await rebuildIndex(indexConfig);
}
