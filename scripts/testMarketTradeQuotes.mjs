import test from 'node:test';
import assert from 'node:assert/strict';
import { readTradeQuotes, TRADE_QUOTE_BASIS } from '../lib/market-trade-quotes.js';
import { buildPortfolio } from '../src/portfolio-model.js';

test('quotes keep separate grade dates and never substitute listing prices', async () => {
  const result = await readTradeQuotes(async (sql, params) => {
    assert.ok(sql.includes('trade_count > 0'));
    assert.ok(!sql.includes('market_products'));
    assert.deepEqual(params, ['2026-09-24', 108050]);
    return [{ apparel_id: 108050, condition_key: 'psa10', point_date: '2026-09-24', median_price_jpy: 25011 }];
  }, [108050], Date.parse('2026-09-23T16:00:00Z'));
  assert.equal(result.basis, TRADE_QUOTE_BASIS);
  assert.equal(result.items[0].psa10PriceJpy, 25011);
  assert.equal(result.items[0].aPriceJpy, null);
  assert.equal(result.items[0].psa10TradeDate, '2026-09-24');
});
test('missing trades remain unvalued and purchase records remain unchanged', () => {
  const holdings = [{ id: 'test', apparelId: 108050, grade: 'psa10', purchases: [{ quantity: 2, unitPriceJpy: 20000 }] }];
  const original = JSON.stringify(holdings);
  const before = buildPortfolio(holdings, [{ apparelId: 108050, psa10PriceJpy: 28210 }]);
  const after = buildPortfolio(holdings, [{ apparelId: 108050, psa10PriceJpy: 25011 }]);
  assert.equal(after.totalJpy - before.totalJpy, -6398);
  assert.equal(after.costJpy, before.costJpy);
  assert.equal(buildPortfolio(holdings, []).cards[0].profitJpy, null);
  assert.equal(JSON.stringify(holdings), original);
});
