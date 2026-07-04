import marketIndexes from '../src/data/market-index-components.js';

const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const CONDITION_KEY = String(process.env.MARKET_INDEX_CONDITION || 'a').trim().toLowerCase() === 'psa10' ? 'psa10' : 'a';

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
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
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

function buildIndexRows(indexConfig, rows) {
  const rowsByApparelId = new Map();
  for (const row of rows || []) {
    const apparelId = Number(row.apparel_id || 0);
    const price = Number(row.median_price_jpy || 0);
    const date = String(row.point_date || '').slice(0, 10);
    if (!apparelId || !price || !date) continue;
    const list = rowsByApparelId.get(apparelId) || [];
    list.push({ date, price: Math.round(price) });
    rowsByApparelId.set(apparelId, list);
  }

  const components = indexConfig.components.map((component) => {
    const series = (rowsByApparelId.get(Number(component.apparelId)) || []).sort((a, b) => a.date.localeCompare(b.date));
    const basePoint = series.find((point) => point.date >= indexConfig.baseDate) || series[0] || null;
    return {
      ...component,
      baseDate: basePoint?.date || null,
      basePrice: basePoint?.price || 0,
      series
    };
  });

  const dateSet = new Set();
  for (const component of components) {
    for (const point of component.series) {
      if (component.baseDate && point.date >= component.baseDate) dateSet.add(point.date);
    }
  }

  const dates = [...dateSet].sort();
  const cursorById = new Map();
  const latestById = new Map();
  const indexRows = [];
  const componentRows = [];

  for (const date of dates) {
    let totalWeighted = 0;
    let totalWeight = 0;
    let activeCount = 0;
    for (const component of components) {
      if (!component.baseDate || !component.basePrice || date < component.baseDate) continue;
      let cursor = cursorById.get(component.apparelId) || 0;
      while (cursor < component.series.length && component.series[cursor].date <= date) {
        latestById.set(component.apparelId, component.series[cursor].price);
        cursor += 1;
      }
      cursorById.set(component.apparelId, cursor);
      const price = latestById.get(component.apparelId);
      if (!price) continue;
      const weight = Number(component.weight || 1);
      const componentIndexValue = Number(((price / component.basePrice) * indexConfig.baseValue).toFixed(4));
      componentRows.push({
        index_code: indexConfig.code,
        condition_key: CONDITION_KEY,
        apparel_id: Number(component.apparelId),
        point_date: date,
        price_jpy: price,
        base_price_jpy: component.basePrice,
        component_index_value: componentIndexValue,
        source: 'snkrdunk'
      });
      totalWeighted += componentIndexValue * weight;
      totalWeight += weight;
      activeCount += 1;
    }
    if (activeCount && totalWeight > 0) {
      indexRows.push({
        index_code: indexConfig.code,
        condition_key: CONDITION_KEY,
        point_date: date,
        index_value: Number((totalWeighted / totalWeight).toFixed(4)),
        active_component_count: activeCount,
        component_count: indexConfig.components.length,
        source: 'snkrdunk'
      });
    }
  }
  return { indexRows, componentRows };
}

async function rebuildIndex(indexConfig) {
  const apparelIds = indexConfig.components.map((item) => Number(item.apparelId)).filter(Boolean);
  const rows = await fetchDailyPointRows(apparelIds, indexConfig.baseDate);

  await queryD1(
    `insert or replace into market_indexes (code, name, base_date, base_value, description, updated_at)
     values (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [indexConfig.code, indexConfig.name, indexConfig.baseDate, indexConfig.baseValue, `${indexConfig.name} from SNKRDUNK daily median prices`]
  );

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

  const { indexRows, componentRows } = buildIndexRows(indexConfig, rows);
  await queryD1('delete from market_index_daily_points where index_code = ? and condition_key = ?', [indexConfig.code, CONDITION_KEY]);
  await queryD1('delete from market_index_component_daily_points where index_code = ? and condition_key = ?', [indexConfig.code, CONDITION_KEY]);
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
  console.log(`${indexConfig.code}: ${indexRows.length} index points, ${componentRows.length} component points`);
}

requiredEnv();
for (const indexConfig of marketIndexes) {
  await rebuildIndex(indexConfig);
}
