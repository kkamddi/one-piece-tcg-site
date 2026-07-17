const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INITIAL_CANDIDATE_TRADING_DAYS = 5;
const DEFAULT_MIN_INITIAL_TRADING_DAYS = 3;
const DEFAULT_MIN_INITIAL_TRADE_COUNT = 3;
const DEFAULT_REGIME_SIMILARITY_MULTIPLIER = 1.6;

function toDateKey(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function dateDiffDays(currentDate, previousDate) {
  const current = Date.parse(`${currentDate}T00:00:00Z`);
  const previous = Date.parse(`${previousDate}T00:00:00Z`);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  return Math.round((current - previous) / DAY_MS);
}

function enumerateDates(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function filterTransientPriceSpikes(series = [], options = {}) {
  const maxRunLength = Math.max(1, Number(options.maxRunLength || 2));
  const returnTolerance = Math.max(0, Number(options.returnTolerance || 0.25));
  const deviationMultiplier = Math.max(1, Number(options.deviationMultiplier || 1.6));
  const filtered = series.map((point) => ({ ...point }));

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (let start = 1; start < filtered.length - 1; start += 1) {
      for (let runLength = maxRunLength; runLength >= 1; runLength -= 1) {
        const end = start + runLength - 1;
        if (end >= filtered.length - 1) continue;
        const leftPrice = filtered[start - 1].price;
        const rightPrice = filtered[end + 1].price;
        const referenceRatio = Math.max(leftPrice, rightPrice) / Math.min(leftPrice, rightPrice);
        if (referenceRatio > 1 + returnTolerance) continue;

        const referencePrice = (leftPrice + rightPrice) / 2;
        const run = filtered.slice(start, end + 1);
        const allHigh = run.every((point) => point.price >= referencePrice * deviationMultiplier);
        const allLow = run.every((point) => point.price <= referencePrice / deviationMultiplier);
        if (!allHigh && !allLow) continue;

        for (let offset = 0; offset < runLength; offset += 1) {
          const progress = (offset + 1) / (runLength + 1);
          filtered[start + offset].price = Math.round(leftPrice + ((rightPrice - leftPrice) * progress));
        }
        changed = true;
        start = end;
        break;
      }
    }
    if (!changed) break;
  }

  return filtered;
}

export function interpolateDailyPriceSeries(series = []) {
  if (series.length < 2) return series.map((point) => ({ ...point }));
  const daily = [{ ...series[0] }];
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1];
    const current = series[index];
    const gapDays = Math.max(1, dateDiffDays(current.date, previous.date));
    for (let step = 1; step <= gapDays; step += 1) {
      const date = new Date(`${previous.date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + step);
      const progress = step / gapDays;
      daily.push({
        date: date.toISOString().slice(0, 10),
        price: Math.round(previous.price * ((current.price / previous.price) ** progress))
      });
    }
  }
  return daily;
}

export function smoothDailyPriceMoves(series = [], options = {}) {
  if (!series.length) return [];
  const maximumDailyMove = Math.max(0.01, Number(options.maximumDailyMove || 0.2));
  const smoothed = [{ ...series[0] }];
  for (let index = 1; index < series.length; index += 1) {
    const target = series[index];
    const previousPrice = smoothed[index - 1].price;
    const minimumPrice = previousPrice * (1 - maximumDailyMove);
    const maximumPrice = previousPrice * (1 + maximumDailyMove);
    smoothed.push({
      ...target,
      price: Math.round(Math.min(maximumPrice, Math.max(minimumPrice, target.price)))
    });
  }
  return smoothed;
}

function medianPrice(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function priceRatio(left, right) {
  const minimum = Math.min(Number(left || 0), Number(right || 0));
  const maximum = Math.max(Number(left || 0), Number(right || 0));
  return minimum > 0 ? maximum / minimum : Number.POSITIVE_INFINITY;
}

export function filterUnsupportedObservedPricePoints(series = [], options = {}) {
  const neighborTradingDays = Math.max(1, Number(options.neighborTradingDays || 3));
  const similarityMultiplier = Math.max(
    1,
    Number(options.regimeSimilarityMultiplier || DEFAULT_REGIME_SIMILARITY_MULTIPLIER)
  );
  const observed = series
    .map((point) => ({
      ...point,
      date: toDateKey(point?.date),
      price: Math.round(Number(point?.price || 0)),
      tradeCount: Math.max(1, Number(point?.tradeCount || point?.trade_count || 0) || 1)
    }))
    .filter((point) => point.date && point.price > 0)
    .sort((left, right) => left.date.localeCompare(right.date));

  return observed.filter((point, index) => {
    const previous = observed.slice(Math.max(0, index - neighborTradingDays), index);
    const following = observed.slice(index + 1, index + 1 + neighborTradingDays);
    const neighbors = [...previous, ...following];
    if (neighbors.length < 2) return true;

    const neighborhoodMedian = medianPrice(neighbors.map((other) => other.price));
    if (priceRatio(point.price, neighborhoodMedian) <= similarityMultiplier) return true;
    if (point.tradeCount >= 2) return true;

    const adjacent = [previous.at(-1), following[0]].filter(Boolean);
    if (adjacent.some((other) => priceRatio(point.price, other.price) <= similarityMultiplier)) return true;
    const similarNeighbors = neighbors.filter((other) => (
      priceRatio(point.price, other.price) <= similarityMultiplier
    ));
    return similarNeighbors.length >= 2;
  });
}

function findInitialPriceBaseline(points = [], options = {}) {
  const requiredTradingDays = Math.max(
    1,
    Number(options.minimumInitialTradingDays || DEFAULT_MIN_INITIAL_TRADING_DAYS)
  );
  const requiredTradeCount = Math.max(
    1,
    Number(options.minimumInitialTradeCount || DEFAULT_MIN_INITIAL_TRADE_COUNT)
  );
  const selected = points.slice(0, requiredTradingDays);
  const tradeCount = selected.reduce((sum, point) => sum + point.tradeCount, 0);
  if (selected.length < requiredTradingDays || tradeCount < requiredTradeCount) return null;
  return {
    points: selected,
    tradeCount,
    confirmationDate: selected.at(-1).date,
    firstDate: selected[0].date
  };
}

export function buildInitialPriceFormationSeries(series = [], options = {}) {
  const candidateTradingDays = Math.max(
    1,
    Number(
      options.initialCandidateTradingDays
      || options.initialFormationWindowDays
      || DEFAULT_INITIAL_CANDIDATE_TRADING_DAYS
    )
  );
  const minimumTradingDays = Math.max(
    1,
    Number(options.minimumInitialTradingDays || DEFAULT_MIN_INITIAL_TRADING_DAYS)
  );
  const minimumTradeCount = Math.max(
    1,
    Number(options.minimumInitialTradeCount || DEFAULT_MIN_INITIAL_TRADE_COUNT)
  );
  const pointsByDate = new Map();
  for (const point of series) {
    const date = toDateKey(point?.date);
    const price = Number(point?.price || 0);
    if (!date || !Number.isFinite(price) || price <= 0) continue;
    const rawTradeCount = Number(point?.tradeCount || point?.trade_count || 0);
    const tradeCount = Number.isFinite(rawTradeCount) ? Math.max(1, rawTradeCount) : 1;
    pointsByDate.set(date, { ...point, date, price: Math.round(price), tradeCount });
  }

  const observed = [...pointsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const firstObservedDate = observed[0]?.date || '';
  const initialWindow = observed.slice(0, candidateTradingDays);
  const formationEndDate = initialWindow.at(-1)?.date || '';
  const initialTradeCount = initialWindow.reduce((sum, point) => sum + point.tradeCount, 0);
  const baseResult = {
    firstObservedDate,
    firstObservedPrice: Number(observed[0]?.price || 0),
    baselineDate: '',
    baselinePrice: 0,
    formationWindowDays: 0,
    candidateTradingDays,
    formationEndDate,
    observationCount: initialWindow.length,
    tradeCount: initialTradeCount,
    requiredObservationCount: minimumTradingDays,
    requiredTradeCount: minimumTradeCount
  };

  if (!observed.length) {
    return {
      series: [],
      ...baseResult,
      reason: 'no-observations'
    };
  }

  if (initialWindow.length < minimumTradingDays || initialTradeCount < minimumTradeCount) {
    return {
      series: [],
      ...baseResult,
      reason: 'insufficient-initial-trading-days'
    };
  }

  const baselineSelection = findInitialPriceBaseline(initialWindow, options);
  if (!baselineSelection) {
    return {
      series: [],
      ...baseResult,
      reason: 'no-initial-price-baseline'
    };
  }

  const baselinePrice = medianPrice(baselineSelection.points.map((point) => point.price));
  const baselineDate = baselineSelection.confirmationDate;
  return {
    series: [
      { date: baselineDate, price: baselinePrice },
      ...observed.filter((point) => point.date > baselineDate)
    ],
    ...baseResult,
    baselineDate,
    baselinePrice,
    supportedObservationCount: baselineSelection.points.length,
    supportedTradeCount: baselineSelection.tradeCount,
    reason: ''
  };
}

export function carryForwardObservedPriceSeries(series = [], options = {}) {
  const pointsByDate = new Map();
  for (const point of series) {
    const date = toDateKey(point?.date);
    const price = Number(point?.price || 0);
    if (!date || !Number.isFinite(price) || price <= 0) continue;
    pointsByDate.set(date, { date, price: Math.round(price) });
  }

  const observed = [...pointsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!observed.length) return [];
  const requestedEndDate = toDateKey(options.endDate);
  const endDate = requestedEndDate && requestedEndDate > observed.at(-1).date
    ? requestedEndDate
    : observed.at(-1).date;
  const dates = enumerateDates(observed[0].date, endDate);
  const observedByDate = new Map(observed.map((point) => [point.date, point.price]));
  let currentPrice = observed[0].price;

  return dates.map((date) => {
    if (observedByDate.has(date)) currentPrice = observedByDate.get(date);
    return { date, price: currentPrice };
  });
}

export function clampObservedPriceMoves(series = [], options = {}) {
  if (!series.length) return [];
  const maximumDailyMove = Math.max(0.01, Number(options.maximumDailyMove || 0.2));
  const pointsByDate = new Map();

  for (const point of series) {
    const date = toDateKey(point?.date);
    const price = Number(point?.price || 0);
    if (!date || !Number.isFinite(price) || price <= 0) continue;
    pointsByDate.set(date, { date, price: Math.round(price) });
  }

  const observed = [...pointsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!observed.length) return [];
  const requestedEndDate = toDateKey(options.endDate);
  const endDate = requestedEndDate && requestedEndDate > observed.at(-1).date
    ? requestedEndDate
    : observed.at(-1).date;
  const observedByDate = new Map(observed.map((point) => [point.date, point.price]));
  const dates = enumerateDates(observed[0].date, endDate);
  const clamped = [];
  let targetPrice = observed[0].price;
  let currentPrice = targetPrice;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    if (observedByDate.has(date)) targetPrice = observedByDate.get(date);
    if (index > 0) {
      const minimumPrice = currentPrice * (1 - maximumDailyMove);
      const maximumPrice = currentPrice * (1 + maximumDailyMove);
      const boundedPrice = Math.min(maximumPrice, Math.max(minimumPrice, targetPrice));
      currentPrice = targetPrice > currentPrice
        ? Math.floor(boundedPrice)
        : Math.ceil(boundedPrice);
    }
    clamped.push({ date, price: currentPrice });
  }

  return clamped;
}

export function buildEqualWeightedMarketIndex(indexConfig, rows = [], options = {}) {
  const baseValue = Number(indexConfig?.baseValue || 100);
  const rowsByApparelId = new Map();

  for (const row of rows) {
    const apparelId = Number(row?.apparel_id || 0);
    const date = toDateKey(row?.point_date);
    const price = Number(row?.median_price_jpy || 0);
    if (!apparelId || !date || !Number.isFinite(price) || price <= 0) continue;
    const series = rowsByApparelId.get(apparelId) || [];
    series.push({
      date,
      price: Math.round(price),
      tradeCount: Math.max(0, Number(row?.trade_count || 0))
    });
    rowsByApparelId.set(apparelId, series);
  }

  const rawComponents = (indexConfig?.components || [])
    .map((component) => {
      const sourceSeries = (rowsByApparelId.get(Number(component.apparelId)) || []).sort((a, b) => a.date.localeCompare(b.date));
      const rawSeries = filterUnsupportedObservedPricePoints(sourceSeries, options);
      return {
        ...component,
        rawSeries,
        sourceSeries,
        ignoredObservationCount: sourceSeries.length - rawSeries.length
      };
    })
    .filter((component) => component.rawSeries.length);

  if (!rawComponents.length) {
    return {
      baseDate: '',
      endDate: '',
      baseValue,
      dataComponents: [],
      excludedComponents: [],
      indexPoints: [],
      componentPoints: [],
      admissions: []
    };
  }

  const latestObservedDate = rawComponents.reduce((latest, component) => {
    const date = component.rawSeries.at(-1)?.date || '';
    return date > latest ? date : latest;
  }, '');
  const requestedEndDate = toDateKey(options.endDate);
  const endDate = requestedEndDate && requestedEndDate > latestObservedDate
    ? requestedEndDate
    : latestObservedDate;
  const baselineComponents = rawComponents.map((component) => ({
    ...component,
    baseline: buildInitialPriceFormationSeries(component.sourceSeries, { ...options, endDate })
  }));
  const excludedComponents = baselineComponents
    .filter((component) => !component.baseline.series.length)
    .map((component) => ({
      apparelId: Number(component.apparelId),
      sourceFirstObservedDate: component.sourceSeries[0]?.date || '',
      sourceFirstObservedPrice: Number(component.sourceSeries[0]?.price || 0),
      sourceObservationCount: component.sourceSeries.length,
      ignoredObservationCount: component.ignoredObservationCount,
      firstObservedDate: component.baseline.firstObservedDate,
      firstObservedPrice: component.baseline.firstObservedPrice,
      observationCount: component.baseline.observationCount,
      tradeCount: component.baseline.tradeCount,
      requiredObservationCount: component.baseline.requiredObservationCount,
      requiredTradeCount: component.baseline.requiredTradeCount,
      formationEndDate: component.baseline.formationEndDate,
      initialTradingDays: component.sourceSeries.slice(0, 5).map((point) => ({
        date: point.date,
        price: point.price,
        tradeCount: point.tradeCount
      })),
      acceptedInitialTradingDays: component.rawSeries.slice(0, 5).map((point) => ({
        date: point.date,
        price: point.price,
        tradeCount: point.tradeCount
      })),
      reason: component.baseline.reason
    }));
  const dataComponents = baselineComponents.filter((component) => component.baseline.series.length).map((component) => {
    const baselineSeries = [
      { date: component.baseline.baselineDate, price: component.baseline.baselinePrice },
      ...component.rawSeries.filter((point) => point.date > component.baseline.baselineDate)
    ];
    const series = carryForwardObservedPriceSeries(baselineSeries, { ...options, endDate });
    const basePrice = Number(series[0]?.price || 0);
    return {
      ...component,
      series,
      firstDate: series[0]?.date || '',
      firstObservedDate: component.baseline.firstObservedDate,
      firstObservedPrice: component.baseline.firstObservedPrice,
      acceptedFirstObservedDate: component.rawSeries[0]?.date || '',
      acceptedFirstObservedPrice: Number(component.rawSeries[0]?.price || 0),
      sourceFirstObservedDate: component.sourceSeries[0]?.date || '',
      sourceFirstObservedPrice: Number(component.sourceSeries[0]?.price || 0),
      ignoredObservationCount: component.ignoredObservationCount,
      baselineObservationCount: component.baseline.observationCount,
      basePrice,
      pointsByDate: new Map(series.map((point) => [point.date, point]))
    };
  });

  if (!dataComponents.length) {
    return {
      baseDate: '',
      endDate: '',
      baseValue,
      dataComponents: [],
      excludedComponents,
      indexPoints: [],
      componentPoints: [],
      admissions: []
    };
  }

  const earliestComponentDate = dataComponents
    .map((component) => component.firstDate)
    .filter(Boolean)
    .sort()[0];
  const baseDate = earliestComponentDate;
  const dates = enumerateDates(baseDate, endDate);
  const indexPoints = [];
  const componentPoints = [];
  const admissions = [];

  for (const date of dates) {
    const existingComponents = dataComponents.filter((component) => component.firstDate < date);
    const entrants = dataComponents.filter((component) => component.firstDate === date);
    const rawValueFor = (component) => {
      const point = component.pointsByDate.get(date);
      return baseValue * (point.price / component.basePrice);
    };
    const existingSum = existingComponents.reduce((sum, component) => sum + rawValueFor(component), 0);
    const entrantSum = entrants.reduce((sum, component) => sum + rawValueFor(component), 0);
    const rawComponentSum = existingSum + entrantSum;

    const activeComponents = [...existingComponents, ...entrants];
    for (const component of activeComponents) {
      const apparelId = Number(component.apparelId);
      const point = component.pointsByDate.get(date);
      const componentIndexValue = baseValue * (point.price / component.basePrice);
      if (!Number.isFinite(componentIndexValue) || componentIndexValue <= 0) continue;
      componentPoints.push({
        apparelId,
        date,
        price: point.price,
        basePrice: Number(component.basePrice.toFixed(4)),
        componentIndexValue: Number(componentIndexValue.toFixed(4))
      });
    }

    if (!activeComponents.length) continue;
    const indexValue = rawComponentSum / activeComponents.length;
    indexPoints.push({
      date,
      value: Number(indexValue.toFixed(4)),
      activeCount: activeComponents.length,
      componentCount: dataComponents.length,
      rawComponentSum: Number(rawComponentSum.toFixed(4))
    });
    if (entrants.length && date !== baseDate) {
      admissions.push({
        date,
        apparelIds: entrants.map((component) => Number(component.apparelId)),
        valueBeforeAdmission: Number((existingComponents.length ? existingSum / existingComponents.length : baseValue).toFixed(4)),
        valueAfterAdmission: Number(indexValue.toFixed(4))
      });
    }
  }

  return { baseDate, endDate, baseValue, dataComponents, excludedComponents, indexPoints, componentPoints, admissions };
}
