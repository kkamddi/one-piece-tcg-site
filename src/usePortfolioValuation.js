import { useEffect, useMemo, useState } from 'react';
import { buildPortfolio } from './portfolio-model';

export default function usePortfolioValuation(holdings, rates) {
  const [result, setResult] = useState({ holdings: null, quotes: [], error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const ids = [...new Set(holdings.map((item) => Number(item.apparelId)).filter((id) => id > 0))];
    if (!ids.length) {
      setResult({ holdings, quotes: [], error: false });
      return () => controller.abort();
    }
    setResult({ holdings: null, quotes: [], error: false });
    const chunks = [];
    for (let index = 0; index < ids.length; index += 200) chunks.push(ids.slice(index, index + 200));
    Promise.all(chunks.map(async (chunk) => {
      try {
        const params = new URLSearchParams({ summary: 'trade-latest', apparelIds: chunk.join(',') });
        const response = await fetch(`/api/market?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('quote_unavailable');
        const payload = await response.json();
        if (payload?.basis !== 'snkrdunk_latest_trade_day_median' || !Array.isArray(payload?.items)) throw new Error('quote_invalid');
        let previousItems = null;
        if (import.meta.env.DEV) {
          try {
            const oldParams = new URLSearchParams({ summary: 'portfolio', apparelIds: chunk.join(',') });
            const oldResponse = await fetch(`/api/market?${oldParams}`, { signal: controller.signal });
            const oldPayload = oldResponse.ok ? await oldResponse.json() : null;
            if (Array.isArray(oldPayload?.items)) previousItems = oldPayload.items;
          } catch {}
        }
        return { items: payload.items, previousItems, error: false };
      } catch {
        return { items: [], error: true };
      }
    })).then((parts) => {
      if (!controller.signal.aborted) setResult({ holdings, quotes: parts.flatMap((part) => part.items), previousQuotes: parts.every(part => Array.isArray(part.previousItems)) ? parts.flatMap(part => part.previousItems) : null, error: parts.some((part) => part.error) });
    });
    return () => controller.abort();
  }, [holdings, revision]);
  const current = result.holdings === holdings;
  const model = useMemo(() => buildPortfolio(holdings, current ? result.quotes : [], rates), [holdings, current, result.quotes, rates]);
  const previous = useMemo(() => current && result.previousQuotes ? buildPortfolio(holdings, result.previousQuotes, rates) : null, [holdings, current, result.previousQuotes, rates]);
  return { ...model, previousTotalJpy: previous?.totalJpy ?? null, loading: holdings.length > 0 && !current, error: current && result.error, refresh: () => setRevision((value) => value + 1) };
}
