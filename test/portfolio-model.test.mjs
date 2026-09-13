import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPortfolio } from '../src/portfolio-model.js';

test('legacy holdings retain one unit without inventing a purchase cost', () => {
  const model = buildPortfolio([{ id: 'legacy', apparelId: 1 }], [{ apparelId: 1, aPriceJpy: 250 }]);
  assert.equal(model.quantity, 1);
  assert.equal(model.totalJpy, 250);
  assert.equal(model.profitJpy, null);
  assert.equal(model.missingCostQuantity, 1);
});
test('return only includes quantities with both cost and a current quote', () => {
  const model = buildPortfolio([
    { id: 'single', apparelId: 1, purchases: [{ quantity: 2, unitPriceJpy: 100 }, { quantity: 1, mode: 'later' }] },
    { id: 'missing', apparelId: 2, purchases: [{ quantity: 1, unitPriceJpy: 900 }] },
    { id: 'psa', apparelId: 1, grade: 'psa10', purchases: [{ quantity: 1, unitPriceJpy: 500, mode: 'estimate' }] }
  ], [{ apparelId: 1, aPriceJpy: 150, psa10PriceJpy: 400 }]);
  assert.equal(model.totalJpy, 850);
  assert.equal(model.costJpy, 1600);
  assert.equal(model.comparableCostJpy, 700);
  assert.equal(model.profitJpy, 0);
  assert.equal(model.returnPercent, 0);
  assert.equal(model.missingQuotes, 1);
  assert.equal(model.missingCostQuantity, 1);
  assert.equal(model.cards[1].profitJpy, null);
  assert.equal(model.cards[2].estimated, true);
});
test('empty portfolios and invalid quotes do not manufacture losses', () => {
  assert.equal(buildPortfolio().quantity, 0);
  for (const price of [0, -10, null, 'bad', Infinity]) {
    const model = buildPortfolio([{ id: 'card', apparelId: 1, purchases: [{ quantity: 1, unitPriceJpy: 100 }] }], [{ apparelId: 1, aPriceJpy: price }]);
    assert.equal(model.cards[0].price, null);
    assert.equal(model.profitJpy, null);
  }
});
