import { appendFile } from 'node:fs/promises';
import fs from 'node:fs';
import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';
import { buildFilteredDailyRows } from '../lib/market-outlier-filter.js';

const SNKRDUNK_BASE = 'https://snkrdunk.com';
const DEFAULT_COLLECTOR_URL = 'https://www.optcgkorea.com/api/market-collector';
const DEFAULT_PER_PAGE = 50;
const DEFAULT_TRADING_HISTORY_PER_PAGE = 12;
const DEFAULT_TRADING_HISTORY_MAX_PAGES = 120;
const DEFAULT_DELAY_MS = 250;
const DEFAULT_HISTORY_CHUNK_SIZE = 10;
const DEFAULT_RECENT_RAW_DAYS = 30;
const DEFAULT_DAILY_DAYS = 365;
const DEFAULT_SAFETY_MAX_PAGES = 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function loadEnvFile(filePath = '.env.local') {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim();
  }
}

loadEnvFile();

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

function parseEnabled(value, fallback = false) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(text);
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

function snkrdunkAuthHeaders() {
  const headers = {};
  const cookie = String(process.env.SNKRDUNK_COOKIE || process.env.SNKRDUNK_SESSION_COOKIE || '').trim();
  const authorization = String(process.env.SNKRDUNK_AUTHORIZATION || '').trim();
  const csrfToken = String(process.env.SNKRDUNK_X_CSRF_TOKEN || process.env.SNKRDUNK_CSRF_TOKEN || '').trim();
  if (cookie) headers.Cookie = cookie;
  if (authorization) headers.Authorization = authorization;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return headers;
}

function hasSnkrdunkTradingHistoryAuth() {
  return Object.keys(snkrdunkAuthHeaders()).length > 0;
}

function snkrdunkJsonHeaders(authenticated = false) {
  return {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 CardPoneBot/1.0',
    ...(authenticated ? snkrdunkAuthHeaders() : {}),
  };
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

async function insertRows(tableName, columns, rows, conflictSql, chunkSize = 40) {
  if (!rows.length) return 0;
  const safeChunkSize = Math.max(1, Math.min(chunkSize, Math.floor(96 / columns.length)));
  let written = 0;
  for (let start = 0; start < rows.length; start += safeChunkSize) {
    const chunk = rows.slice(start, start + safeChunkSize);
    const valuesSql = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const params = chunk.flatMap((row) => columns.map((column) => row[column]));
    await queryD1(
      `insert into ${tableName} (${columns.join(',')}) values ${valuesSql} ${conflictSql}`,
      params,
    );
    written += chunk.length;
  }
  return written;
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

function normalizeMissingCondition(value) {
  const condition = String(value || '').trim().toLowerCase();
  if (condition === 'a') return 'single';
  return ['any', 'single', 'psa10', 'either'].includes(condition) ? condition : 'none';
}

async function filterTargetsByMissingCondition(targets) {
  const missingCondition = normalizeMissingCondition(process.env.BACKFILL_MISSING_CONDITION);
  if (missingCondition === 'none' || !targets.length) return targets;
  if (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID) {
    throw new Error('Missing-condition filtering requires Cloudflare D1 credentials');
  }

  const rows = await queryD1(`
    SELECT apparel_id,
           MAX(CASE WHEN condition_key = 'a' THEN 1 ELSE 0 END) AS has_single,
           MAX(CASE WHEN condition_key = 'psa10' THEN 1 ELSE 0 END) AS has_psa10
    FROM market_chart_daily_points
    WHERE source = 'snkrdunk'
      AND condition_key IN ('a', 'psa10')
    GROUP BY apparel_id
  `);
  const coverageById = new Map(rows.map((row) => [Number(row.apparel_id || 0), {
    single: Number(row.has_single || 0) > 0,
    psa10: Number(row.has_psa10 || 0) > 0,
  }]));

  return targets.filter((item) => {
    const coverage = coverageById.get(Number(item.apparelId)) || { single: false, psa10: false };
    if (missingCondition === 'single') return !coverage.single;
    if (missingCondition === 'psa10') return !coverage.psa10;
    if (missingCondition === 'either') return !coverage.single || !coverage.psa10;
    return !coverage.single && !coverage.psa10;
  });
}

async function buildTargets() {
  const explicitIds = parseIds(process.env.APPAREL_IDS || process.env.BACKFILL_APPAREL_IDS);
  const scope = String(process.env.BACKFILL_SCOPE || 'approved').trim().toLowerCase();
  const allMarketCards = uniqueByApparelId((Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => item?.apparelId));
  const byApparelId = new Map(allMarketCards.map((item) => [Number(item.apparelId), item]));

  if (explicitIds.length) {
    return filterTargetsByMissingCondition(explicitIds.map((apparelId) => byApparelId.get(apparelId) || {
      source: 'snkrdunk',
      apparelId,
      locale: 'JP',
      code: '',
      name: '',
    }));
  }

  const jpMarketCards = allMarketCards.filter((item) => item?.locale === 'JP');
  if (scope === 'all-jp') return filterTargetsByMissingCondition(jpMarketCards);
  if (scope === 'all-market' || scope === 'all') return filterTargetsByMissingCondition(allMarketCards);

  const approvedIds = new Set((Array.isArray(cardMarketLinks) ? cardMarketLinks : [])
    .filter((link) => link?.locale === 'JP' && link?.status === 'approved' && link?.apparelId)
    .map((link) => Number(link.apparelId)));
  for (const apparelId of await fetchApprovedOverrideIds()) approvedIds.add(apparelId);
  return filterTargetsByMissingCondition(jpMarketCards.filter((item) => approvedIds.has(Number(item.apparelId))));
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

function newestSoldListingDateKey(listings = []) {
  let newest = 0;
  for (const listing of listings || []) {
    if (!listing?.isSold) continue;
    newest = Math.max(newest, listingTimestamp(listing));
  }
  return newest > 0 ? dateKeyKst(newest) : '';
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

function tradeDateTimestamp(value) {
  const rawText = String(value || '').trim();
  if (!rawText) return 0;
  const directParsed = Date.parse(rawText);
  if (Number.isFinite(directParsed)) return directParsed;

  const text = rawText.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
  const englishDate = text.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})$/);
  if (englishDate) {
    const month = new Date(`${englishDate[1]} 1, 2000 UTC`).getUTCMonth();
    if (Number.isFinite(month)) {
      return Date.UTC(Number(englishDate[3]), month, Number(englishDate[2]));
    }
  }

  const parsed = Date.parse(`${text} UTC`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tradeDateKey(value) {
  const timestamp = tradeDateTimestamp(value);
  return timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : '';
}

function tradingHistoryDateText(row) {
  return String(
    row?.tradedAt
    || row?.traded_at
    || row?.tradeDate
    || row?.trade_date
    || row?.date
    || row?.dateText
    || ''
  ).trim();
}

function tradingHistoryConditionName(row) {
  return String(row?.condition || row?.conditionName || row?.condition_name || row?.grade || '').trim();
}

function tradingHistoryPriceText(row) {
  return String(row?.priceFormat || row?.priceText || row?.price_text || row?.price || row?.amount || '').trim();
}

function parsePriceAmountJpy(trade) {
  const text = String(trade?.priceText || trade?.price || trade?.amount || '');
  const numberMatch = text.match(/([\d,]+(?:\.\d+)?)/);
  const parsedTextAmount = numberMatch ? Number(numberMatch[1].replace(/,/g, '')) : 0;
  const hasYenSymbol = text.includes(String.fromCharCode(165)) || text.includes(String.fromCharCode(20870));
  const hasWonSymbol = text.includes(String.fromCharCode(8361)) || text.includes(String.fromCharCode(50896));
  if (parsedTextAmount > 0 && /US\s*\$/i.test(text)) return Math.round(parsedTextAmount * Number(process.env.USD_TO_JPY || 155));
  if (parsedTextAmount > 0 && (/\bJPY\b/i.test(text) || hasYenSymbol)) return Math.round(parsedTextAmount);
  if (parsedTextAmount > 0 && (/\bKRW\b/i.test(text) || hasWonSymbol)) {
    return Math.round(parsedTextAmount / Number(process.env.KRW_PER_JPY || 9.3));
  }
  const directJpy = Number(trade?.priceJpy || trade?.jpy || trade?.price_jpy || 0);
  return Number.isFinite(directJpy) && directJpy > 0 ? Math.round(directJpy) : 0;
}

function recentRawCutoffDate(days) {
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  kstNow.setUTCDate(kstNow.getUTCDate() - days);
  return kstNow.toISOString().slice(0, 10);
}

function isRecentHistoryItem(historyItem, cutoffDate) {
  return String(historyItem?.date || '').slice(0, 10) >= cutoffDate;
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
    headers: snkrdunkJsonHeaders(false),
  });
  return [
    data?.usedListings,
    data?.used_listings,
    data?.listings,
    data?.items,
  ].find(Array.isArray) || [];
}

async function fetchTradingHistoriesPage(apparelId, page, perPage) {
  const productCode = `SW---${Number(apparelId)}`;
  const params = new URLSearchParams({
    perPage: String(perPage),
    page: String(page),
    used: 'true',
  });
  const data = await fetchJsonWithRetry(`${SNKRDUNK_BASE}/en/v1/products/${productCode}/trading-histories?${params.toString()}`, {
    headers: snkrdunkJsonHeaders(true),
  });
  return [
    data?.histories,
    data?.tradingHistories,
    data?.trading_histories,
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
      conditionKey: key,
      priceText,
      priceJpy: parsePriceAmountJpy({ priceText }),
      listingUid,
    });
  }

  return { history, soldSeen };
}

function historyFromTradingHistories(rows, allowedConditions) {
  const seen = new Set();
  const history = [];

  for (const row of rows || []) {
    const dateText = tradingHistoryDateText(row);
    const day = tradeDateKey(dateText);
    const condition = tradingHistoryConditionName(row);
    const key = conditionKey(condition);
    const priceText = tradingHistoryPriceText(row);
    const dedupeKey = `${dateText || day}|${key}|${priceText}`;
    if (!day || !condition || !priceText || !allowedConditions.has(key) || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    history.push({
      date: day,
      dateText: dateText || day,
      condition,
      conditionKey: key,
      priceText,
      priceJpy: parsePriceAmountJpy({ priceText }),
    });
  }

  return history;
}

function oldestTradingHistoryDateKey(rows = []) {
  const timestamps = rows
    .map((row) => tradeDateTimestamp(tradingHistoryDateText(row)))
    .filter((timestamp) => timestamp > 0);
  if (!timestamps.length) return '';
  return new Date(Math.min(...timestamps)).toISOString().slice(0, 10);
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

function addDailyHistory(dailyBuckets, item, history) {
  for (const trade of history) {
    const day = String(trade?.date || '').slice(0, 10);
    const condition = conditionKey(trade?.conditionKey || trade?.condition);
    const priceJpy = Number(trade?.priceJpy || parsePriceAmountJpy(trade));
    if (!day || !condition || !Number.isFinite(priceJpy) || priceJpy <= 0) continue;
    const key = `${condition}|${day}`;
    const bucket = dailyBuckets.get(key) || {
      source: 'snkrdunk',
      apparel_id: Number(item.apparelId),
      locale: String(item.locale || 'JP').toUpperCase(),
      code: item.code || '',
      condition_key: condition,
      point_date: day,
      prices: [],
    };
    bucket.prices.push(priceJpy);
    dailyBuckets.set(key, bucket);
  }
}

function buildDailyRows(dailyBuckets) {
  return buildFilteredDailyRows([...dailyBuckets.values()]);
}

async function upsertDailyRows(rows) {
  if (!rows.length) return 0;
  return insertRows('market_chart_daily_points', [
    'source',
    'apparel_id',
    'locale',
    'code',
    'condition_key',
    'point_date',
    'median_price_jpy',
    'min_price_jpy',
    'max_price_jpy',
    'trade_count',
    'source_count',
    'updated_at',
  ], rows, `
    on conflict(source, apparel_id, condition_key, point_date)
    do update set
      locale = excluded.locale,
      code = excluded.code,
      median_price_jpy = excluded.median_price_jpy,
      min_price_jpy = excluded.min_price_jpy,
      max_price_jpy = excluded.max_price_jpy,
      trade_count = excluded.trade_count,
      source_count = excluded.source_count,
      updated_at = excluded.updated_at
  `);
}

async function backfillTradingHistoryItem(item, options) {
  const result = {
    apparelId: Number(item.apparelId),
    code: item.code || '',
    historySource: 'trading-histories',
    pagesFetched: 0,
    listingsSeen: 0,
    soldSeen: 0,
    dailyRowsPrepared: 0,
    recentHistoryPrepared: 0,
    historyPosted: 0,
    tradesSeen: 0,
    tradesStored: 0,
    dailyPointsUpdated: 0,
    capped: false,
    stoppedAtDailyCutoff: false,
  };
  const dailyBuckets = new Map();
  const recentHistory = [];

  for (let page = 1; page <= options.tradingHistoryMaxPages; page += 1) {
    const rows = await fetchTradingHistoriesPage(item.apparelId, page, options.tradingHistoryPerPage);
    result.pagesFetched += 1;
    result.listingsSeen += rows.length;
    result.soldSeen += rows.length;

    if (!rows.length) break;

    const history = historyFromTradingHistories(rows, options.allowedConditions);
    if (options.aggregateMode) {
      addDailyHistory(dailyBuckets, item, history.filter((trade) => isRecentHistoryItem(trade, options.dailyCutoffDate)));
      recentHistory.push(...history.filter((trade) => isRecentHistoryItem(trade, options.recentRawCutoffDate)));
    } else if (history.length) {
      const posted = await postHistoryChunks(item, history, options);
      result.historyPosted += history.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
      result.dailyPointsUpdated += Number(posted?.dailyPointsUpdated || 0);
    }

    if (rows.length < options.tradingHistoryPerPage) break;
    const oldestDay = oldestTradingHistoryDateKey(rows);
    if (oldestDay && oldestDay < options.dailyCutoffDate) {
      result.stoppedAtDailyCutoff = true;
      break;
    }
    if (page === options.tradingHistoryMaxPages) result.capped = true;
    if (options.delayMs) await sleep(options.delayMs);
  }

  if (options.aggregateMode) {
    const dailyRows = buildDailyRows(dailyBuckets);
    result.dailyRowsPrepared = dailyRows.length;
    result.recentHistoryPrepared = recentHistory.length;
    result.dailyPointsUpdated = await upsertDailyRows(dailyRows);
    if (recentHistory.length) {
      const posted = await postHistoryChunks(item, recentHistory, options);
      result.historyPosted += recentHistory.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
    }
  }

  return result;
}

async function backfillItem(item, options) {
  if (options.useTradingHistories) {
    return backfillTradingHistoryItem(item, options);
  }

  const result = {
    apparelId: Number(item.apparelId),
    code: item.code || '',
    historySource: 'used-listings',
    pagesFetched: 0,
    listingsSeen: 0,
    soldSeen: 0,
    dailyRowsPrepared: 0,
    recentHistoryPrepared: 0,
    historyPosted: 0,
    tradesSeen: 0,
    tradesStored: 0,
    dailyPointsUpdated: 0,
    capped: false,
    stoppedAtDailyCutoff: false,
  };
  const dailyBuckets = new Map();
  const recentHistory = [];

  for (let page = 1; page <= options.maxPages; page += 1) {
    const listings = await fetchUsedListingsPage(item.apparelId, page, options.perPage);
    result.pagesFetched += 1;
    result.listingsSeen += listings.length;

    if (!listings.length) break;

    const { history, soldSeen } = historyFromListings(listings, options.allowedConditions);
    result.soldSeen += soldSeen;
    if (options.aggregateMode) {
      addDailyHistory(dailyBuckets, item, history.filter((trade) => isRecentHistoryItem(trade, options.dailyCutoffDate)));
      recentHistory.push(...history.filter((trade) => isRecentHistoryItem(trade, options.recentRawCutoffDate)));
    } else if (history.length) {
      const posted = await postHistoryChunks(item, history, options);
      result.historyPosted += history.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
      result.dailyPointsUpdated += Number(posted?.dailyPointsUpdated || 0);
    }

    if (listings.length < options.perPage) break;
    const newestSoldDay = newestSoldListingDateKey(listings);
    if (options.aggregateMode && newestSoldDay && newestSoldDay < options.dailyCutoffDate) {
      result.stoppedAtDailyCutoff = true;
      break;
    }
    if (page === options.maxPages) result.capped = true;
    if (options.delayMs) await sleep(options.delayMs);
  }

  if (options.aggregateMode) {
    const dailyRows = buildDailyRows(dailyBuckets);
    result.dailyRowsPrepared = dailyRows.length;
    result.recentHistoryPrepared = recentHistory.length;
    result.dailyPointsUpdated = await upsertDailyRows(dailyRows);
    if (recentHistory.length) {
      const posted = await postHistoryChunks(item, recentHistory, options);
      result.historyPosted += recentHistory.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
    }
  }

  return result;
}

async function main() {
  const token = String(process.env.COLLECTOR_TOKEN || process.env.MARKET_COLLECTOR_TOKEN || '').trim();
  if (!token) throw new Error('Missing MARKET_COLLECTOR_TOKEN or COLLECTOR_TOKEN');

  const collectorUrl = String(process.env.COLLECTOR_URL || DEFAULT_COLLECTOR_URL).trim();
  const mode = String(process.env.BACKFILL_MODE || 'raw').trim().toLowerCase();
  const aggregateMode = ['aggregate', 'daily', 'efficient'].includes(mode);
  if (aggregateMode && (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID)) {
    throw new Error('Aggregate mode requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and D1_DATABASE_ID');
  }
  const perPage = positiveInt(process.env.SOLD_LISTING_PER_PAGE, DEFAULT_PER_PAGE, DEFAULT_PER_PAGE);
  const delayMs = positiveInt(process.env.BACKFILL_DELAY_MS, DEFAULT_DELAY_MS, 10000);
  const historyChunkSize = positiveInt(process.env.BACKFILL_HISTORY_CHUNK_SIZE, DEFAULT_HISTORY_CHUNK_SIZE, 25);
  const recentRawDays = positiveInt(process.env.BACKFILL_RECENT_RAW_DAYS, DEFAULT_RECENT_RAW_DAYS, 365);
  const recentRawCutoff = recentRawCutoffDate(recentRawDays);
  const dailyDays = positiveInt(process.env.BACKFILL_DAILY_DAYS, DEFAULT_DAILY_DAYS, 3650);
  const dailyCutoff = recentRawCutoffDate(dailyDays);
  const { maxPages, requestedAll } = parsePageLimit(process.env.SOLD_LISTING_MAX_PAGES || process.env.MAX_PAGES);
  const hasTradingHistoryAuth = hasSnkrdunkTradingHistoryAuth();
  const useTradingHistories = parseEnabled(process.env.BACKFILL_TRADING_HISTORIES, hasTradingHistoryAuth);
  if (useTradingHistories && !hasTradingHistoryAuth) {
    throw new Error('BACKFILL_TRADING_HISTORIES requires SNKRDUNK_COOKIE or SNKRDUNK_AUTHORIZATION');
  }
  const historySource = useTradingHistories ? 'trading-histories' : 'used-listings';
  const tradingHistoryPerPage = positiveInt(
    process.env.TRADING_HISTORY_PER_PAGE,
    DEFAULT_TRADING_HISTORY_PER_PAGE,
    100,
  );
  const tradingHistoryMaxPages = positiveInt(
    process.env.TRADING_HISTORY_MAX_PAGES,
    DEFAULT_TRADING_HISTORY_MAX_PAGES,
    500,
  );
  const startIndex = Math.max(0, Number(process.env.BACKFILL_START_INDEX || 0) || 0);
  const cardLimit = Math.max(0, Number(process.env.BACKFILL_CARD_LIMIT || 0) || 0);
  const progressPath = String(process.env.BACKFILL_PROGRESS_PATH || '').trim();
  const allowedConditions = acceptedConditionKeys();
  const allTargets = await buildTargets();
  const targets = allTargets.slice(startIndex, cardLimit ? startIndex + cardLimit : undefined);
  const summary = {
    mode,
    historySource,
    scope: process.env.BACKFILL_SCOPE || 'approved',
    missingCondition: normalizeMissingCondition(process.env.BACKFILL_MISSING_CONDITION),
    totalTargets: allTargets.length,
    startIndex,
    selectedTargets: targets.length,
    maxPages,
    requestedAll,
    perPage,
    tradingHistoryMaxPages,
    tradingHistoryPerPage,
    historyChunkSize,
    dailyDays,
    dailyCutoff,
    recentRawDays,
    recentRawCutoff,
    pagesFetched: 0,
    listingsSeen: 0,
    soldSeen: 0,
    dailyRowsPrepared: 0,
    recentHistoryPrepared: 0,
    historyPosted: 0,
    tradesSeen: 0,
    tradesStored: 0,
    dailyPointsUpdated: 0,
    failed: 0,
    capped: 0,
    stoppedAtDailyCutoff: 0,
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
        aggregateMode,
        useTradingHistories,
        tradingHistoryMaxPages,
        tradingHistoryPerPage,
        dailyCutoffDate: dailyCutoff,
        recentRawCutoffDate: recentRawCutoff,
        allowedConditions,
      });
      summary.pagesFetched += result.pagesFetched;
      summary.listingsSeen += result.listingsSeen;
      summary.soldSeen += result.soldSeen;
      summary.dailyRowsPrepared += result.dailyRowsPrepared;
      summary.recentHistoryPrepared += result.recentHistoryPrepared;
      summary.historyPosted += result.historyPosted;
      summary.tradesSeen += result.tradesSeen;
      summary.tradesStored += result.tradesStored;
      summary.dailyPointsUpdated += result.dailyPointsUpdated;
      if (result.capped) summary.capped += 1;
      if (result.stoppedAtDailyCutoff) summary.stoppedAtDailyCutoff += 1;
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
        historySource,
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
