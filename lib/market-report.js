// Weekly SNKRDUNK market report: week math, the D1 queries, aggregation, the home summary and a text view.
// Shared by scripts/generateWeeklyMarketReport.mjs, scripts/marketReportSeo.js and the React report page.

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TRADES = 2;
const MIN_PRICE_JPY = 1000;
export const MARKET_REPORT_PATH = '/market-report';
export const MARKET_REPORT_KRW_PER_JPY = 9.4;
export const MARKET_REPORT_JPY_PER_USD = 155;

const shiftDate = (dateKey, days) => new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export function kstDateKey(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// The last completed Monday-Sunday week in KST, plus the week before it.
export function getReportWeek(todayKey = kstDateKey()) {
  const day = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const weekEnd = shiftDate(todayKey, -(day === 0 ? 7 : day));
  return { weekStart: shiftDate(weekEnd, -6), weekEnd, prevStart: shiftDate(weekEnd, -13), prevEnd: shiftDate(weekEnd, -7) };
}

// Two statements: weekly aggregates per product, then daily totals for the trend chart.
export function weeklyReportSql({ weekStart, weekEnd, prevStart }) {
  for (const value of [weekStart, weekEnd, prevStart]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`invalid date ${value}`);
  }
  const scope = `from market_chart_daily_points
where source = 'snkrdunk' and condition_key in ('a', 'psa10') and trade_count > 0
  and point_date between '${prevStart}' and '${weekEnd}'`;
  return `select apparel_id, condition_key,
  sum(case when point_date >= '${weekStart}' then trade_count else 0 end) as trades,
  sum(case when point_date >= '${weekStart}' then median_price_jpy * trade_count else 0 end) as price_weight,
  sum(case when point_date < '${weekStart}' then trade_count else 0 end) as prev_trades,
  sum(case when point_date < '${weekStart}' then median_price_jpy * trade_count else 0 end) as prev_price_weight
${scope}
group by apparel_id, condition_key;
select point_date, condition_key, sum(trade_count) as trades
${scope}
group by point_date, condition_key;`;
}

const round = (value) => Math.round(value);
const pct = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

function boxPriceJpy(point) {
  const amount = Number(point?.minPrice);
  if (!(amount > 0)) return null;
  if (point.priceCurrency === 'JPY') return round(amount);
  if (point.priceCurrency === 'USD') return round(amount * MARKET_REPORT_JPY_PER_USD);
  return null;
}

// rows: weekly aggregates; dailyRows: per-day totals. products: Map apparelId -> { code, label, set, imageUrl, cardId, locale }.
export function buildWeeklyMarketReport({ week, rows, dailyRows = [], products, boxes = [], boxPrices = {}, previousBoxSnapshot = null, generatedAt = new Date().toISOString() }) {
  const items = { a: [], psa10: [] };
  const empty = () => ({ trades: 0, prevTrades: 0, value: 0, prevValue: 0, products: 0, prevProducts: 0 });
  const totals = { a: empty(), psa10: empty() };
  for (const row of rows) {
    const condition = row.condition_key === 'psa10' ? 'psa10' : 'a';
    const trades = Number(row.trades) || 0;
    const prevTrades = Number(row.prev_trades) || 0;
    const total = totals[condition];
    total.trades += trades;
    total.prevTrades += prevTrades;
    total.value += Number(row.price_weight) || 0;
    total.prevValue += Number(row.prev_price_weight) || 0;
    if (trades > 0) total.products += 1;
    if (prevTrades > 0) total.prevProducts += 1;
    const product = products.get(Number(row.apparel_id));
    if (!product || trades < 1) continue;
    items[condition].push({
      apparelId: Number(row.apparel_id),
      condition,
      code: product.code,
      label: product.label,
      set: product.set,
      cardId: product.cardId || '',
      locale: product.locale || '',
      imageUrl: product.imageUrl || '',
      price: round(Number(row.price_weight) / trades),
      prevPrice: prevTrades > 0 ? round(Number(row.prev_price_weight) / prevTrades) : null,
      trades,
      prevTrades
    });
  }

  const movers = {};
  const mostTraded = {};
  for (const condition of ['psa10', 'a']) {
    const comparable = items[condition]
      .filter((item) => item.trades >= MIN_TRADES && item.prevTrades >= MIN_TRADES && item.prevPrice >= MIN_PRICE_JPY)
      .map((item) => ({ ...item, change: pct(item.price, item.prevPrice) }));
    const limit = condition === 'psa10' ? 10 : 5;
    movers[condition] = {
      gainers: comparable.filter((item) => item.change > 0).sort((x, y) => y.change - x.change).slice(0, limit),
      losers: comparable.filter((item) => item.change < 0).sort((x, y) => x.change - y.change).slice(0, limit)
    };
    mostTraded[condition] = [...items[condition]].sort((x, y) => y.trades - x.trades || y.price - x.price).slice(0, 10);
  }
  const topPrice = [...items.psa10, ...items.a].sort((x, y) => y.price - x.price).slice(0, 5);

  const dailyMap = new Map();
  for (let offset = 0; offset < 14; offset += 1) dailyMap.set(shiftDate(week.prevStart, offset), { date: shiftDate(week.prevStart, offset), psa10: 0, a: 0 });
  for (const row of dailyRows) {
    const day = dailyMap.get(String(row.point_date));
    if (day) day[row.condition_key === 'psa10' ? 'psa10' : 'a'] += Number(row.trades) || 0;
  }

  const seriesTrades = new Map();
  for (const item of [...items.psa10, ...items.a]) seriesTrades.set(item.set, (seriesTrades.get(item.set) || 0) + item.trades);
  const series = [...seriesTrades.entries()].map(([set, trades]) => ({ set, trades })).sort((x, y) => y.trades - x.trades).slice(0, 8);

  const boxSnapshot = {};
  const boxRows = boxes.map((box) => {
    const price = boxPriceJpy(boxPrices[String(box.apparelId)]);
    if (price) boxSnapshot[box.apparelId] = price;
    const prevPrice = previousBoxSnapshot?.[box.apparelId] || null;
    return { apparelId: box.apparelId, code: box.code, name: box.name, imageUrl: box.previewImageUrl || '', price, prevPrice, change: price && prevPrice ? pct(price, prevPrice) : null };
  }).filter((box) => box.price);

  return {
    id: week.weekEnd,
    ...week,
    generatedAt,
    krwPerJpy: MARKET_REPORT_KRW_PER_JPY,
    totals,
    daily: [...dailyMap.values()],
    movers,
    mostTraded,
    topPrice,
    series,
    boxes: boxRows,
    boxSnapshot,
    notes: []
  };
}

const monthDay = (dateKey) => `${Number(dateKey.slice(5, 7))}월 ${Number(dateKey.slice(8, 10))}일`;
export const formatReportWon = (jpy, rate = MARKET_REPORT_KRW_PER_JPY) => `₩${round(jpy * rate).toLocaleString('ko-KR')}`;
export function formatReportWonShort(jpy, rate = MARKET_REPORT_KRW_PER_JPY) {
  const won = jpy * rate;
  if (won >= 100000000) return `₩${(won / 100000000).toFixed(1)}억`;
  if (won >= 10000) return `₩${round(won / 10000).toLocaleString('ko-KR')}만`;
  return `₩${round(won).toLocaleString('ko-KR')}`;
}
export const formatReportChange = (value) => (value == null ? '-' : `${value > 0 ? '+' : ''}${value}%`);
export const reportConditionLabel = (condition) => (condition === 'psa10' ? 'PSA10' : 'Single');

export function getMarketReportTitle(report) {
  return `원피스카드 주간 시세 리포트 (${monthDay(report.weekStart)}~${monthDay(report.weekEnd)})`;
}

export function getMarketReportKpis(report) {
  const { psa10, a } = report.totals;
  return [
    { key: 'psa10', label: 'PSA10 거래', value: `${psa10.trades.toLocaleString('ko-KR')}건`, change: pct(psa10.trades, psa10.prevTrades) },
    { key: 'a', label: 'Single 거래', value: `${a.trades.toLocaleString('ko-KR')}건`, change: pct(a.trades, a.prevTrades) },
    { key: 'value', label: '총 거래액', value: formatReportWonShort(psa10.value + a.value, report.krwPerJpy), change: pct(psa10.value + a.value, psa10.prevValue + a.prevValue) },
    { key: 'products', label: '거래된 카드', value: `${(psa10.products + a.products).toLocaleString('ko-KR')}종`, change: pct(psa10.products + a.products, psa10.prevProducts + a.prevProducts) }
  ];
}

export function getMarketReportHighlights(report) {
  const rate = report.krwPerJpy;
  const topGainer = report.movers.psa10.gainers[0];
  const busiest = report.mostTraded.psa10[0];
  const priciest = report.topPrice[0];
  const topSeries = report.series[0];
  return [
    topGainer ? `가장 많이 오른 카드는 ${topGainer.label}로 일주일 만에 ${formatReportChange(topGainer.change)} 올랐습니다.` : '',
    busiest ? `가장 많이 거래된 카드는 ${busiest.label}(PSA10 ${busiest.trades}건)입니다.` : '',
    priciest ? `가장 비싸게 거래된 카드는 ${priciest.label} ${reportConditionLabel(priciest.condition)}로 평균 ${formatReportWon(priciest.price, rate)}이었습니다.` : '',
    topSeries ? `시리즈별로는 ${topSeries.set} 거래가 ${topSeries.trades}건으로 가장 많았습니다.` : ''
  ].filter(Boolean);
}

const summaryCard = (item) => ({ label: item.label, code: item.code, cardId: item.cardId, locale: item.locale, imageUrl: item.imageUrl, apparelId: item.apparelId, price: item.price, change: item.change });

// The small file the home page loads instead of the whole report.
export function getMarketReportSummary(report) {
  return {
    id: report.id,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    title: getMarketReportTitle(report),
    krwPerJpy: report.krwPerJpy,
    kpis: getMarketReportKpis(report).slice(0, 3),
    gainers: report.movers.psa10.gainers.slice(0, 3).map(summaryCard),
    losers: report.movers.psa10.losers.slice(0, 3).map(summaryCard)
  };
}

function moverTable(list, rate) {
  return {
    numeric: true,
    columns: ['카드', '이번 주', '지난주', '변화', '거래'],
    rows: list.map((item) => [item.label, formatReportWon(item.price, rate), formatReportWon(item.prevPrice, rate), formatReportChange(item.change), `${item.trades}건`])
  };
}

// Text equivalent of the report page, used for the pre-rendered HTML that search engines read.
export function getMarketReportEditorial(report) {
  const rate = report.krwPerJpy || MARKET_REPORT_KRW_PER_JPY;
  const { psa10, a } = report.totals;
  const period = `${monthDay(report.weekStart)}~${monthDay(report.weekEnd)}`;
  const sections = [];
  if (report.notes?.length) sections.push({ heading: '편집자 코멘트', paragraphs: report.notes });
  sections.push({ heading: '이번 주 한눈에 보기', stats: getMarketReportKpis(report).map((kpi) => ({ label: `${kpi.label} (${formatReportChange(kpi.change)})`, value: kpi.value })), items: getMarketReportHighlights(report) });
  sections.push({ heading: '요일별 거래량', table: { numeric: true, columns: ['날짜', 'PSA10', 'Single'], rows: report.daily.slice(7).map((day) => [day.date, `${day.psa10}건`, `${day.a}건`]) } });
  if (report.movers.psa10.gainers.length) sections.push({ heading: 'PSA10 상승 TOP 10', table: moverTable(report.movers.psa10.gainers, rate) });
  if (report.movers.psa10.losers.length) sections.push({ heading: 'PSA10 하락 TOP 10', table: moverTable(report.movers.psa10.losers, rate) });
  sections.push({
    heading: '가장 많이 거래된 카드',
    table: { numeric: true, columns: ['카드', '거래', '주간 평균가'], rows: report.mostTraded.psa10.slice(0, 10).map((item) => [item.label, `${item.trades}건`, formatReportWon(item.price, rate)]) }
  });
  if (report.topPrice.length) {
    sections.push({ heading: '이번 주 최고가 카드', table: { numeric: true, columns: ['카드', '등급', '주간 평균가'], rows: report.topPrice.map((item) => [item.label, reportConditionLabel(item.condition), formatReportWon(item.price, rate)]) } });
  }
  if (report.series.length) sections.push({ heading: '시리즈별 거래량', bars: report.series.map((entry) => ({ label: entry.set, value: entry.trades, display: `${entry.trades}건` })) });
  if (report.movers.a.gainers.length || report.movers.a.losers.length) {
    sections.push({ heading: 'Single 상승·하락', table: moverTable([...report.movers.a.gainers, ...report.movers.a.losers], rate) });
  }
  if (report.boxes.length) {
    sections.push({ heading: '박스 등록 최저가', table: { numeric: true, columns: ['박스', '등록 최저가', '변화'], rows: report.boxes.map((box) => [box.code, formatReportWon(box.price, rate), formatReportChange(box.change)]) } });
  }
  sections.push({ heading: '집계 기준', paragraphs: getMarketReportMethod(report) });
  return {
    heading: getMarketReportTitle(report),
    reviewedAt: report.weekEnd,
    paragraphs: [
      `${period} 한 주 동안 SNKRDUNK에서 거래된 원피스카드 시세를 Card Pone이 집계했습니다. PSA10 ${psa10.trades.toLocaleString('ko-KR')}건, Single ${a.trades.toLocaleString('ko-KR')}건의 실제 거래를 바탕으로 많이 오르고 내린 카드, 거래가 몰린 카드와 시리즈를 정리했습니다.`
    ],
    sections
  };
}

export function getMarketReportMethod(report) {
  const rate = report.krwPerJpy || MARKET_REPORT_KRW_PER_JPY;
  return [
    `기간은 한국 시간 ${monthDay(report.weekStart)}~${monthDay(report.weekEnd)}(월~일)이며 지난주와 비교했습니다. 하루 거래가 중앙값을 거래 건수로 가중 평균해 주간 가격으로 썼고, 패러렐·망가 등 버전은 따로 계산합니다.`,
    `상승·하락은 두 주 모두 ${MIN_TRADES}건 이상 거래되고 지난주 가격이 ¥${MIN_PRICE_JPY.toLocaleString('ko-KR')} 이상인 카드만 비교했습니다. 박스는 거래가 대신 등록 최저가이며, 원화는 1엔=${rate}원으로 환산한 참고값입니다.`
  ];
}
