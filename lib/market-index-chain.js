const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INITIAL_FORMATION_WINDOW_DAYS = 30;
const DEFAULT_MIN_INITIAL_TRADING_DAYS = 3;
const DEFAULT_MIN_INITIAL_TRADE_COUNT = 5;

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

function shiftDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

export function buildInitialPriceFormationSeries(series = [], options = {}) {
  const formationWindowDays = Math.max(
    1,
    Number(options.initialFormationWindowDays || DEFAULT_INITIAL_FORMATION_WINDOW_DAYS)
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
  const formationEndDate = firstObservedDate ? shiftDate(firstObservedDate, formationWindowDays - 1) : '';
  const asOfDate = toDateKey(options.endDate) || observed.at(-1)?.date || '';
  const initialWindow = formationEndDate
    ? observed.filter((point) => point.date <= formationEndDate)
    : [];
  const initialTradeCount = initialWindow.reduce((sum, point) => sum + point.tradeCount, 0);
  const baseResult = {
    firstObservedDate,
    firstObservedPrice: Number(observed[0]?.price || 0),
    baselineDate: '',
    baselinePrice: 0,
    formationWindowDays,
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

  if (asOfDate < formationEndDate) {
    return {
      series: [],
      ...baseResult,
      reason: 'initial-formation-window-open'
    };
  }

  if (initialWindow.length < minimumTradingDays || initialTradeCount < minimumTradeCount) {
    return {
      series: [],
      ...baseResult,
      reason: 'insufficient-initial-formation-data'
    };
  }

  const baselinePrice = medianPrice(initialWindow.map((point) => point.price));
  return {
    series: [
      { date: formationEndDate, price: baselinePrice },
      ...observed.filter((point) => point.date > formationEndDate)
    ],
    ...baseResult,
    baselineDate: formationEndDate,
    baselinePrice,
    reason: ''
  };
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
      const rawSeries = (rowsByApparelId.get(Number(component.apparelId)) || []).sort((a, b) => a.date.localeCompare(b.date));
      return { ...component, rawSeries };
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
    baseline: buildInitialPriceFormationSeries(component.rawSeries, { ...options, endDate })
  }));
  const excludedComponents = baselineComponents
    .filter((component) => !component.baseline.series.length)
    .map((component) => ({
      apparelId: Number(component.apparelId),
      firstObservedDate: component.baseline.firstObservedDate,
      firstObservedPrice: component.baseline.firstObservedPrice,
      observationCount: component.baseline.observationCount,
      tradeCount: component.baseline.tradeCount,
      requiredObservationCount: component.baseline.requiredObservationCount,
      requiredTradeCount: component.baseline.requiredTradeCount,
      formationEndDate: component.baseline.formationEndDate,
      reason: component.baseline.reason
    }));
  const dataComponents = baselineComponents.filter((component) => component.baseline.series.length).map((component) => {
    const series = clampObservedPriceMoves(component.baseline.series, { ...options, endDate });
    const basePrice = Number(series[0]?.price || 0);
    return {
      ...component,
      series,
      firstDate: series[0]?.date || '',
      firstObservedDate: component.baseline.firstObservedDate,
      firstObservedPrice: component.baseline.firstObservedPrice,
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
  let divisor = 0;

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
    if (!divisor) divisor = rawComponentSum / baseValue;
    const valueBeforeAdmission = existingComponents.length ? existingSum / divisor : baseValue;
    if (entrants.length && existingComponents.length) {
      divisor = rawComponentSum / valueBeforeAdmission;
    }

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

    if (!activeComponents.length || !(divisor > 0)) continue;
    const indexValue = rawComponentSum / divisor;
    indexPoints.push({
      date,
      value: Number(indexValue.toFixed(4)),
      activeCount: activeComponents.length,
      componentCount: dataComponents.length,
      rawComponentSum: Number(rawComponentSum.toFixed(4)),
      divisor: Number(divisor.toFixed(8))
    });
    if (entrants.length && date !== baseDate) {
      admissions.push({
        date,
        apparelIds: entrants.map((component) => Number(component.apparelId)),
        valueBeforeAdmission: Number(valueBeforeAdmission.toFixed(4)),
        valueAfterAdmission: Number(indexValue.toFixed(4))
      });
    }
  }

  return { baseDate, endDate, baseValue, dataComponents, excludedComponents, indexPoints, componentPoints, admissions };
}
