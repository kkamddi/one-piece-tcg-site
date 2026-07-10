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

export function buildChainLinkedMarketIndex(indexConfig, rows = [], options = {}) {
  const baseDate = toDateKey(indexConfig?.baseDate);
  const baseValue = Number(indexConfig?.baseValue || 100);
  const staleDays = Math.max(1, Number(options.staleDays || 30));
  const minimumCoverageRatio = Math.max(0, Math.min(1, Number(options.minimumCoverageRatio ?? 0.2)));
  const maximumLinkedReturn = Math.max(0, Number(options.maximumLinkedReturn ?? 0.3));
  const rowsByApparelId = new Map();

  for (const row of rows) {
    const apparelId = Number(row?.apparel_id || 0);
    const date = toDateKey(row?.point_date);
    const price = Number(row?.median_price_jpy || 0);
    if (!apparelId || !date || date < baseDate || !Number.isFinite(price) || price <= 0) continue;
    const series = rowsByApparelId.get(apparelId) || [];
    series.push({ date, price: Math.round(price) });
    rowsByApparelId.set(apparelId, series);
  }

  const dataComponents = (indexConfig?.components || [])
    .map((component) => {
      const series = (rowsByApparelId.get(Number(component.apparelId)) || []).sort((a, b) => a.date.localeCompare(b.date));
      return {
        ...component,
        series,
        pointsByDate: new Map(series.map((point) => [point.date, point]))
      };
    })
    .filter((component) => component.series.length);

  const latestDataDate = dataComponents.reduce((latest, component) => {
    const date = component.series.at(-1)?.date || '';
    return date > latest ? date : latest;
  }, baseDate);
  const requestedEndDate = toDateKey(options.endDate);
  const endDate = requestedEndDate && requestedEndDate > latestDataDate ? requestedEndDate : latestDataDate;
  const dates = enumerateDates(baseDate, endDate);
  const minimumActiveCount = Math.max(3, Math.ceil(dataComponents.length * minimumCoverageRatio));
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

      if (state?.active && dateDiffDays(date, state.lastTradeDate) > staleDays) {
        state.active = false;
      }

      if (state?.active) {
        activeAtOpen += 1;
        if (point) {
          const priceRatio = point.price / state.lastPrice;
          if (Number.isFinite(priceRatio) && priceRatio > 0) {
            const componentReturn = priceRatio - 1;
            if (Math.abs(componentReturn) <= maximumLinkedReturn) {
              totalReturn += componentReturn;
              state.componentIndexValue *= priceRatio;
            } else {
              state.divisorPrice = (point.price * baseValue) / state.componentIndexValue;
            }
            state.lastPrice = point.price;
            state.lastTradeDate = date;
          }
        }
      } else if (point) {
        admissions.push({ component, point, state });
      }
    }

    if (activeAtOpen >= minimumActiveCount) {
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
