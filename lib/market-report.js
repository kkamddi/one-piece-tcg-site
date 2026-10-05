// Weekly SNKRDUNK market report: week math, the D1 query, aggregation and the editorial view.
// Shared by scripts/generateWeeklyMarketReport.mjs, scripts/marketReportSeo.js and the React guide.

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TRADES = 2;
const MIN_PRICE_JPY = 1000;
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

export function weeklyReportSql({ weekStart, weekEnd, prevStart }) {
  for (const value of [weekStart, weekEnd, prevStart]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`invalid date ${value}`);
  }
  return `select apparel_id, condition_key,
  sum(case when point_date >= '${weekStart}' then trade_count else 0 end) as trades,
  sum(case when point_date >= '${weekStart}' then median_price_jpy * trade_count else 0 end) as price_weight,
  sum(case when point_date < '${weekStart}' then trade_count else 0 end) as prev_trades,
  sum(case when point_date < '${weekStart}' then median_price_jpy * trade_count else 0 end) as prev_price_weight
from market_chart_daily_points
where source = 'snkrdunk' and condition_key in ('a', 'psa10') and trade_count > 0
  and point_date between '${prevStart}' and '${weekEnd}'
group by apparel_id, condition_key;`;
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

// rows: weekly aggregates from weeklyReportSql. products: Map apparelId -> { code, label, set, imageUrl }.
export function buildWeeklyMarketReport({ week, rows, products, boxes = [], boxPrices = {}, previousBoxSnapshot = null, generatedAt = new Date().toISOString() }) {
  const items = { a: [], psa10: [] };
  const totals = { a: { trades: 0, prevTrades: 0, products: 0 }, psa10: { trades: 0, prevTrades: 0, products: 0 } };
  for (const row of rows) {
    const condition = row.condition_key === 'psa10' ? 'psa10' : 'a';
    const trades = Number(row.trades) || 0;
    const prevTrades = Number(row.prev_trades) || 0;
    totals[condition].trades += trades;
    totals[condition].prevTrades += prevTrades;
    if (trades > 0) totals[condition].products += 1;
    const product = products.get(Number(row.apparel_id));
    if (!product || trades < 1) continue;
    items[condition].push({
      apparelId: Number(row.apparel_id),
      code: product.code,
      label: product.label,
      set: product.set,
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

  const seriesTrades = new Map();
  for (const item of [...items.psa10, ...items.a]) seriesTrades.set(item.set, (seriesTrades.get(item.set) || 0) + item.trades);
  const series = [...seriesTrades.entries()].map(([set, trades]) => ({ set, trades })).sort((x, y) => y.trades - x.trades).slice(0, 8);

  const boxSnapshot = {};
  const boxRows = boxes.map((box) => {
    const price = boxPriceJpy(boxPrices[String(box.apparelId)]);
    if (price) boxSnapshot[box.apparelId] = price;
    const prevPrice = previousBoxSnapshot?.[box.apparelId] || null;
    return { apparelId: box.apparelId, code: box.code, name: box.name, price, prevPrice, change: price && prevPrice ? pct(price, prevPrice) : null };
  }).filter((box) => box.price);

  return {
    id: week.weekEnd,
    ...week,
    generatedAt,
    krwPerJpy: MARKET_REPORT_KRW_PER_JPY,
    totals,
    movers,
    mostTraded,
    series,
    boxes: boxRows,
    boxSnapshot,
    notes: []
  };
}

const monthDay = (dateKey) => `${Number(dateKey.slice(5, 7))}월 ${Number(dateKey.slice(8, 10))}일`;
const won = (jpy, rate) => `₩${round(jpy * rate).toLocaleString('ko-KR')}`;
const signed = (value) => (value == null ? '-' : `${value > 0 ? '+' : ''}${value}%`);
const conditionLabel = (condition) => (condition === 'psa10' ? 'PSA10' : 'Single');

export function getMarketReportTitle(report) {
  return `원피스카드 주간 시세 리포트 (${monthDay(report.weekStart)}~${monthDay(report.weekEnd)})`;
}

function moverTable(list, rate) {
  return {
    numeric: true,
    columns: ['카드', '이번 주', '지난주', '변화', '거래'],
    rows: list.map((item) => [item.label, won(item.price, rate), won(item.prevPrice, rate), signed(item.change), `${item.trades}건`])
  };
}

// Editorial shape consumed by toEditorialGuide (React) and the static page renderer.
export function getMarketReportEditorial(report) {
  const rate = report.krwPerJpy || MARKET_REPORT_KRW_PER_JPY;
  const { psa10, a } = report.totals;
  const psaChange = pct(psa10.trades, psa10.prevTrades);
  const topGainer = report.movers.psa10.gainers[0];
  const topLoser = report.movers.psa10.losers[0];
  const busiest = report.mostTraded.psa10[0];
  const topSeries = report.series[0];
  const period = `${monthDay(report.weekStart)}~${monthDay(report.weekEnd)}`;

  const highlights = [
    `PSA10 거래는 ${psa10.trades.toLocaleString('ko-KR')}건으로 지난주(${psa10.prevTrades.toLocaleString('ko-KR')}건)보다 ${psaChange == null ? '비교할 수 없었습니다' : psaChange >= 0 ? `${psaChange}% 늘었습니다` : `${Math.abs(psaChange)}% 줄었습니다`}.`,
    topGainer ? `PSA10에서 가장 많이 오른 카드는 ${topGainer.label}(${signed(topGainer.change)}, ${won(topGainer.price, rate)})입니다.` : '',
    topLoser ? `가장 많이 내린 카드는 ${topLoser.label}(${signed(topLoser.change)}, ${won(topLoser.price, rate)})입니다.` : '',
    busiest ? `거래가 가장 많았던 카드는 ${busiest.label}로 PSA10 ${busiest.trades}건이 거래됐습니다.` : '',
    topSeries ? `시리즈별로는 ${topSeries.set}의 거래가 ${topSeries.trades}건으로 가장 많았습니다.` : ''
  ].filter(Boolean);

  const sections = [];
  if (report.notes?.length) sections.push({ heading: '편집자 코멘트', paragraphs: report.notes });
  sections.push({ heading: '이번 주 한눈에 보기', items: highlights });
  if (report.movers.psa10.gainers.length) sections.push({ heading: 'PSA10 상승 TOP 10', table: moverTable(report.movers.psa10.gainers, rate) });
  if (report.movers.psa10.losers.length) sections.push({ heading: 'PSA10 하락 TOP 10', table: moverTable(report.movers.psa10.losers, rate) });
  if (report.movers.a.gainers.length || report.movers.a.losers.length) {
    sections.push({
      heading: 'Single 상승·하락 TOP 5',
      table: moverTable([...report.movers.a.gainers, ...report.movers.a.losers], rate),
      paragraphs: ['Single은 PSA10보다 거래가 적어 두 주 모두 2건 이상 거래된 카드만 비교했습니다.']
    });
  }
  sections.push({
    heading: '거래가 많았던 카드',
    table: {
      numeric: true,
      columns: ['카드', '등급', '거래', '주간 평균가'],
      rows: [
        ...report.mostTraded.psa10.slice(0, 7).map((item) => [item, 'psa10']),
        ...report.mostTraded.a.slice(0, 3).map((item) => [item, 'a'])
      ].map(([item, condition]) => [item.label, conditionLabel(condition), `${item.trades}건`, won(item.price, rate)])
    }
  });
  if (report.series.length) {
    sections.push({
      heading: '시리즈별 거래량',
      bars: report.series.map((entry) => ({ label: entry.set, value: entry.trades, display: `${entry.trades}건` }))
    });
  }
  if (report.boxes.length) {
    const hasChange = report.boxes.some((box) => box.change != null);
    sections.push({
      heading: '박스 등록 최저가',
      table: {
        numeric: true,
        columns: hasChange ? ['박스', '등록 최저가', '지난주', '변화'] : ['박스', '등록 최저가'],
        rows: report.boxes.map((box) => (hasChange
          ? [box.code, won(box.price, rate), box.prevPrice ? won(box.prevPrice, rate) : '-', signed(box.change)]
          : [box.code, won(box.price, rate)]))
      },
      paragraphs: [hasChange ? '박스는 거래가가 아니라 SNKRDUNK 일본판 박스의 등록 최저가입니다.' : '박스는 SNKRDUNK 일본판 박스의 등록 최저가이며, 다음 리포트부터 지난주 대비 변화를 함께 표시합니다.']
    });
  }
  sections.push({
    heading: '집계 기준',
    paragraphs: [
      `기간은 한국 시간 ${period}(월~일)이며 지난주와 비교했습니다. SNKRDUNK에서 실제로 거래된 가격의 하루 중앙값을 거래 건수로 가중 평균해 주간 가격으로 썼습니다.`,
      `상승·하락은 두 주 모두 ${MIN_TRADES}건 이상 거래되고 지난주 가격이 ¥${MIN_PRICE_JPY.toLocaleString('ko-KR')} 이상인 카드만 비교했습니다. 원화는 1엔=${rate}원으로 환산한 참고값입니다.`
    ]
  });

  return {
    heading: getMarketReportTitle(report),
    reviewedAt: report.weekEnd,
    paragraphs: [
      `${period} 한 주 동안 SNKRDUNK에서 거래된 원피스카드 시세를 Card Pone이 집계했습니다. PSA10 ${psa10.trades.toLocaleString('ko-KR')}건(${psa10.products}개 상품), Single ${a.trades.toLocaleString('ko-KR')}건(${a.products}개 상품)의 거래를 바탕으로 많이 오르고 내린 카드, 거래가 몰린 카드와 시리즈를 정리했습니다.`,
      '숫자는 매주 월요일 자동으로 집계되며, 같은 카드라도 패러렐·망가 등 버전마다 따로 계산합니다.'
    ],
    summary: [
      { value: `${psa10.trades.toLocaleString('ko-KR')}건`, label: `PSA10 거래 (${signed(psaChange)})` },
      { value: `${a.trades.toLocaleString('ko-KR')}건`, label: `Single 거래 (${signed(pct(a.trades, a.prevTrades))})` },
      topGainer ? { value: signed(topGainer.change), label: `최대 상승 · ${topGainer.code}` } : null,
      topLoser ? { value: signed(topLoser.change), label: `최대 하락 · ${topLoser.code}` } : null
    ].filter(Boolean),
    sections,
    checklist: [
      '주간 가격은 거래 건수가 적으면 크게 흔들리므로 거래 건수를 함께 보세요.',
      '카드 상태와 버전에 따라 가격이 다르니 시세 화면에서 최근 거래를 확인하세요.',
      '원화 금액은 환산 참고값이며 실제 구매 비용에는 배송비·수수료가 더해집니다.'
    ]
  };
}
