function purchaseUnitPriceJpy(lot, rates) {
  const original = Number(lot.originalUnitPrice);
  if (['manual', 'estimate'].includes(lot.mode) && Number.isFinite(original) && original > 0) {
    const currency = String(lot.originalCurrency || '').toUpperCase();
    if (currency === 'JPY') return original;
    if (currency === 'KRW' && Number.isFinite(rates.krwPerJpy) && rates.krwPerJpy > 0) return original / rates.krwPerJpy;
    if (currency === 'USD' && Number.isFinite(rates.jpyPerUsd) && rates.jpyPerUsd > 0) return original * rates.jpyPerUsd;
  }
  const stored = Number(lot.unitPriceJpy);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export function buildPortfolio(holdings = [], quotes = [], rates = {}) {
  const byId = new Map(quotes.map((item) => [String(item.apparelId), item]));
  const cards = holdings.map((holding) => {
    // Derive display/calculation costs without rewriting stored purchase records.
    const lots = Array.isArray(holding.purchases)
      ? holding.purchases.map(lot => ({ ...lot, unitPriceJpy: purchaseUnitPriceJpy(lot, rates) })) : [];
    const quantityOf = (lot) => Math.max(1, Number(lot.quantity) || 1);
    const pricedLots = lots.filter((lot) => Number(lot.unitPriceJpy) > 0);
    const quantity = lots.length ? lots.reduce((sum, lot) => sum + quantityOf(lot), 0) : 1;
    const pricedQuantity = pricedLots.reduce((sum, lot) => sum + quantityOf(lot), 0);
    const costJpy = pricedLots.reduce((sum, lot) => sum + Number(lot.unitPriceJpy) * quantityOf(lot), 0);
    const grade = holding.grade === 'psa10' ? 'psa10' : 'a';
    const quote = byId.get(String(holding.apparelId));
    const rawPrice = Number(grade === 'psa10' ? quote?.psa10PriceJpy : quote?.aPriceJpy);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;
    const profitJpy = price != null && pricedQuantity > 0 ? price * pricedQuantity - costJpy : null;
    return {
      ...holding, key: holding.id, grade, lots, quantity, pricedQuantity, costJpy, price,
      priceDate: (grade === 'psa10' ? quote?.psa10TradeDate : quote?.aTradeDate) || null,
      valueJpy: price == null ? null : price * quantity,
      profitJpy,
      returnPercent: profitJpy == null || !costJpy ? null : profitJpy / costJpy * 100,
      estimated: pricedLots.some((lot) => lot.mode === 'estimate'),
      previewImageUrl: holding.previewImageUrl || holding.imageUrl || '/card-placeholder.svg'
    };
  });
  const comparable = cards.filter((card) => card.profitJpy != null);
  const comparableCostJpy = comparable.reduce((sum, card) => sum + card.costJpy, 0);
  const profitJpy = comparable.length ? comparable.reduce((sum, card) => sum + card.profitJpy, 0) : null;
  return {
    cards,
    totalJpy: cards.reduce((sum, card) => sum + (card.valueJpy || 0), 0),
    costJpy: cards.reduce((sum, card) => sum + card.costJpy, 0),
    quantity: cards.reduce((sum, card) => sum + card.quantity, 0),
    missingQuotes: cards.filter((card) => card.price == null).length,
    missingCostQuantity: cards.reduce((sum, card) => sum + card.quantity - card.pricedQuantity, 0),
    comparableCostJpy, profitJpy,
    returnPercent: comparableCostJpy > 0 ? profitJpy / comparableCostJpy * 100 : null
  };
}
