import marketIndexes from '../src/data/market-index-components.js';

const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const D1_BINDING_NAME = String(process.env.MARKET_D1_BINDING || 'OPTCG_PUBLIC_D1').trim();
const CACHE_SECONDS = 60 * 60;
const INDEX_TYPE_ALIASES = {
  waifu: 'premium_art',
  premium: 'premium_art',
  premiumart: 'premium_art',
  'premium-art': 'premium_art'
};

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
  if (!response.ok || !body?.success) throw new Error('d1_index_query_failed');
  return body.result?.[0]?.results || [];
}

function normalizeCondition(value) {
  return String(value || 'a').toLowerCase() === 'psa10' ? 'psa10' : 'a';
}

function toDateKey(value) {
  return String(value || '').slice(0, 10);
}

function percentChange(current, previous) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (!a || !b) return null;
  return ((a / b) - 1) * 100;
}

function medianNumber(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function smoothIndexPoints(points = [], windowSize = 3) {
  return (points || []).map((point, index) => {
    const window = points.slice(Math.max(0, index - windowSize + 1), index + 1);
    const smoothedValue = medianNumber(window.map((item) => item.value));
    return {
      ...point,
      rawValue: point.value,
      value: smoothedValue ? Number(smoothedValue.toFixed(2)) : point.value
    };
  });
}

function componentIndexValue(price, basePrice, baseValue) {
  const current = Number(price || 0);
  const base = Number(basePrice || 0);
  if (!current || !base) return null;
  return Number(((current / base) * baseValue).toFixed(2));
}

function dateDiffDays(currentDate, previousDate) {
  const current = Date.parse(`${toDateKey(currentDate)}T00:00:00Z`);
  const previous = Date.parse(`${toDateKey(previousDate)}T00:00:00Z`);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.round((current - previous) / (24 * 60 * 60 * 1000));
}

function consecutiveDailyChange(currentPoint, previousPoint) {
  if (!currentPoint || !previousPoint) return null;
  if (dateDiffDays(currentPoint.date || currentPoint.point_date, previousPoint.date || previousPoint.point_date) !== 1) return null;
  return percentChange(currentPoint.price || currentPoint.median_price_jpy, previousPoint.price || previousPoint.median_price_jpy);
}

function closestPointAtOrBefore(points, dateKey) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= dateKey) return points[index];
  }
  return null;
}

function applyRange(points, range) {
  if (!points.length || range === 'all') return points;
  const days = range === '1y' ? 365 : range === '6m' ? 183 : range === '3m' ? 92 : range === '1m' ? 31 : range === '7d' ? 7 : range === '1d' ? 1 : 0;
  if (!days) return points;
  const lastDate = new Date(`${points[points.length - 1].date}T00:00:00Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() - days);
  const cutoff = lastDate.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoff);
}

async function fetchLatestComponentDailyRows(apparelIds, conditionKey) {
  const rows = [];
  const chunkSize = 80;
  for (let start = 0; start < apparelIds.length; start += chunkSize) {
    const chunk = apparelIds.slice(start, start + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const chunkRows = await queryD1(
      `select apparel_id, point_date, median_price_jpy
       from (
         select apparel_id, point_date, median_price_jpy,
                row_number() over (partition by apparel_id order by point_date desc) as rn
         from market_chart_daily_points
         where source = 'snkrdunk'
           and condition_key = ?
           and apparel_id in (${placeholders})
           and median_price_jpy > 0
       )
       where rn <= 2`,
      [conditionKey, ...chunk]
    );
    rows.push(...chunkRows);
  }
  return rows;
}

async function fetchDailyPointRows(apparelIds, conditionKey, baseDate) {
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
      [conditionKey, ...chunk, baseDate]
    );
    rows.push(...chunkRows);
  }
  return rows;
}

function buildIndexPayload(indexConfig, rows, conditionKey, range) {
  const rowsByApparelId = new Map();
  for (const row of rows || []) {
    const apparelId = Number(row.apparel_id || 0);
    const price = Number(row.median_price_jpy || 0);
    const date = toDateKey(row.point_date);
    if (!apparelId || !price || !date) continue;
    const list = rowsByApparelId.get(apparelId) || [];
    list.push({ date, price: Math.round(price) });
    rowsByApparelId.set(apparelId, list);
  }

  const components = indexConfig.components.map((component) => {
    const series = (rowsByApparelId.get(Number(component.apparelId)) || []).sort((a, b) => a.date.localeCompare(b.date));
    const basePoint = series.find((point) => point.date >= indexConfig.baseDate) || series[0] || null;
    const latestPoint = series[series.length - 1] || null;
    return {
      ...component,
      baseDate: basePoint?.date || null,
      basePrice: basePoint?.price || 0,
      latestDate: latestPoint?.date || null,
      latestPrice: latestPoint?.price || 0,
      hasData: Boolean(basePoint && latestPoint),
      series
    };
  });

  const dateSet = new Set();
  for (const component of components) {
    for (const point of component.series) {
      if (point.date >= (component.baseDate || indexConfig.baseDate)) dateSet.add(point.date);
    }
  }
  const dates = [...dateSet].sort();
  const cursorById = new Map();
  const latestById = new Map();
  const points = [];

  for (const date of dates) {
    let total = 0;
    let activeCount = 0;
    for (const component of components) {
      if (!component.hasData || date < component.baseDate) continue;
      const series = component.series;
      let cursor = cursorById.get(component.apparelId) || 0;
      while (cursor < series.length && series[cursor].date <= date) {
        latestById.set(component.apparelId, series[cursor].price);
        cursor += 1;
      }
      cursorById.set(component.apparelId, cursor);
      const latestPrice = latestById.get(component.apparelId);
      if (!latestPrice || !component.basePrice) continue;
      total += (latestPrice / component.basePrice) * indexConfig.baseValue;
      activeCount += 1;
    }
    if (activeCount) {
      points.push({
        date,
        value: Number((total / activeCount).toFixed(2)),
        activeCount
      });
    }
  }

  const displayPoints = smoothIndexPoints(points);
  const scopedPoints = applyRange(displayPoints, range);
  const current = displayPoints[displayPoints.length - 1] || null;
  const previous = displayPoints[displayPoints.length - 2] || null;
  const currentDate = current?.date ? new Date(`${current.date}T00:00:00Z`) : null;
  const dateAgo = (days) => {
    if (!currentDate) return '';
    const date = new Date(currentDate);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const point7d = closestPointAtOrBefore(displayPoints, dateAgo(7));
  const point30d = closestPointAtOrBefore(displayPoints, dateAgo(30));
  const point183d = closestPointAtOrBefore(displayPoints, dateAgo(183));
  const pointAll = displayPoints[0] || null;

  return {
    index: {
      code: indexConfig.code,
      name: indexConfig.name,
      baseDate: indexConfig.baseDate,
      baseValue: indexConfig.baseValue,
      condition: conditionKey
    },
    currentValue: current?.value || null,
    currentDate: current?.date || null,
    change: {
      d1: percentChange(current?.value, previous?.value),
      d7: percentChange(current?.value, point7d?.value),
      m1: percentChange(current?.value, point30d?.value),
      m6: percentChange(current?.value, point183d?.value),
      all: percentChange(current?.value, pointAll?.value)
    },
    componentCount: indexConfig.components.length,
    activeComponentCount: current?.activeCount || 0,
    points: scopedPoints,
    components: components.map(({ series, ...component }) => {
      const previousPoint = series.slice().reverse().find((point) => point.date < component.latestDate) || null;
      const currentIndex = componentIndexValue(component.latestPrice, component.basePrice, indexConfig.baseValue);
      const previousIndex = componentIndexValue(previousPoint?.price, component.basePrice, indexConfig.baseValue);
      return {
        ...component,
        previousDate: previousPoint?.date || null,
        previousPrice: previousPoint?.price || 0,
        previousIndex,
        currentIndex,
        change: {
          d1: consecutiveDailyChange({ date: component.latestDate, price: component.latestPrice }, previousPoint)
        }
      };
    })
  };
}

function buildStoredIndexPayload(indexConfig, pointRows, componentRows, actualDailyRows, conditionKey, range) {
  const points = (pointRows || [])
    .map((row) => ({
      date: toDateKey(row.point_date),
      value: Number(Number(row.index_value || 0).toFixed(2)),
      activeCount: Number(row.active_component_count || 0)
    }))
    .filter((point) => point.date && point.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) return null;

  const displayPoints = smoothIndexPoints(points);
  const scopedPoints = applyRange(displayPoints, range);
  const current = displayPoints[displayPoints.length - 1] || null;
  const previous = displayPoints[displayPoints.length - 2] || null;
  const currentDate = current?.date ? new Date(`${current.date}T00:00:00Z`) : null;
  const dateAgo = (days) => {
    if (!currentDate) return '';
    const date = new Date(currentDate);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const point7d = closestPointAtOrBefore(displayPoints, dateAgo(7));
  const point30d = closestPointAtOrBefore(displayPoints, dateAgo(30));
  const point183d = closestPointAtOrBefore(displayPoints, dateAgo(183));
  const pointAll = displayPoints[0] || null;
  const componentRowsById = new Map();
  for (const row of componentRows || []) {
    const apparelId = Number(row.apparel_id || 0);
    if (!apparelId) continue;
    const rows = componentRowsById.get(apparelId) || [];
    rows.push(row);
    componentRowsById.set(apparelId, rows);
  }
  const componentIndexById = new Map();
  for (const [apparelId, rows] of componentRowsById.entries()) {
    const sortedRows = rows.slice().sort((a, b) => toDateKey(b.point_date).localeCompare(toDateKey(a.point_date)));
    const latest = sortedRows[0] || null;
    const previous = sortedRows.find((row) => toDateKey(row.point_date) < toDateKey(latest?.point_date)) || null;
    const currentIndex = latest ? Number(Number(latest.component_index_value || 0).toFixed(2)) : null;
    const previousIndex = previous ? Number(Number(previous.component_index_value || 0).toFixed(2)) : null;
    componentIndexById.set(apparelId, {
      latestDate: toDateKey(latest?.point_date),
      latestPrice: Number(latest?.price_jpy || 0),
      basePrice: Number(latest?.base_price_jpy || 0),
      previousDate: toDateKey(previous?.point_date),
      previousPrice: Number(previous?.price_jpy || 0),
      previousIndex,
      currentIndex,
      change: {
        d1: percentChange(currentIndex, previousIndex)
      },
      hasData: true
    });
  }
  const actualRowsById = new Map();
  for (const row of actualDailyRows || []) {
    const apparelId = Number(row.apparel_id || 0);
    if (!apparelId) continue;
    const rows = actualRowsById.get(apparelId) || [];
    rows.push(row);
    actualRowsById.set(apparelId, rows);
  }

  return {
    index: {
      code: indexConfig.code,
      name: indexConfig.name,
      baseDate: indexConfig.baseDate,
      baseValue: indexConfig.baseValue,
      condition: conditionKey
    },
    currentValue: current?.value || null,
    currentDate: current?.date || null,
    change: {
      d1: percentChange(current?.value, previous?.value),
      d7: percentChange(current?.value, point7d?.value),
      m1: percentChange(current?.value, point30d?.value),
      m6: percentChange(current?.value, point183d?.value),
      all: percentChange(current?.value, pointAll?.value)
    },
    componentCount: indexConfig.components.length,
    activeComponentCount: current?.activeCount || 0,
    points: scopedPoints,
    components: indexConfig.components.map((component) => ({
      ...component,
      ...(componentIndexById.get(Number(component.apparelId)) || { hasData: false, currentIndex: null }),
      change: {
        d1: consecutiveDailyChange(...((actualRowsById.get(Number(component.apparelId)) || [])
          .slice()
          .sort((a, b) => toDateKey(b.point_date).localeCompare(toDateKey(a.point_date)))
          .slice(0, 2)))
      }
    }))
  };
}

export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const query = request.query || Object.fromEntries(new URL(request.url, 'https://local.invalid').searchParams.entries());
  const requestedType = String(query.type || 'manga').toLowerCase();
  const type = INDEX_TYPE_ALIASES[requestedType] || requestedType;
  const range = String(query.range || 'all').toLowerCase();
  const conditionKey = normalizeCondition(query.condition);
  const indexConfig = marketIndexes.find((item) => item.code === type) || marketIndexes[0];
  const apparelIds = indexConfig.components.map((item) => Number(item.apparelId)).filter(Boolean);

  try {
    const storedRows = await queryD1(
      `select point_date, index_value, active_component_count, component_count
       from market_index_daily_points
       where index_code = ? and condition_key = ?
       order by point_date asc`,
      [indexConfig.code, conditionKey]
    ).catch(() => []);
    if (storedRows.length) {
      const componentRows = await queryD1(
        `select apparel_id, point_date, price_jpy, base_price_jpy, component_index_value
         from (
           select c.apparel_id, c.point_date, c.price_jpy, c.base_price_jpy, c.component_index_value,
                  row_number() over (partition by c.apparel_id order by c.point_date desc) as rn
           from market_index_component_daily_points c
           where c.index_code = ? and c.condition_key = ?
         )
         where rn <= 2`,
        [indexConfig.code, conditionKey]
      ).catch(() => []);
      const actualDailyRows = await fetchLatestComponentDailyRows(apparelIds, conditionKey).catch(() => []);
      const payload = buildStoredIndexPayload(indexConfig, storedRows, componentRows, actualDailyRows, conditionKey, range);
      if (payload) {
        response.setHeader?.('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
        return response.status(200).json(payload);
      }
    }

    const rows = await fetchDailyPointRows(apparelIds, conditionKey, indexConfig.baseDate);
    const payload = buildIndexPayload(indexConfig, rows, conditionKey, range);
    response.setHeader?.('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
    return response.status(200).json(payload);
  } catch (error) {
    return response.status(200).json({
      index: { code: indexConfig.code, name: indexConfig.name, baseDate: indexConfig.baseDate, baseValue: indexConfig.baseValue, condition: conditionKey },
      error: 'index_data_unavailable',
      currentValue: null,
      currentDate: null,
      change: { d1: null, d7: null, m1: null, m6: null, all: null },
      componentCount: indexConfig.components.length,
      activeComponentCount: 0,
      points: [],
      components: indexConfig.components
    });
  }
}
