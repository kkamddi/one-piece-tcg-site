import { useEffect, useMemo, useState } from 'react';
import { buildPortfolio } from './portfolio-model';

export default function usePortfolioValuation(holdings) {
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
        const params = new URLSearchParams({ summary: 'portfolio', apparelIds: chunk.join(',') });
        const response = await fetch(`/api/market?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('quote_unavailable');
        const payload = await response.json();
        if (!Array.isArray(payload?.items)) throw new Error('quote_invalid');
        return { items: payload.items, error: false };
      } catch {
        return { items: [], error: true };
      }
    })).then((parts) => {
      if (!controller.signal.aborted) setResult({ holdings, quotes: parts.flatMap((part) => part.items), error: parts.some((part) => part.error) });
    });
    return () => controller.abort();
  }, [holdings, revision]);
  const current = result.holdings === holdings;
  const model = useMemo(() => buildPortfolio(holdings, current ? result.quotes : []), [holdings, current, result.quotes]);
  return { ...model, loading: holdings.length > 0 && !current, error: current && result.error, refresh: () => setRevision((value) => value + 1) };
}
