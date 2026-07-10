const DAY_MS = 24 * 60 * 60 * 1000;

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

export function buildChainLinkedMarketIndex(indexConfig, rows = [], options = {}) {
  const configuredBaseDate = toDateKey(indexConfig?.baseDate);
  const baseValue = Number(indexConfig?.baseValue || 100);
  const rowsByApparelId = new Map();

  for (const row of rows) {
    const apparelId = Number(row?.apparel_id || 0);
    const date = toDateKey(row?.point_date);
    const price = Number(row?.median_price_jpy || 0);
    if (!apparelId || !date || date < configuredBaseDate || !Number.isFinite(price) || price <= 0) continue;
    const series = rowsByApparelId.get(apparelId) || [];
    series.push({ date, price: Math.round(price) });
    rowsByApparelId.set(apparelId, series);
  }

  const dataComponents = (indexConfig?.components || [])
    .map((component) => {
      const rawSeries = (rowsByApparelId.get(Number(component.apparelId)) || []).sort((a, b) => a.date.localeCompare(b.date));
      const series = smoothDailyPriceMoves(interpolateDailyPriceSeries(filterTransientPriceSpikes(rawSeries)));
      return {
        ...component,
        series,
        pointsByDate: new Map(series.map((point) => [point.date, point]))
      };
    })
    .filter((component) => component.series.length);

  if (!dataComponents.length) {
    return {
      baseDate: configuredBaseDate,
      endDate: configuredBaseDate,
      dataComponents,
      indexPoints: [],
      componentPoints: []
    };
  }

  const componentStartDates = dataComponents
    .map((component) => component.series[0]?.date || '')
    .filter(Boolean)
    .sort();
  const minimumBaseCoverage = Math.min(1, Math.max(0, Number(options.minimumBaseCoverage || 0)));
  const minimumBaseComponents = Math.max(1, Math.ceil(dataComponents.length * minimumBaseCoverage));
  const baseDate = componentStartDates[minimumBaseComponents - 1] || componentStartDates[0] || configuredBaseDate;

  const latestDataDate = dataComponents.reduce((latest, component) => {
    const date = component.series.at(-1)?.date || '';
    return date > latest ? date : latest;
  }, baseDate);
  const requestedEndDate = toDateKey(options.endDate);
  const endDate = requestedEndDate && requestedEndDate > latestDataDate ? requestedEndDate : latestDataDate;
  const dates = enumerateDates(baseDate, endDate);
  const states = new Map();
  const indexPoints = [];
  const componentPoints = [];
  let indexValue = baseValue;

  for (const date of dates) {
    let totalReturn = 0;
    let activeAtOpen = 0;
    const admissions = [];

    for (const component of dataComponents) {
      const apparelId = Number(component.apparelId);
      const point = component.pointsByDate.get(date) || null;
      const state = states.get(apparelId) || null;

      if (state?.active) {
        activeAtOpen += 1;
        if (point) {
          const priceRatio = point.price / state.lastPrice;
          if (Number.isFinite(priceRatio) && priceRatio > 0) {
            const componentReturn = priceRatio - 1;
            totalReturn += componentReturn;
            state.componentIndexValue *= priceRatio;
            state.lastPrice = point.price;
            state.lastTradeDate = date;
          }
        }
      } else if (point) {
        admissions.push({ component, point, state });
      }
    }

    if (activeAtOpen > 0) {
      indexValue *= 1 + (totalReturn / activeAtOpen);
    }

    for (const admission of admissions) {
      const apparelId = Number(admission.component.apparelId);
      if (admission.state) {
        admission.state.active = true;
        admission.state.lastPrice = admission.point.price;
        admission.state.lastTradeDate = date;
        admission.state.divisorPrice = (admission.point.price * baseValue) / admission.state.componentIndexValue;
      } else {
        states.set(apparelId, {
          active: true,
          firstDate: date,
          lastPrice: admission.point.price,
          lastTradeDate: date,
          divisorPrice: admission.point.price,
          componentIndexValue: baseValue
        });
      }
    }

    const activeCount = [...states.values()].filter((state) => state.active).length;
    indexPoints.push({
      date,
      value: Number(indexValue.toFixed(4)),
      activeCount,
      componentCount: dataComponents.length
    });

    for (const component of dataComponents) {
      const state = states.get(Number(component.apparelId));
      if (!state) continue;
      componentPoints.push({
        apparelId: Number(component.apparelId),
        date,
        price: state.lastPrice,
        basePrice: Number(state.divisorPrice.toFixed(4)),
        componentIndexValue: Number(state.componentIndexValue.toFixed(4))
      });
    }
  }

  return { baseDate, endDate, dataComponents, indexPoints, componentPoints };
}
