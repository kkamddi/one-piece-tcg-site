// Matches RenewApp's MARKET_USD_TO_KRW / MARKET_USD_TO_JPY.
export const JPY_TO_KRW = 9.4;

export function formatPriceWon(value) {
  return Number.isFinite(value) && value > 0
    ? `₩${Math.round(value * JPY_TO_KRW).toLocaleString('ko-KR')}`
    : '시세 없음';
}

export function priceSummary(payload, apparelId) {
  if (payload?.basis !== 'snkrdunk_latest_trade_day_median' || !Array.isArray(payload?.items)) throw new Error('invalid_price_response');
  const row = payload.items.find(item => Number(item.apparelId) === apparelId);
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
  return { single: positive(row?.aPriceJpy), psa10: positive(row?.psa10PriceJpy), singleDate: date(row?.aTradeDate), psa10Date: date(row?.psa10TradeDate) };
}

export async function fetchPrices(apparelId, signal) {
  if (!Number.isSafeInteger(apparelId) || apparelId <= 0) throw new Error('invalid_product');
  const url = `https://www.optcgkorea.com/api/market?summary=trade-latest&apparelIds=${apparelId}`;
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache' });
  if (!response.ok) throw new Error('price_unavailable');
  return priceSummary(await response.json(), apparelId);
}
