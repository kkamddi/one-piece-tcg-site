import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';
import { collectMarketSnapshot } from './market.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 8;
const SNKRDUNK_BASE = 'https://snkrdunk.com';
const DEFAULT_SOLD_LISTING_PAGES = 1;
const MAX_SOLD_LISTING_PAGES = 50;
const DEFAULT_SOLD_LISTING_PER_PAGE = 50;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const D1_BINDING_NAME = String(process.env.MARKET_D1_BINDING || 'OPTCG_PUBLIC_D1').trim();

function getD1Binding() {
  const binding = process.env?.[D1_BINDING_NAME] || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

async function queryD1(sql, params = []) {
  const binding = getD1Binding();
  if (!binding) return [];
  const statement = binding.prepare(sql);
  const result = params.length ? await statement.bind(...params).all() : await statement.all();
  return result?.results || [];
}

async function runD1(sql, params = []) {
  const binding = getD1Binding();
  if (!binding) throw new Error('d1_not_configured');
  const statement = binding.prepare(sql);
  return params.length ? statement.bind(...params).run() : statement.run();
}

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

function parseApparelIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => Number(String(id).trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parseEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function positiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function soldListingPageLimit(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['all', 'full', 'max', '*'].includes(text)) return MAX_SOLD_LISTING_PAGES;
  return positiveInt(value, DEFAULT_SOLD_LISTING_PAGES, MAX_SOLD_LISTING_PAGES);
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function conditionKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'a' || text === 'single') return 'a';
  if (text === 'psa 10' || text === 'psa10') return 'psa10';
  return text.replace(/\s+/g, '_') || 'unknown';
}

function parseTradeDate(value) {
  const text = String(value || '').replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const englishDate = text.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})$/);
  if (englishDate) {
    const month = new Date(`${englishDate[1]} 1, 2000 UTC`).getUTCMonth();
    if (Number.isFinite(month)) {
      return new Date(Date.UTC(Number(englishDate[3]), month, Number(englishDate[2]))).toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(`${text} UTC`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function parsePriceAmountJpy(trade, usdToJpy) {
  const text = String(trade?.priceText || trade?.price || trade?.amount || '');
  const numberMatch = text.match(/([\d,]+(?:\.\d+)?)/);
  const parsedTextAmount = numberMatch ? Number(numberMatch[1].replace(/,/g, '')) : 0;
  const hasYenSymbol = text.includes(String.fromCharCode(165)) || text.includes(String.fromCharCode(20870));
  const hasWonSymbol = text.includes(String.fromCharCode(8361)) || text.includes(String.fromCharCode(50896));
  if (parsedTextAmount > 0 && /US\s*\$/i.test(text)) return Math.round(parsedTextAmount * usdToJpy);
  if (parsedTextAmount > 0 && (/\bJPY\b/i.test(text) || hasYenSymbol)) return Math.round(parsedTextAmount);
  if (parsedTextAmount > 0 && (/\bKRW\b/i.test(text) || hasWonSymbol)) {
    const krwPerJpy = Number(process.env.KRW_PER_JPY || 9.3);
    return Math.round(parsedTextAmount / krwPerJpy);
  }

  const direct = Number(trade?.priceUsd || trade?.usd || trade?.price_usd || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct * usdToJpy);
  const directJpy = Number(trade?.priceJpy || trade?.jpy || trade?.price_jpy || 0);
  return Number.isFinite(directJpy) && directJpy > 0 ? Math.round(directJpy) : 0;
}

let supportsListingUidDedupe = true;

async function deleteExistingListingUidTrade({ source, apparelId, condition, listingUid }) {
  if (!listingUid || !supportsListingUidDedupe) return;
  try {
    await runD1(`
      DELETE FROM market_recent_trades
      WHERE source = ?
        AND apparel_id = ?
        AND condition_key = ?
        AND raw_payload_json IS NOT NULL
        AND json_extract(raw_payload_json, '$.listingUid') = ?
    `, [source, apparelId, condition, listingUid]);
  } catch {
    supportsListingUidDedupe = false;
  }
}

function recentRawCutoffDate() {
  const days = positiveInt(process.env.MARKET_RECENT_TRADE_RAW_DAYS, 45, 365);
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  kstNow.setUTCDate(kstNow.getUTCDate() - days);
  return kstNow.toISOString().slice(0, 10);
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
  const response = await fetch(`${SNKRDUNK_BASE}/en/v1/products/${productCode}/used-listings?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 CardPoneBot/1.0'
    }
  });
  if (!response.ok) {
    throw new Error(`used_listings_${response.status}`);
  }
  const data = await response.json();
  return [
    data?.usedListings,
    data?.used_listings,
    data?.listings,
    data?.items,
  ].find(Array.isArray) || [];
}

async function fetchSoldListingHistory(item, options = {}) {
  const apparelId = Number(item?.apparelId || 0);
  if (!apparelId) return { history: [], pagesFetched: 0, listingsSeen: 0, soldSeen: 0 };

  const pages = soldListingPageLimit(options.soldListingPages);
  const perPage = positiveInt(options.soldListingPerPage, DEFAULT_SOLD_LISTING_PER_PAGE, DEFAULT_SOLD_LISTING_PER_PAGE);
  const seen = new Set();
  const history = [];
  let pagesFetched = 0;
  let listingsSeen = 0;
  let soldSeen = 0;

  for (let page = 1; page <= pages; page += 1) {
    const listings = await fetchUsedListingsPage(apparelId, page, perPage);
    pagesFetched += 1;
    listingsSeen += listings.length;
    if (!listings.length) break;

    for (const listing of listings) {
      if (!listing?.isSold) continue;
      soldSeen += 1;
      const timestamp = listingTimestamp(listing);
      const day = dateKeyKst(timestamp);
      const dateText = dateTimeTextKst(timestamp) || day;
      const condition = listingConditionName(listing);
      const priceText = listingPriceText(listing);
      const listingUid = String(listing?.listingUID || listing?.listingUid || listing?.id || '');
      const dedupeKey = `${listingUid || `${day}|${condition}|${priceText}`}`;
      if (!day || !condition || !priceText || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      history.push({
        date: day,
        dateText,
        condition,
        priceText,
        listingUid,
      });
    }
    if (listings.length < perPage) break;
  }

  return { history, pagesFetched, listingsSeen, soldSeen };
}

function inferHistoryItem(rawItem) {
  const url = String(rawItem?.url || rawItem?.sourceUrl || rawItem?.source_url || '');
  const apparelId = Number(rawItem?.apparelId || rawItem?.apparel_id || url.match(/trading-cards\/(\d+)/)?.[1] || 0);
  const title = String(rawItem?.title || rawItem?.name || '');
  const code = String(rawItem?.code || title.match(/\[([A-Z0-9-]+)\]/i)?.[1] || '').toUpperCase();
  return {
    source: 'snkrdunk',
    apparelId,
    locale: String(rawItem?.locale || 'JP').toUpperCase(),
    code,
  };
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function upsertDailyPoint({ source, apparelId, locale, code, condition, day }) {
  const rows = await queryD1(`
    SELECT price_amount_jpy AS price
    FROM market_recent_trades
    WHERE source = ?
      AND apparel_id = ?
      AND condition_key = ?
      AND trade_date = ?
      AND price_amount_jpy > 0
  `, [source, apparelId, condition, day]);
  const values = rows.map((row) => Number(row.price || 0)).filter((value) => value > 0);
  if (!values.length) return false;

  const now = new Date().toISOString();
  await runD1(`
    INSERT INTO market_chart_daily_points (
      source, apparel_id, locale, code, condition_key, point_date,
      median_price_jpy, min_price_jpy, max_price_jpy,
      trade_count, source_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, apparel_id, condition_key, point_date)
    DO UPDATE SET
      locale = excluded.locale,
      code = excluded.code,
      median_price_jpy = excluded.median_price_jpy,
      min_price_jpy = excluded.min_price_jpy,
      max_price_jpy = excluded.max_price_jpy,
      trade_count = excluded.trade_count,
      source_count = excluded.source_count,
      updated_at = excluded.updated_at
  `, [
    source,
    apparelId,
    locale,
    code,
    condition,
    day,
    median(values),
    Math.min(...values),
    Math.max(...values),
    values.length,
    values.length,
    now,
  ]);
  return true;
}

async function ingestHistoryPayload(body) {
  const normalized = normalizeBody(body);
  const items = Array.isArray(normalized) ? normalized : Array.isArray(normalized.items) ? normalized.items : [normalized];
  const usdToJpy = Number(process.env.USD_TO_JPY || 155);
  const rawCutoffDate = recentRawCutoffDate();
  const touched = new Map();
  let tradesSeen = 0;
  let tradesStored = 0;

  for (const rawItem of items) {
    const item = inferHistoryItem(rawItem);
    const history = Array.isArray(rawItem?.history) ? rawItem.history : [];
    if (!item.apparelId || !history.length) continue;

    for (const trade of history) {
      const day = parseTradeDate(trade?.date || trade?.dateText || trade?.tradeDate);
      const condition = conditionKey(trade?.condition || trade?.conditionName || trade?.grade);
      const priceJpy = parsePriceAmountJpy(trade, usdToJpy);
      if (!day || !condition || !priceJpy) continue;

      tradesSeen += 1;
      if (day < rawCutoffDate) continue;

      const now = new Date().toISOString();
      const priceText = trade?.priceText || trade?.price || trade?.amount || `JPY ${priceJpy}`;
      const listingUid = String(trade?.listingUid || trade?.listingUID || '').trim();
      const rawPayload = JSON.stringify({
        date: trade?.dateText || trade?.date || day,
        condition: trade?.condition || trade?.conditionName || trade?.grade || condition,
        priceJpy,
        priceText,
        listingUid,
      });

      await deleteExistingListingUidTrade({
        source: item.source,
        apparelId: item.apparelId,
        condition,
        listingUid,
      });

      const insertResult = await runD1(`
        INSERT OR IGNORE INTO market_recent_trades (
          source, apparel_id, locale, code, condition_key,
          trade_date, trade_date_text, price_amount_jpy, price_text,
          first_seen_at, last_seen_at, raw_payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.source,
        item.apparelId,
        item.locale,
        item.code,
        condition,
        day,
        trade?.dateText || trade?.date || day,
        priceJpy,
        priceText,
        now,
        now,
        rawPayload,
      ]);

      await runD1(`
        UPDATE market_recent_trades
        SET last_seen_at = ?, raw_payload_json = ?
        WHERE source = ?
          AND apparel_id = ?
          AND condition_key = ?
          AND trade_date_text = ?
          AND price_amount_jpy = ?
      `, [
        now,
        rawPayload,
        item.source,
        item.apparelId,
        condition,
        trade?.dateText || trade?.date || day,
        priceJpy,
      ]);

      const insertedRows = Number(insertResult?.meta?.changes ?? insertResult?.changes ?? 1);
      if (insertedRows > 0) tradesStored += 1;
      touched.set(`${item.source}|${item.apparelId}|${condition}|${day}`, {
        source: item.source,
        apparelId: item.apparelId,
        locale: item.locale,
        code: item.code,
        condition,
        day,
      });
    }
  }

  let dailyPointsUpdated = 0;
  for (const point of touched.values()) {
    if (await upsertDailyPoint(point)) dailyPointsUpdated += 1;
  }

  return {
    ok: true,
    mode: 'history',
    items: items.length,
    tradesSeen,
    tradesStored,
    dailyPointsUpdated,
  };
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
  } catch {
    return [];
  }
}

async function buildTargetItems(scope = 'approved', explicitApparelIds = []) {
  const allMarketCards = uniqueByApparelId((Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => item?.apparelId));
  if (explicitApparelIds.length) {
    const requestedIds = new Set(explicitApparelIds);
    return allMarketCards.filter((item) => requestedIds.has(Number(item.apparelId)));
  }

  const jpMarketCards = allMarketCards.filter((item) => item?.locale === 'JP');
  const enMarketCards = allMarketCards.filter((item) => item?.locale === 'EN');
  if (scope === 'all-jp') return jpMarketCards;
  if (scope === 'all-en') return enMarketCards;
  if (scope === 'all-market' || scope === 'all') return allMarketCards;

  const byApparelId = new Map(jpMarketCards.map((item) => [Number(item.apparelId), item]));
  const approvedIds = new Set((Array.isArray(cardMarketLinks) ? cardMarketLinks : [])
    .filter((link) => link?.locale === 'JP' && link?.status === 'approved' && link?.apparelId)
    .map((link) => Number(link.apparelId)));
  for (const apparelId of await fetchApprovedOverrideIds()) {
    approvedIds.add(apparelId);
  }

  return jpMarketCards.filter((item) => approvedIds.has(Number(item.apparelId)) && byApparelId.has(Number(item.apparelId)));
}

async function collectBatch(items, concurrency = DEFAULT_CONCURRENCY, options = {}) {
  const result = {
    collected: 0,
    priced: 0,
    failed: 0,
    soldListingPagesFetched: 0,
    soldListingsSeen: 0,
    soldTradesSeen: 0,
    soldTradesStored: 0,
    soldDailyPointsUpdated: 0,
    soldListingFailed: 0,
    errors: []
  };
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      try {
        const collected = await collectMarketSnapshot(item, options);
        result.collected += 1;
        if (collected.ok) result.priced += 1;
        if (options.collectSoldListings) {
          try {
            const soldHistory = await fetchSoldListingHistory(item, options);
            result.soldListingPagesFetched += soldHistory.pagesFetched;
            result.soldListingsSeen += soldHistory.listingsSeen;
            result.soldTradesSeen += soldHistory.soldSeen;
            if (soldHistory.history.length) {
              const ingested = await ingestHistoryPayload({ ...item, history: soldHistory.history });
              result.soldTradesStored += Number(ingested?.tradesStored || 0);
              result.soldDailyPointsUpdated += Number(ingested?.dailyPointsUpdated || 0);
            }
          } catch (error) {
            result.soldListingFailed += 1;
            if (result.errors.length < 5) {
              result.errors.push({
                apparelId: item?.apparelId || '',
                code: item?.code || '',
                error: `sold_listings:${error?.message || 'collect_failed'}`
              });
            }
          }
        }
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

  const mode = String(request.query?.mode || request.query?.action || '').toLowerCase();
  if (mode === 'history' || mode === 'trades') {
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'history_ingest_requires_post' });
    }
    try {
      const result = await ingestHistoryPayload(request.body);
      return response.status(200).json(result);
    } catch (error) {
      return response.status(500).json({ error: error?.message || 'history_ingest_failed' });
    }
  }

  const scope = String(request.query?.scope || 'approved');
  const explicitApparelIds = parseApparelIds(request.query?.apparelIds || request.query?.apparelId);
  const allTargets = await buildTargetItems(scope, explicitApparelIds);
  const offset = Math.max(0, Number(request.query?.offset || 0) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(request.query?.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT));
  const concurrency = Math.min(MAX_CONCURRENCY, Math.max(1, Number(request.query?.concurrency || DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY));
  const persistListingSnapshot = parseEnabled(request.query?.listingSnapshots);
  const collectSoldListings = parseEnabled(request.query?.soldListings || request.query?.recentTrades);
  const soldListingPages = soldListingPageLimit(request.query?.soldListingPages);
  const soldListingPerPage = positiveInt(request.query?.soldListingPerPage, DEFAULT_SOLD_LISTING_PER_PAGE, DEFAULT_SOLD_LISTING_PER_PAGE);
  const batch = allTargets.slice(offset, offset + limit);
  const batchResult = await collectBatch(batch, concurrency, {
    persistListingSnapshot,
    collectSoldListings,
    soldListingPages,
    soldListingPerPage
  });
  const nextOffset = offset + batch.length;

  return response.status(200).json({
    ok: true,
    scope,
    total: allTargets.length,
    offset,
    limit,
    concurrency,
    listingSnapshots: persistListingSnapshot,
    soldListings: collectSoldListings,
    soldListingPages,
    soldListingPerPage,
    nextOffset,
    done: nextOffset >= allTargets.length,
    ...batchResult
  });
}
