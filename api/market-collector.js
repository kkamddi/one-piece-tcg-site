import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';
import { collectMarketSnapshot } from './market.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 8;

function getBearerToken(request) {
  const header = String(request.headers?.authorization || request.headers?.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function isAuthorized(request) {
  const expected = String(process.env.MARKET_COLLECTOR_TOKEN || '').trim();
  if (!expected) return false;
  const provided = getBearerToken(request) || String(request.query?.token || '').trim();
  return Boolean(provided) && provided === expected;
}

function uniqueByApparelId(items) {
  const seen = new Set();
  return items.filter((item) => {
    const apparelId = Number(item?.apparelId || 0);
    if (!Number.isFinite(apparelId) || apparelId <= 0 || seen.has(apparelId)) return false;
    seen.add(apparelId);
    return true;
  });
}

function buildTargetItems(scope = 'approved') {
  const allMarketCards = uniqueByApparelId((Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => item?.apparelId));
  const jpMarketCards = allMarketCards.filter((item) => item?.locale === 'JP');
  const enMarketCards = allMarketCards.filter((item) => item?.locale === 'EN');
  if (scope === 'all-jp') return jpMarketCards;
  if (scope === 'all-en') return enMarketCards;
  if (scope === 'all-market' || scope === 'all') return allMarketCards;

  const byApparelId = new Map(jpMarketCards.map((item) => [Number(item.apparelId), item]));
  const approvedIds = new Set((Array.isArray(cardMarketLinks) ? cardMarketLinks : [])
    .filter((link) => link?.locale === 'JP' && link?.status === 'approved' && link?.apparelId)
    .map((link) => Number(link.apparelId)));

  return jpMarketCards.filter((item) => approvedIds.has(Number(item.apparelId)) && byApparelId.has(Number(item.apparelId)));
}

async function collectBatch(items, concurrency = DEFAULT_CONCURRENCY) {
  const result = { collected: 0, priced: 0, failed: 0, errors: [] };
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      try {
        const collected = await collectMarketSnapshot(item);
        result.collected += 1;
        if (collected.ok) result.priced += 1;
      } catch (error) {
        result.failed += 1;
        if (result.errors.length < 5) {
          result.errors.push({
            apparelId: item?.apparelId || '',
            code: item?.code || '',
            error: error?.message || 'collect_failed'
          });
        }
      }
    }
  });
  await Promise.all(workers);
  return result;
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isAuthorized(request)) {
    return response.status(401).json({ error: process.env.MARKET_COLLECTOR_TOKEN ? 'unauthorized' : 'collector_token_not_configured' });
  }

  const scope = String(request.query?.scope || 'approved');
  const allTargets = buildTargetItems(scope);
  const offset = Math.max(0, Number(request.query?.offset || 0) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(request.query?.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT));
  const concurrency = Math.min(MAX_CONCURRENCY, Math.max(1, Number(request.query?.concurrency || DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY));
  const batch = allTargets.slice(offset, offset + limit);
  const batchResult = await collectBatch(batch, concurrency);
  const nextOffset = offset + batch.length;

  return response.status(200).json({
    ok: true,
    scope,
    total: allTargets.length,
    offset,
    limit,
    concurrency,
    nextOffset,
    done: nextOffset >= allTargets.length,
    ...batchResult
  });
}
