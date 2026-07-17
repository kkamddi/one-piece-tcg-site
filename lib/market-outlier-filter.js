const DEFAULT_HIGH_MULTIPLIER = 3;
const DEFAULT_LOW_MULTIPLIER = 0.2;
const DEFAULT_REFERENCE_WINDOW = 10;
const DEFAULT_REGIME_SIMILARITY_MULTIPLIER = 1.6;
const DEFAULT_REGIME_MIN_SAME_DAY_TRADES = 2;
const DEFAULT_NEIGHBOR_TRADING_DAYS = 3;

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

  if (referencePrice > 0) {
    const highLimit = referencePrice * highMultiplier;
    const lowLimit = referencePrice * lowMultiplier;
    const referenced = prices.filter((price) => price <= highLimit && price >= lowLimit);
    if (referenced.length) return referenced;
    return [];
  }

  // Without a prior reference, the same-day median is safer than assuming the
  // lowest cluster is a single-card sale. Neighboring trading days validate it later.
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

function priceRatio(left, right) {
  const minimum = Math.min(Number(left || 0), Number(right || 0));
  const maximum = Math.max(Number(left || 0), Number(right || 0));
  return minimum > 0 ? maximum / minimum : Number.POSITIVE_INFINITY;
}

function localRegimeEvidence(candidates, index, options = {}) {
  const candidate = candidates[index];
  const neighborTradingDays = Math.max(
    1,
    Number(options.neighborTradingDays || DEFAULT_NEIGHBOR_TRADING_DAYS)
  );
  const similarityMultiplier = Number(
    options.regimeSimilarityMultiplier || DEFAULT_REGIME_SIMILARITY_MULTIPLIER
  );
  const minimumSameDayTrades = Number(
    options.regimeMinimumSameDayTrades || DEFAULT_REGIME_MIN_SAME_DAY_TRADES
  );
  const minimum = Math.min(...candidate.rawPrices);
  const maximum = Math.max(...candidate.rawPrices);
  const sameDaySupported = (
    candidate.rawPrices.length >= minimumSameDayTrades
    && minimum > 0
    && maximum / minimum <= similarityMultiplier
  );
  const previous = candidates.slice(Math.max(0, index - neighborTradingDays), index);
  const following = candidates.slice(index + 1, index + 1 + neighborTradingDays);
  const neighbors = [...previous, ...following];
  const similarNeighbors = neighbors.filter((other) => (
    priceRatio(candidate.rawMedian, other.rawMedian) <= similarityMultiplier
  ));
  const previousAdjacent = previous.at(-1);
  const followingAdjacent = following[0];
  const adjacentSupported = [previousAdjacent, followingAdjacent].some((other) => (
    other && priceRatio(candidate.rawMedian, other.rawMedian) <= similarityMultiplier
  ));
  const neighborhoodMedian = medianNumber(neighbors.map((other) => other.rawMedian));
  const differsFromNeighborhood = neighborhoodMedian > 0
    && priceRatio(candidate.rawMedian, neighborhoodMedian) > similarityMultiplier;
  const supported = sameDaySupported || adjacentSupported || similarNeighbors.length >= 2;

  return {
    supported,
    isolated: neighbors.length >= 2 && differsFromNeighborhood && !supported
  };
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
    const candidates = sortedRows.map((row) => {
      const rawPrices = row.prices
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      return {
        ...row,
        rawPrices,
        rawMedian: medianNumber(rawPrices)
      };
    }).filter((row) => row.rawPrices.length);
    const acceptedMedians = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const row = candidates[index];
      const rawPrices = row.rawPrices;
      const regimeEvidence = localRegimeEvidence(candidates, index, options);
      if (regimeEvidence.isolated) continue;
      const referencePrice = medianNumber(acceptedMedians.slice(-referenceWindow));
      let filteredPrices = filterDailyTradePrices(rawPrices, { referencePrice });
      if (!filteredPrices.length && referencePrice > 0 && regimeEvidence.supported) {
        filteredPrices = rawPrices;
      }
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

export function auditFilteredDailyCoverage(rawRows = [], filteredRows = [], options = {}) {
  const minimumRawDays = Math.max(1, Number(options.minimumRawDays || 5));
  const minimumAcceptedDays = Math.max(1, Number(options.minimumAcceptedDays || 3));
  const minimumRawTrades = Math.max(1, Number(options.minimumRawTrades || 50));
  const minimumDayRetention = Math.max(0, Number(options.minimumDayRetention || 0.2));
  const minimumTradeRetention = Math.max(0, Number(options.minimumTradeRetention || 0.01));
  const conditionKeys = new Set([
    ...rawRows.map((row) => String(row?.condition_key || '')),
    ...filteredRows.map((row) => String(row?.condition_key || ''))
  ].filter(Boolean));
  const conditions = [];

  for (const conditionKey of conditionKeys) {
    const raw = rawRows.filter((row) => row.condition_key === conditionKey);
    const filtered = filteredRows.filter((row) => row.condition_key === conditionKey);
    const rawDays = new Set(raw.map((row) => row.point_date).filter(Boolean)).size;
    const acceptedDays = new Set(filtered.map((row) => row.point_date).filter(Boolean)).size;
    const rawTrades = raw.reduce((sum, row) => sum + Number(row.source_count || row.trade_count || 0), 0);
    const acceptedTrades = filtered.reduce((sum, row) => sum + Number(row.trade_count || 0), 0);
    const dayRetention = rawDays > 0 ? acceptedDays / rawDays : 1;
    const tradeRetention = rawTrades > 0 ? acceptedTrades / rawTrades : 1;
    const reasons = [];

    if (rawDays >= minimumRawDays && acceptedDays < minimumAcceptedDays) {
      reasons.push('too-few-accepted-days');
    }
    if (rawDays >= minimumRawDays * 2 && dayRetention < minimumDayRetention) {
      reasons.push('low-day-retention');
    }
    if (rawTrades >= minimumRawTrades && tradeRetention < minimumTradeRetention) {
      reasons.push('low-trade-retention');
    }
    conditions.push({
      conditionKey,
      rawDays,
      acceptedDays,
      rawTrades,
      acceptedTrades,
      dayRetention: Number(dayRetention.toFixed(4)),
      tradeRetention: Number(tradeRetention.toFixed(4)),
      valid: reasons.length === 0,
      reasons
    });
  }

  return {
    valid: conditions.every((item) => item.valid),
    conditions
  };
}
