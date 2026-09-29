import boxItems from './data/box-market-items.js';

export const BOX_QUOTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const sealedBoxes = boxItems.filter(item => /\bBox$/i.test(item.name) && /(?:^|-)(?:OP|EB|PRB)-\d{2}$/.test(item.code));
export function findSealedBox(apparelId) {
  return sealedBoxes.find(item => Number(item.apparelId) === Number(apparelId)) || null;
}
export function boxSeries(item) {
  return String(item.code || '').match(/(?:^|-)(OP|EB|PRB)-\d{2}$/)?.[1] || 'other';
}
export function boxQuote(item, snapshot, rates = {}, now = Date.now()) {
  const point = snapshot?.items?.[String(item.apparelId)];
  const timestamp = Date.parse(snapshot?.updatedAt || '');
  const age = now - timestamp;
  const amount = Number(point?.minPrice);
  const currency = point?.priceCurrency;
  const multiplier = currency === 'JPY' ? 1 : currency === 'USD' ? rates.jpyPerUsd
    : currency === 'KRW' && rates.krwPerJpy > 0 ? 1 / rates.krwPerJpy : 0;
  const valid = findSealedBox(item.apparelId) && Number.isFinite(age) && age >= 0
    && age <= BOX_QUOTE_MAX_AGE_MS && amount > 0 && Number.isFinite(amount)
    && multiplier > 0 && Number.isFinite(multiplier);
  return { apparelId: item.apparelId, assetType: 'box', boxPriceJpy: valid ? amount * multiplier : null,
    boxPriceDate: valid ? snapshot.updatedAt.slice(0, 10) : null, basis: 'listing' };
}
