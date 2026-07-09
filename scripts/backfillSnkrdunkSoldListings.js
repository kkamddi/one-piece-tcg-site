import { appendFile } from 'node:fs/promises';
import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';

const SNKRDUNK_BASE = 'https://snkrdunk.com';
const DEFAULT_COLLECTOR_URL = 'https://www.optcgkorea.com/api/market-collector';
const DEFAULT_PER_PAGE = 50;
const DEFAULT_DELAY_MS = 250;
const DEFAULT_HISTORY_CHUNK_SIZE = 10;
const DEFAULT_SAFETY_MAX_PAGES = 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function parseIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => Number(String(id).trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parsePageLimit(value) {
  const text = String(value || 'all').trim().toLowerCase();
  const safetyMax = positiveInt(process.env.SOLD_LISTING_SAFETY_MAX_PAGES, DEFAULT_SAFETY_MAX_PAGES, 5000);
  if (!text || ['all', 'full', 'max', '*'].includes(text)) {
    return { maxPages: safetyMax, requestedAll: true };
  }
  return { maxPages: positiveInt(text, safetyMax, 5000), requestedAll: false };
}

function conditionKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'a' || text === 'single') return 'a';
  if (text === 'psa 10' || text === 'psa10') return 'psa10';
  return text.replace(/\s+/g, '_') || 'unknown';
}

function acceptedConditionKeys() {
  const raw = String(process.env.BACKFILL_CONDITIONS || 'a,psa10');
  return new Set(raw.split(',').map(conditionKey).filter(Boolean));
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

async function fetchJsonWithRetry(url, options = {}, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const body = await response.json().catch(() => null);
      if (response.ok) return body;
      lastError = new Error(`${response.status}:${body?.error || body?.message || response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(1000 * attempt);
  }
  throw lastError || new Error('request_failed');
}

async function queryD1(sql, params = []) {
  if (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID) return [];
  const body = await fetchJsonWithRetry(
    `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${D1_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  if (!body?.success) throw new Error(body?.errors?.[0]?.message || 'd1_query_failed');
  return body.result?.[0]?.results || [];
}

async function fetchApprovedOverrideIds() {
  try {
    const rows = await queryD1(`
      SELECT apparel_id AS apparelId
      FROM card_market_link_overrides
      WHERE status = 'approved'
        AND apparel_id > 0
    `);
    return rows.map((row) => Number(row.apparelId || row.apparel_id || 0)).filter((id) => id > 0);
  } catch (error) {
    console.warn(`override lookup skipped: ${error?.message || 'failed'}`);
    return [];
  }
}

async function buildTargets() {
  const explicitIds = parseIds(process.env.APPAREL_IDS || process.env.BACKFILL_APPAREL_IDS);
  const scope = String(process.env.BACKFILL_SCOPE || 'approved').trim().toLowerCase();
  const allMarketCards = uniqueByApparelId((Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => item?.apparelId));
  const byApparelId = new Map(allMarketCards.map((item) => [Number(item.apparelId), item]));

  if (explicitIds.length) {
    return explicitIds.map((apparelId) => byApparelId.get(apparelId) || {
      source: 'snkrdunk',
      apparelId,
      locale: 'JP',
      code: '',
      name: '',
    });
  }

  const jpMarketCards = allMarketCards.filter((item) => item?.locale === 'JP');
  if (scope === 'all-jp') return jpMarketCards;
  if (scope === 'all-market' || scope === 'all') return allMarketCards;

  const approvedIds = new Set((Array.isArray(cardMarketLinks) ? cardMarketLinks : [])
    .filter((link) => link?.locale === 'JP' && link?.status === 'approved' && link?.apparelId)
    .map((link) => Number(link.apparelId)));
  for (const apparelId of await fetchApprovedOverrideIds()) approvedIds.add(apparelId);
  return jpMarketCards.filter((item) => approvedIds.has(Number(item.apparelId)));
}

function decodeUlidTimestamp(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text.length < 10) return 0;
  let timestamp = 0;
  for (const char of text.slice(0, 10)) {
    const index = ULID_ALPHABET.indexOf(char);
    if (index < 0) return 0;
    timestamp = timestamp * 32 + index;
  }
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function dateKeyKst(timestamp) {
  const parsed = Number(timestamp || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return new Date(parsed + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function dateTimeTextKst(timestamp) {
  const parsed = Number(timestamp || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return new Date(parsed + KST_OFFSET_MS).toISOString();
}

function listingTimestamp(listing) {
  const fromUid = decodeUlidTimestamp(listing?.listingUID || listing?.listingUid || listing?.id);
  if (fromUid > 0) return fromUid;
  const parsed = Date.parse(listing?.soldAt || listing?.sold_at || listing?.updatedAt || listing?.updated_at || listing?.createdAt || listing?.created_at || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function listingConditionName(listing) {
  return String(
    listing?.condition
    || listing?.conditionName
    || listing?.condition_name
    || listing?.usedListingCondition?.name
    || ''
  ).trim();
}

function listingPriceText(listing) {
  const amount = Number(listing?.priceAmount || listing?.price_amount || 0);
  const currency = String(listing?.currency || '').trim().toUpperCase();
  if (Number.isFinite(amount) && amount > 0) {
    if (currency === 'USD') return `US $${amount}`;
    if (currency === 'JPY') return `JPY ${Math.round(amount)}`;
    if (currency === 'KRW') return `KRW ${Math.round(amount)}`;
  }
  return String(listing?.price || listing?.priceText || listing?.amount || '');
}

async function fetchUsedListingsPage(apparelId, page, perPage) {
  const productCode = `SW---${Number(apparelId)}`;
  const params = new URLSearchParams({
    perPage: String(perPage),
    page: String(page),
    sortType: 'latest',
    isOnlyOnSale: 'false',
  });
  const data = await fetchJsonWithRetry(`${SNKRDUNK_BASE}/en/v1/products/${productCode}/used-listings?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 CardPoneBot/1.0',
    },
  });
  return [
    data?.usedListings,
    data?.used_listings,
    data?.listings,
    data?.items,
  ].find(Array.isArray) || [];
}

function historyFromListings(listings, allowedConditions) {
  const seen = new Set();
  const history = [];
  let soldSeen = 0;

  for (const listing of listings) {
    if (!listing?.isSold) continue;
    soldSeen += 1;
    const timestamp = listingTimestamp(listing);
    const day = dateKeyKst(timestamp);
    const dateText = dateTimeTextKst(timestamp) || day;
    const condition = listingConditionName(listing);
    const key = conditionKey(condition);
    const priceText = listingPriceText(listing);
    const listingUid = String(listing?.listingUID || listing?.listingUid || listing?.id || '').trim();
    const dedupeKey = listingUid || `${day}|${key}|${priceText}`;
    if (!day || !condition || !priceText || !allowedConditions.has(key) || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    history.push({
      date: day,
      dateText,
      condition,
      priceText,
      listingUid,
    });
  }

  return { history, soldSeen };
}

async function postHistory(item, history, collectorUrl, token) {
  const separator = collectorUrl.includes('?') ? '&' : '?';
  return fetchJsonWithRetry(`${collectorUrl}${separator}mode=history`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...item, history }),
  });
}

async function postHistoryChunks(item, history, options) {
  const result = {
    tradesSeen: 0,
    tradesStored: 0,
    dailyPointsUpdated: 0,
  };
  for (let start = 0; start < history.length; start += options.historyChunkSize) {
    const chunk = history.slice(start, start + options.historyChunkSize);
    const posted = await postHistory(item, chunk, options.collectorUrl, options.token);
    result.tradesSeen += Number(posted?.tradesSeen || 0);
    result.tradesStored += Number(posted?.tradesStored || 0);
    result.dailyPointsUpdated += Number(posted?.dailyPointsUpdated || 0);
    if (options.delayMs) await sleep(Math.min(options.delayMs, 1000));
  }
  return result;
}

async function appendProgress(path, payload) {
  if (!path) return;
  await appendFile(path, `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`, 'utf8');
}

async function backfillItem(item, options) {
  const result = {
    apparelId: Number(item.apparelId),
    code: item.code || '',
    pagesFetched: 0,
    listingsSeen: 0,
    soldSeen: 0,
    historyPosted: 0,
    tradesSeen: 0,
    tradesStored: 0,
    dailyPointsUpdated: 0,
    capped: false,
  };

  for (let page = 1; page <= options.maxPages; page += 1) {
    const listings = await fetchUsedListingsPage(item.apparelId, page, options.perPage);
    result.pagesFetched += 1;
    result.listingsSeen += listings.length;

    if (!listings.length) break;

    const { history, soldSeen } = historyFromListings(listings, options.allowedConditions);
    result.soldSeen += soldSeen;
    if (history.length) {
      const posted = await postHistoryChunks(item, history, options);
      result.historyPosted += history.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
      result.dailyPointsUpdated += Number(posted?.dailyPointsUpdated || 0);
    }

    if (listings.length < options.perPage) break;
    if (page === options.maxPages) result.capped = true;
    if (options.delayMs) await sleep(options.delayMs);
  }

  return result;
}

async function main() {
  const token = String(process.env.COLLECTOR_TOKEN || process.env.MARKET_COLLECTOR_TOKEN || '').trim();
  if (!token) throw new Error('Missing MARKET_COLLECTOR_TOKEN or COLLECTOR_TOKEN');

  const collectorUrl = String(process.env.COLLECTOR_URL || DEFAULT_COLLECTOR_URL).trim();
  const perPage = positiveInt(process.env.SOLD_LISTING_PER_PAGE, DEFAULT_PER_PAGE, DEFAULT_PER_PAGE);
  const delayMs = positiveInt(process.env.BACKFILL_DELAY_MS, DEFAULT_DELAY_MS, 10000);
  const historyChunkSize = positiveInt(process.env.BACKFILL_HISTORY_CHUNK_SIZE, DEFAULT_HISTORY_CHUNK_SIZE, 25);
  const { maxPages, requestedAll } = parsePageLimit(process.env.SOLD_LISTING_MAX_PAGES || process.env.MAX_PAGES);
  const startIndex = Math.max(0, Number(process.env.BACKFILL_START_INDEX || 0) || 0);
  const cardLimit = Math.max(0, Number(process.env.BACKFILL_CARD_LIMIT || 0) || 0);
  const progressPath = String(process.env.BACKFILL_PROGRESS_PATH || '').trim();
  const allowedConditions = acceptedConditionKeys();
  const allTargets = await buildTargets();
  const targets = allTargets.slice(startIndex, cardLimit ? startIndex + cardLimit : undefined);
  const summary = {
    scope: process.env.BACKFILL_SCOPE || 'approved',
    totalTargets: allTargets.length,
    startIndex,
    selectedTargets: targets.length,
    maxPages,
    requestedAll,
    perPage,
    historyChunkSize,
    pagesFetched: 0,
    listingsSeen: 0,
    soldSeen: 0,
    historyPosted: 0,
    tradesSeen: 0,
    tradesStored: 0,
    dailyPointsUpdated: 0,
    failed: 0,
    capped: 0,
  };

  console.log(JSON.stringify({ event: 'start', ...summary }));

  for (let index = 0; index < targets.length; index += 1) {
    const item = targets[index];
    try {
      const result = await backfillItem(item, {
        collectorUrl,
        token,
        perPage,
        maxPages,
        delayMs,
        historyChunkSize,
        allowedConditions,
      });
      summary.pagesFetched += result.pagesFetched;
      summary.listingsSeen += result.listingsSeen;
      summary.soldSeen += result.soldSeen;
      summary.historyPosted += result.historyPosted;
      summary.tradesSeen += result.tradesSeen;
      summary.tradesStored += result.tradesStored;
      summary.dailyPointsUpdated += result.dailyPointsUpdated;
      if (result.capped) summary.capped += 1;
      const payload = { event: 'card', index: startIndex + index, selectedIndex: index, ...result };
      console.log(JSON.stringify(payload));
      await appendProgress(progressPath, payload);
    } catch (error) {
      summary.failed += 1;
      const payload = {
        event: 'card_failed',
        index: startIndex + index,
        selectedIndex: index,
        apparelId: Number(item?.apparelId || 0),
        code: item?.code || '',
        error: error?.message || 'failed',
      };
      console.error(JSON.stringify(payload));
      await appendProgress(progressPath, payload);
      await sleep(2000);
    }
  }

  console.log(JSON.stringify({ event: 'done', ...summary }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'fatal', error: error?.message || 'failed' }));
  process.exitCode = 1;
});
