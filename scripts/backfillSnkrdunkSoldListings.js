import { appendFile } from 'node:fs/promises';
import fs from 'node:fs';
import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';
import {
  auditFilteredDailyCoverage,
  buildFilteredDailyRows,
  medianNumber
} from '../lib/market-outlier-filter.js';
import {
  buildInitialPriceFormationSeries,
  filterUnsupportedObservedPricePoints
} from '../lib/market-index-chain.js';
import { marketDateKeyFromTimestamp, marketTradeDateKey } from '../lib/market-trade-date.js';

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
  return marketTradeDateKey(value);
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
  const seenIds = new Set();
  const history = [];

  for (const row of rows || []) {
    const dateText = tradingHistoryDateText(row);
    const day = tradeDateKey(dateText);
    const condition = tradingHistoryConditionName(row);
    const key = conditionKey(condition);
    const priceText = tradingHistoryPriceText(row);
    const historyId = String(
      row?.id || row?.historyId || row?.history_id || row?.tradeId || row?.trade_id || row?.transactionId || row?.transaction_id || '',
    ).trim();
    if (!day || !condition || !priceText || !allowedConditions.has(key) || (historyId && seenIds.has(historyId))) continue;
    if (historyId) seenIds.add(historyId);
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
  return marketDateKeyFromTimestamp(Math.min(...timestamps));
}

async function postHistory(item, history, collectorUrl, token, rawOnly = false) {
  const separator = collectorUrl.includes('?') ? '&' : '?';
  const dailyMode = rawOnly ? '&daily=0' : '';
  return fetchJsonWithRetry(`${collectorUrl}${separator}mode=history${dailyMode}`, {
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
    const posted = await postHistory(item, chunk, options.collectorUrl, options.token, options.rawOnly);
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

function buildUnfilteredDailyRows(dailyBuckets) {
  return [...dailyBuckets.values()].map((bucket) => {
    const prices = bucket.prices
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!prices.length) return null;
    return {
      ...bucket,
      median_price_jpy: medianNumber(prices),
      min_price_jpy: Math.min(...prices),
      max_price_jpy: Math.max(...prices),
      trade_count: prices.length,
      source_count: prices.length,
    };
  }).filter(Boolean);
}

function sourceFormationAudit(rows, condition = 'psa10') {
  const sourceObserved = rows
    .filter((row) => row.condition_key === condition)
    .map((row) => ({
      date: row.point_date,
      price: Number(row.median_price_jpy || 0),
      tradeCount: Number(row.trade_count || 0)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sourceObserved.length) return null;

  const observed = filterUnsupportedObservedPricePoints(sourceObserved);
  const baseline = buildInitialPriceFormationSeries(observed);
  const latest = observed.at(-1);
  return {
    sourceEarliestDate: sourceObserved[0].date,
    sourceEarliestPrice: sourceObserved[0].price,
    earliestDate: observed[0]?.date || '',
    latestDate: latest?.date || '',
    tradingDays: observed.length,
    tradeCount: observed.reduce((sum, row) => sum + Number(row.tradeCount || 0), 0),
    ignoredTradingDays: sourceObserved.length - observed.length,
    initialTradingDays: observed.slice(0, 5),
    latestPrice: Number(latest?.price || 0),
    formation: baseline.series.length ? {
      startDate: baseline.firstObservedDate,
      endDate: baseline.baselineDate,
      tradingDays: baseline.supportedObservationCount,
      tradeCount: baseline.supportedTradeCount,
      baselinePrice: baseline.baselinePrice
    } : null,
    exclusionReason: baseline.reason,
    individualIndex: baseline.baselinePrice > 0 && latest?.price > 0
      ? Number((100 * latest.price / baseline.baselinePrice).toFixed(2))
      : null,
  };
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

function parseDateKey(value) {
  const text = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

async function pruneMissingDailyRows(item, candidateRows, options) {
  const conditionKeys = [...options.allowedConditions];
  if (!conditionKeys.length) return 0;

  const placeholders = conditionKeys.map(() => '?').join(',');
  const existingRows = await queryD1(
    `select condition_key, point_date
     from market_chart_daily_points
     where source = 'snkrdunk'
       and apparel_id = ?
       and condition_key in (${placeholders})
       and point_date >= ?`,
    [Number(item.apparelId), ...conditionKeys, options.dailyCutoffDate],
  );
  const candidateKeys = new Set(candidateRows.map((row) => `${row.condition_key}|${row.point_date}`));
  const staleRows = existingRows.filter((row) => !candidateKeys.has(`${row.condition_key}|${row.point_date}`));

  for (const condition of conditionKeys) {
    const dates = staleRows
      .filter((row) => row.condition_key === condition)
      .map((row) => row.point_date);
    for (let start = 0; start < dates.length; start += 40) {
      const chunk = dates.slice(start, start + 40);
      const datePlaceholders = chunk.map(() => '?').join(',');
      await queryD1(
        `delete from market_chart_daily_points
         where source = 'snkrdunk'
           and apparel_id = ?
           and condition_key = ?
           and point_date in (${datePlaceholders})`,
        [Number(item.apparelId), condition, ...chunk],
      );
    }
  }

  return staleRows.length;
}

async function auditDailyRows(item, rows, options) {
  const conditionKeys = [...options.allowedConditions];
  if (!conditionKeys.length) {
    return {
      candidateRows: rows.length,
      existingRows: 0,
      unchangedRows: 0,
      priceChangedRows: 0,
      tradeCountChangedRows: 0,
      missingStoredRows: rows.length,
      missingCandidateRows: 0,
      maxMedianChangePercent: 0,
    };
  }

  const placeholders = conditionKeys.map(() => '?').join(',');
  const existingRows = await queryD1(
    `select condition_key, point_date, median_price_jpy, trade_count
     from market_chart_daily_points
     where source = 'snkrdunk'
       and apparel_id = ?
       and condition_key in (${placeholders})
       and point_date >= ?`,
    [Number(item.apparelId), ...conditionKeys, options.dailyCutoffDate]
  );
  const keyOf = (row) => `${row.condition_key}|${row.point_date}`;
  const existingByKey = new Map(existingRows.map((row) => [keyOf(row), row]));
  const candidateByKey = new Map(rows.map((row) => [keyOf(row), row]));
  let unchangedRows = 0;
  let priceChangedRows = 0;
  let tradeCountChangedRows = 0;
  let missingStoredRows = 0;
  let maxMedianChangePercent = 0;

  for (const [key, row] of candidateByKey) {
    const existing = existingByKey.get(key);
    if (!existing) {
      missingStoredRows += 1;
      continue;
    }
    const candidateMedian = Number(row.median_price_jpy || 0);
    const existingMedian = Number(existing.median_price_jpy || 0);
    const candidateTrades = Number(row.trade_count || 0);
    const existingTrades = Number(existing.trade_count || 0);
    const priceChanged = candidateMedian !== existingMedian;
    const tradeCountChanged = candidateTrades !== existingTrades;
    if (!priceChanged && !tradeCountChanged) unchangedRows += 1;
    if (priceChanged) {
      priceChangedRows += 1;
      if (existingMedian > 0) {
        maxMedianChangePercent = Math.max(maxMedianChangePercent, Math.abs((candidateMedian / existingMedian) - 1) * 100);
      }
    }
    if (tradeCountChanged) tradeCountChangedRows += 1;
  }

  let missingCandidateRows = 0;
  for (const key of existingByKey.keys()) {
    if (!candidateByKey.has(key)) missingCandidateRows += 1;
  }

  return {
    candidateRows: rows.length,
    existingRows: existingRows.length,
    unchangedRows,
    priceChangedRows,
    tradeCountChangedRows,
    missingStoredRows,
    missingCandidateRows,
    maxMedianChangePercent: Number(maxMedianChangePercent.toFixed(2)),
  };
}

async function finalizeAggregateHistory(item, dailyBuckets, recentHistory, result, options) {
  const rawDailyRows = buildUnfilteredDailyRows(dailyBuckets);
  const dailyRows = buildDailyRows(dailyBuckets);
  result.rawDailyRowsPrepared = rawDailyRows.length;
  result.dailyRowsPrepared = dailyRows.length;
  result.recentHistoryPrepared = recentHistory.length;
  result.semanticAudit = auditFilteredDailyCoverage(rawDailyRows, dailyRows);
  result.rawSourceAudits = {
    a: sourceFormationAudit(rawDailyRows, 'a'),
    psa10: sourceFormationAudit(rawDailyRows, 'psa10'),
  };
  result.sourceAudits = {
    a: sourceFormationAudit(dailyRows, 'a'),
    psa10: sourceFormationAudit(dailyRows, 'psa10'),
  };
  result.sourceAudit = result.sourceAudits.psa10;
  if (!result.semanticAudit.valid) {
    const reasons = result.semanticAudit.conditions
      .filter((item) => !item.valid)
      .map((item) => `${item.conditionKey}:${item.reasons.join('+')}`)
      .join(',');
    throw new Error(`Daily history semantic audit failed (${reasons})`);
  }
  if (options.dryRun) {
    result.audit = await auditDailyRows(item, dailyRows, options);
    return;
  }

  result.dailyPointsUpdated = await upsertDailyRows(dailyRows);
  if (options.replaceDailyWindow && result.dailyWindowComplete) {
    result.dailyPointsPruned = await pruneMissingDailyRows(item, dailyRows, options);
  }
  if (recentHistory.length) {
    const posted = await postHistoryChunks(item, recentHistory, { ...options, rawOnly: true });
    result.historyPosted += recentHistory.length;
    result.tradesSeen += Number(posted?.tradesSeen || 0);
    result.tradesStored += Number(posted?.tradesStored || 0);
  }
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
    dailyPointsPruned: 0,
    capped: false,
    stoppedAtDailyCutoff: false,
    dailyWindowComplete: false,
  };
  const dailyBuckets = new Map();
  const recentHistory = [];

  for (let page = 1; page <= options.tradingHistoryMaxPages; page += 1) {
    const rows = await fetchTradingHistoriesPage(item.apparelId, page, options.tradingHistoryPerPage);
    result.pagesFetched += 1;
    result.listingsSeen += rows.length;
    result.soldSeen += rows.length;

    if (!rows.length) {
      result.dailyWindowComplete = true;
      break;
    }

    const history = historyFromTradingHistories(rows, options.allowedConditions);
    if (options.aggregateMode) {
      addDailyHistory(dailyBuckets, item, history.filter((trade) => isRecentHistoryItem(trade, options.dailyCutoffDate)));
      recentHistory.push(...history.filter((trade) => isRecentHistoryItem(trade, options.recentRawCutoffDate)));
    } else if (!options.dryRun && history.length) {
      const posted = await postHistoryChunks(item, history, options);
      result.historyPosted += history.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
      result.dailyPointsUpdated += Number(posted?.dailyPointsUpdated || 0);
    }

    if (rows.length < options.tradingHistoryPerPage) {
      result.dailyWindowComplete = true;
      break;
    }
    const oldestDay = oldestTradingHistoryDateKey(rows);
    if (oldestDay && oldestDay < options.dailyCutoffDate) {
      result.stoppedAtDailyCutoff = true;
      result.dailyWindowComplete = true;
      break;
    }
    if (page === options.tradingHistoryMaxPages) result.capped = true;
    if (options.delayMs) await sleep(options.delayMs);
  }

  if (options.aggregateMode) {
    await finalizeAggregateHistory(item, dailyBuckets, recentHistory, result, options);
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
    dailyPointsPruned: 0,
    capped: false,
    stoppedAtDailyCutoff: false,
    dailyWindowComplete: false,
  };
  const dailyBuckets = new Map();
  const recentHistory = [];

  for (let page = 1; page <= options.maxPages; page += 1) {
    const listings = await fetchUsedListingsPage(item.apparelId, page, options.perPage);
    result.pagesFetched += 1;
    result.listingsSeen += listings.length;

    if (!listings.length) {
      result.dailyWindowComplete = true;
      break;
    }

    const { history, soldSeen } = historyFromListings(listings, options.allowedConditions);
    result.soldSeen += soldSeen;
    if (options.aggregateMode) {
      addDailyHistory(dailyBuckets, item, history.filter((trade) => isRecentHistoryItem(trade, options.dailyCutoffDate)));
      recentHistory.push(...history.filter((trade) => isRecentHistoryItem(trade, options.recentRawCutoffDate)));
    } else if (!options.dryRun && history.length) {
      const posted = await postHistoryChunks(item, history, options);
      result.historyPosted += history.length;
      result.tradesSeen += Number(posted?.tradesSeen || 0);
      result.tradesStored += Number(posted?.tradesStored || 0);
      result.dailyPointsUpdated += Number(posted?.dailyPointsUpdated || 0);
    }

    if (listings.length < options.perPage) {
      result.dailyWindowComplete = true;
      break;
    }
    const newestSoldDay = newestSoldListingDateKey(listings);
    if (options.aggregateMode && newestSoldDay && newestSoldDay < options.dailyCutoffDate) {
      result.stoppedAtDailyCutoff = true;
      result.dailyWindowComplete = true;
      break;
    }
    if (page === options.maxPages) result.capped = true;
    if (options.delayMs) await sleep(options.delayMs);
  }

  if (options.aggregateMode) {
    await finalizeAggregateHistory(item, dailyBuckets, recentHistory, result, options);
  }

  return result;
}

async function main() {
  const token = String(process.env.COLLECTOR_TOKEN || process.env.MARKET_COLLECTOR_TOKEN || '').trim();
  if (!token) throw new Error('Missing MARKET_COLLECTOR_TOKEN or COLLECTOR_TOKEN');

  const collectorUrl = String(process.env.COLLECTOR_URL || DEFAULT_COLLECTOR_URL).trim();
  const mode = String(process.env.BACKFILL_MODE || 'raw').trim().toLowerCase();
  const aggregateMode = ['aggregate', 'daily', 'efficient'].includes(mode);
  const dryRun = parseEnabled(process.env.BACKFILL_DRY_RUN, false);
  const replaceDailyWindow = parseEnabled(process.env.BACKFILL_REPLACE_DAILY_WINDOW, false);
  const requireCompleteDailyWindow = parseEnabled(process.env.BACKFILL_REQUIRE_COMPLETE_DAILY_WINDOW, false);
  if (aggregateMode && (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID)) {
    throw new Error('Aggregate mode requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and D1_DATABASE_ID');
  }
  const perPage = positiveInt(process.env.SOLD_LISTING_PER_PAGE, DEFAULT_PER_PAGE, DEFAULT_PER_PAGE);
  const delayMs = positiveInt(process.env.BACKFILL_DELAY_MS, DEFAULT_DELAY_MS, 10000);
  const historyChunkSize = positiveInt(process.env.BACKFILL_HISTORY_CHUNK_SIZE, DEFAULT_HISTORY_CHUNK_SIZE, 25);
  const recentRawDays = positiveInt(process.env.BACKFILL_RECENT_RAW_DAYS, DEFAULT_RECENT_RAW_DAYS, 365);
  const recentRawCutoff = recentRawCutoffDate(recentRawDays);
  const dailyDays = positiveInt(process.env.BACKFILL_DAILY_DAYS, DEFAULT_DAILY_DAYS, 3650);
  const dailyStartDate = parseDateKey(process.env.BACKFILL_DAILY_START_DATE);
  const dailyCutoff = dailyStartDate || recentRawCutoffDate(dailyDays);
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
    dryRun,
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
    dailyStartDate: dailyStartDate || null,
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
    dailyPointsPruned: 0,
    dailyWindowsComplete: 0,
    dailyWindowsIncomplete: 0,
    failed: 0,
    capped: 0,
    stoppedAtDailyCutoff: 0,
    auditCandidateRows: 0,
    auditExistingRows: 0,
    auditUnchangedRows: 0,
    auditPriceChangedRows: 0,
    auditTradeCountChangedRows: 0,
    auditMissingStoredRows: 0,
    auditMissingCandidateRows: 0,
    auditMaxMedianChangePercent: 0,
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
        dryRun,
        replaceDailyWindow,
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
      summary.dailyPointsPruned += result.dailyPointsPruned;
      if (result.dailyWindowComplete) summary.dailyWindowsComplete += 1;
      else summary.dailyWindowsIncomplete += 1;
      if (result.audit) {
        summary.auditCandidateRows += result.audit.candidateRows;
        summary.auditExistingRows += result.audit.existingRows;
        summary.auditUnchangedRows += result.audit.unchangedRows;
        summary.auditPriceChangedRows += result.audit.priceChangedRows;
        summary.auditTradeCountChangedRows += result.audit.tradeCountChangedRows;
        summary.auditMissingStoredRows += result.audit.missingStoredRows;
        summary.auditMissingCandidateRows += result.audit.missingCandidateRows;
        summary.auditMaxMedianChangePercent = Math.max(summary.auditMaxMedianChangePercent, result.audit.maxMedianChangePercent);
      }
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
  if (requireCompleteDailyWindow && (summary.failed > 0 || summary.dailyWindowsIncomplete > 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'fatal', error: error?.message || 'failed' }));
  process.exitCode = 1;
});
