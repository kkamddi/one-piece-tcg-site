import test from 'node:test';
import assert from 'node:assert/strict';
import { priceSummary, formatPriceWon } from '../extensions/card-pone/prices.js';
const payload = items => ({ basis: 'snkrdunk_latest_trade_day_median', items });
test('won prices use the website conversion and round to whole won', () => {
  assert.equal(formatPriceWon(23715), '₩222,921');
  assert.equal(formatPriceWon(29140), '₩273,916');
  assert.equal(formatPriceWon(1), '₩9');
  for (const value of [null, undefined, 0, -1, NaN, Infinity]) assert.equal(formatPriceWon(value), '시세 없음');
});
test('prices match the exact product rather than another printing', () => {
  const data = priceSummary(payload([{ apparelId: 2, aPriceJpy: 900 }, { apparelId: 1, aPriceJpy: 1234, psa10PriceJpy: 5678, aTradeDate: '2026-09-23', psa10TradeDate: '2026-09-24' }]), 1);
  assert.equal(data.single, 1234);
  assert.equal(data.psa10, 5678);
  assert.equal(data.singleDate, '2026-09-23');
  assert.equal(data.psa10Date, '2026-09-24');
});
test('missing, invalid and zero prices are not shown as zero yen', () => {
  assert.deepEqual(priceSummary(payload([]), 1), { single: null, psa10: null, singleDate: null, psa10Date: null });
  for (const value of [0, -1, null, 'bad', Infinity]) assert.equal(priceSummary(payload([{ apparelId: 1, aPriceJpy: value }]), 1).single, null);
  assert.throws(() => priceSummary({ items: [{ apparelId: 1, aPriceJpy: 28210 }] }, 1), /invalid_price_response/);
  assert.throws(() => priceSummary({}, 1), /invalid_price_response/);
});
