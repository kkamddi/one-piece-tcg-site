import { readThroughR2Json } from './r2-json-cache.js';

// Prices are stored in yen. The won shown next to them uses the day's reference rate (ECB, via Frankfurter,
// published on working days); these fallbacks apply only when no rate has been fetched yet.
export const FX_FALLBACK = Object.freeze({ krwPerJpy: 9.4, jpyPerUsd: 155, date: null, source: 'fallback' });
const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=KRW,USD';
const FX_CACHE_KEY = 'public-data/fx-rates-v1.json';
const FX_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function normalizeFxRates(payload) {
  const krwPerJpy = Number(payload?.rates?.KRW);
  const usdPerJpy = Number(payload?.rates?.USD);
  const date = String(payload?.date || '');
  if (!(krwPerJpy > 1 && krwPerJpy < 30) || !(usdPerJpy > 0.002 && usdPerJpy < 0.02) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { krwPerJpy: Math.round(krwPerJpy * 10000) / 10000, jpyPerUsd: Math.round(10000 / usdPerJpy) / 10000, date, source: 'ecb' };
}

export async function fetchFxRates(fetchImpl = fetch) {
  const response = await fetchImpl(FX_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`FX ${response.status}`);
  const rates = normalizeFxRates(await response.json());
  if (!rates) throw new Error('FX response out of range');
  return rates;
}

// The last good rate stays in R2, so a failed fetch keeps serving it instead of the fallback.
export async function readFxRates() {
  try {
    return await readThroughR2Json(FX_CACHE_KEY, FX_MAX_AGE_MS, () => fetchFxRates());
  } catch {
    return FX_FALLBACK;
  }
}
