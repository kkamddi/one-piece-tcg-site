export const TRADE_QUOTE_BASIS = 'snkrdunk_latest_trade_day_median';

export async function readTradeQuotes(query, ids = [], now = Date.now()) {
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const filter = ids.length ? `AND apparel_id IN (${ids.map(() => '?').join(',')})` : '';
  const rows = await query(`
    WITH latest AS (
      SELECT apparel_id, condition_key, MAX(point_date) AS point_date
      FROM market_chart_daily_points
      WHERE source = 'snkrdunk' AND condition_key IN ('a', 'psa10')
        AND median_price_jpy > 0 AND trade_count > 0 AND point_date <= ? ${filter}
      GROUP BY apparel_id, condition_key
    )
    SELECT d.apparel_id, d.condition_key, d.point_date, d.median_price_jpy
    FROM latest l JOIN market_chart_daily_points d
      ON d.source = 'snkrdunk' AND d.apparel_id = l.apparel_id
      AND d.condition_key = l.condition_key AND d.point_date = l.point_date
    ORDER BY d.apparel_id, d.condition_key`, [today, ...ids]);
  const items = new Map();
  for (const row of rows) {
    const id = Number(row.apparel_id), price = Number(row.median_price_jpy);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(price) || price <= 0
      || !['a', 'psa10'].includes(row.condition_key) || !/^\d{4}-\d{2}-\d{2}$/.test(row.point_date) || row.point_date > today) continue;
    const item = items.get(id) || { apparelId: id, aPriceJpy: null, psa10PriceJpy: null, aTradeDate: null, psa10TradeDate: null };
    item[`${row.condition_key}PriceJpy`] = Math.round(price);
    item[`${row.condition_key}TradeDate`] = row.point_date;
    items.set(id, item);
  }
  return { basis: TRADE_QUOTE_BASIS, items: [...items.values()] };
}
