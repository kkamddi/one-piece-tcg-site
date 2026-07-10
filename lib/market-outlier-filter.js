const DEFAULT_HIGH_MULTIPLIER = 3;
const DEFAULT_LOW_MULTIPLIER = 0.2;
const DEFAULT_SPREAD_MULTIPLIER = 4;
const DEFAULT_LOW_CLUSTER_MULTIPLIER = 2.5;
const DEFAULT_REFERENCE_WINDOW = 10;

export function medianNumber(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function toDateKey(value) {
  const text = String(value || '').replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (!text) return '';
  const parsed = Date.parse(`${text} UTC`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
}

export function filterDailyTradePrices(values = [], options = {}) {
  const prices = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return [];

  const referencePrice = Number(options.referencePrice || 0);
  const highMultiplier = Number(options.highMultiplier || DEFAULT_HIGH_MULTIPLIER);
  const lowMultiplier = Number(options.lowMultiplier || DEFAULT_LOW_MULTIPLIER);
  const spreadMultiplier = Number(options.spreadMultiplier || DEFAULT_SPREAD_MULTIPLIER);
  const lowClusterMultiplier = Number(options.lowClusterMultiplier || DEFAULT_LOW_CLUSTER_MULTIPLIER);

  if (referencePrice > 0) {
    const highLimit = referencePrice * highMultiplier;
    const lowLimit = referencePrice * lowMultiplier;
    const referenced = prices.filter((price) => price <= highLimit && price >= lowLimit);
    if (referenced.length) return referenced;
    return [];
  }

  if (prices.length >= 2) {
    const min = prices[0];
    const max = prices[prices.length - 1];
    if (min > 0 && max / min >= spreadMultiplier) {
      const lowCluster = prices.filter((price) => price <= min * lowClusterMultiplier);
      if (lowCluster.length) return lowCluster;
    }
  }

  return prices;
}

function groupKey(row = {}) {
  return [
    row.source || 'snkrdunk',
    Number(row.apparel_id || row.apparelId || 0),
    row.condition_key || row.condition || ''
  ].join('|');
}

function dayKey(row = {}) {
  return toDateKey(row.point_date || row.trade_date || row.day);
}

function pricesOf(row = {}) {
  return row.prices || row.values || [];
}

export function buildFilteredDailyRows(groups = [], options = {}) {
  const now = options.now || new Date().toISOString();
  const referenceWindow = Number(options.referenceWindow || DEFAULT_REFERENCE_WINDOW);
  const grouped = new Map();
  for (const group of groups || []) {
    const apparelId = Number(group.apparel_id || group.apparelId || 0);
    const conditionKey = String(group.condition_key || group.condition || '').trim();
    const date = dayKey(group);
    if (!apparelId || !conditionKey || !date) continue;
    const key = groupKey(group);
    const rows = grouped.get(key) || [];
    rows.push({
      source: group.source || 'snkrdunk',
      apparel_id: apparelId,
      locale: group.locale || 'JP',
      code: group.code || '',
      condition_key: conditionKey,
      point_date: date,
      prices: pricesOf(group)
    });
    grouped.set(key, rows);
  }

  const dailyRows = [];
  for (const rows of grouped.values()) {
    const sortedRows = rows.sort((a, b) => a.point_date.localeCompare(b.point_date));
    const acceptedMedians = [];
    for (const row of sortedRows) {
      const rawPrices = row.prices
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      if (!rawPrices.length) continue;

      const referencePrice = medianNumber(acceptedMedians.slice(-referenceWindow));
      const filteredPrices = filterDailyTradePrices(rawPrices, { referencePrice });
      if (!filteredPrices.length) continue;

      const median = medianNumber(filteredPrices);
      acceptedMedians.push(median);
      dailyRows.push({
        source: row.source,
        apparel_id: row.apparel_id,
        locale: row.locale,
        code: row.code,
        condition_key: row.condition_key,
        point_date: row.point_date,
        median_price_jpy: median,
        min_price_jpy: Math.min(...filteredPrices),
        max_price_jpy: Math.max(...filteredPrices),
        trade_count: filteredPrices.length,
        source_count: rawPrices.length,
        updated_at: now
      });
    }
  }

  return dailyRows.sort((a, b) => (
    a.source.localeCompare(b.source)
    || a.apparel_id - b.apparel_id
    || a.condition_key.localeCompare(b.condition_key)
    || a.point_date.localeCompare(b.point_date)
  ));
}
