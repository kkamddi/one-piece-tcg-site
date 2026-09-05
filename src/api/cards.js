import specialPromoCards from '../data/special-promo-cards';
const API_BASE = '/api/cards';
const CARD_CATALOG_REVISION = '2026-09-03-special-promos-v1';
const CARD_API_CACHE_TTL_MS = 5 * 60 * 1000;
let cardsFallbackPromise;
const responseCache = new Map();
const pendingRequests = new Map();

async function loadCardsFallback() {
  cardsFallbackPromise ??= import('../data/cards.json').then((module) => uniqueById([...module.default, ...specialPromoCards]));
  return cardsFallbackPromise;
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function hasHangul(value = '') {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value));
}

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function isCardNoQuery(value = '') {
  return /^(OP|ST|EB|PRB|P)-?\d/i.test(String(value).trim());
}

const CARD_COLOR_ALIASES = {
  red: 'red',
  '빨강': 'red',
  '적': 'red',
  '赤': 'red',
  green: 'green',
  '초록': 'green',
  '녹': 'green',
  '緑': 'green',
  blue: 'blue',
  '파랑': 'blue',
  '청': 'blue',
  '青': 'blue',
  purple: 'purple',
  '보라': 'purple',
  '자': 'purple',
  '紫': 'purple',
  black: 'black',
  '검정': 'black',
  '흑': 'black',
  '黒': 'black',
  yellow: 'yellow',
  '노랑': 'yellow',
  '황': 'yellow',
  '黄': 'yellow'
};

function normalizeCardColors(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .split(/[,/·・\s]+/)
    .map((item) => CARD_COLOR_ALIASES[item])
    .filter(Boolean);
}

function matchesCardFilters(card, filters = {}) {
  const requestedColors = new Set(normalizeCardColors(filters.color));
  const cardColors = normalizeCardColors([card.color, card.colorKo].filter(Boolean).join(','));
  const excludedCategory = normalizeSearch(filters.excludeCategory || '');
  return (!filters.locale || card.locale === filters.locale)
    && (!filters.series || card.series === filters.series)
    && (!filters.rarity || card.rarity === filters.rarity)
    && (!requestedColors.size || (cardColors.length && cardColors.every((color) => requestedColors.has(color))))
    && (!excludedCategory || ![card.category, card.categoryKo, card.type]
      .some((value) => normalizeSearch(value).includes(excludedCategory)));
}

function uniqueById(cards = []) {
  const seen = new Set();
  return cards.filter((card) => {
    if (!card?.id || seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function getCardKeySet(cards = []) {
  return new Set(cards.flatMap((card) => [card.baseCardNo, card.cardNo]).filter(Boolean));
}

function getJapaneseAliasQueries(value = '') {
  const query = String(value || '').normalize('NFKC').trim();
  const aliases = new Set();
  const hasJapaneseText = (text) => /[ぁ-んァ-ヶー一-龯]/.test(String(text || ''));
  if (hasJapaneseText(query) && /^[ぁ-んァ-ヶー一-龯・･·\s.．DＤ]+$/i.test(query) && query.replace(/[・･·\s.．]/g, '').length >= 2) {
    aliases.add(query);
  }
  const parts = query.split(/[・･·\s.．]+/).map((part) => part.trim()).filter(Boolean);
  const lastPart = parts.at(-1);
  const dNameMatch = query.match(/[DＤ][・･·\s.．]*([ァ-ヶー]+)$/i);

  if (lastPart && hasJapaneseText(lastPart) && lastPart.length >= 2 && lastPart !== query) aliases.add(lastPart);
  if (dNameMatch?.[1] && dNameMatch[1].length >= 2) aliases.add(dNameMatch[1]);

  return [...aliases];
}

function filterFallbackCards(cards, query, locale) {
  const keyword = normalizeSearch(query);
  const codeOnly = keyword && isCardNoQuery(query);
  return cards.filter((card) => {
    const matchesLocale = !locale || card.locale === locale;
    const matchesKeyword = (codeOnly
      ? [card.cardNo, card.baseCardNo, card.marketCode]
      : [card.cardNo, card.baseCardNo, card.name, card.type, card.seriesName, card.effect]
    ).some((value) =>
      normalizeSearch(value).includes(keyword)
    );
    return matchesLocale && matchesKeyword;
  });
}

async function safeFetchJson(url, fallback) {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.createdAt < CARD_API_CACHE_TTL_MS) {
    return cached.value;
  }
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }

  const request = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }
      const value = await response.json();
      responseCache.set(url, { value, createdAt: Date.now() });
      if (responseCache.size > 60) {
        const [oldestKey] = responseCache.keys();
        responseCache.delete(oldestKey);
      }
      return value;
    } catch (error) {
      console.warn(`Falling back for ${url}`, error);
      return typeof fallback === 'function' ? await fallback() : fallback;
    } finally {
      pendingRequests.delete(url);
    }
  })();

  pendingRequests.set(url, request);
  return request;
}

export async function fetchCards(filters = {}) {
  const url = `${API_BASE}${buildQuery({ ...filters, catalog: CARD_CATALOG_REVISION })}`;
  return safeFetchJson(url, async () => {
    const cardsFallback = await loadCardsFallback();
    const filtered = cardsFallback.filter((card) => matchesCardFilters(card, filters));
    const limit = Number(filters.limit || 0);
    const page = Math.max(1, Number(filters.page || 1));
    return limit > 0 ? filtered.slice((page - 1) * limit, page * limit) : filtered;
  });
}

export async function searchCards(query, locale) {
  const trimmed = query?.trim() ?? '';
  if (!trimmed) return [];

  const url = `${API_BASE}/search${buildQuery({ q: trimmed, locale, catalog: CARD_CATALOG_REVISION })}`;
  return safeFetchJson(url, async () => {
    const cardsFallback = await loadCardsFallback();
    const results = filterFallbackCards(cardsFallback, trimmed, locale);

    if (locale === 'JP' && hasHangul(trimmed)) {
      const krMatches = filterFallbackCards(cardsFallback, trimmed, 'KR');
      const normalizedHangulQuery = normalizeSearch(trimmed);
      const krNameMatches = krMatches.filter((card) => normalizeSearch(card.name).includes(normalizedHangulQuery));
      const matchedCardNos = getCardKeySet(krNameMatches.length ? krNameMatches : krMatches);
      const jpCards = cardsFallback.filter((card) => card.locale === 'JP');
      const aliasMatches = jpCards.filter((card) => (
        matchedCardNos.has(card.baseCardNo) || matchedCardNos.has(card.cardNo)
      ));
      const japaneseAliases = [...new Set(aliasMatches.flatMap((card) => getJapaneseAliasQueries(card.name)))];
      const expandedAliasMatches = japaneseAliases.flatMap((alias) => filterFallbackCards(jpCards, alias, 'JP'));
      return uniqueById([...results, ...(expandedAliasMatches.length ? expandedAliasMatches : aliasMatches)]);
    }

    if (locale === 'JP') {
      const aliasQueries = getJapaneseAliasQueries(trimmed);
      const aliasMatches = aliasQueries.flatMap((alias) => filterFallbackCards(cardsFallback, alias, locale));
      return uniqueById([...results, ...aliasMatches]);
    }

    return results;
  });
}

export async function fetchCardById(id) {
  if (!id) return null;

  const url = `${API_BASE}/${encodeURIComponent(id)}${buildQuery({ catalog: CARD_CATALOG_REVISION })}`;
  const card = await safeFetchJson(url, async () => {
    const cardsFallback = await loadCardsFallback();
    return cardsFallback.find((card) => card.id === id) ?? null;
  });
  if (card) return card;

  const cardsFallback = await loadCardsFallback();
  return cardsFallback.find((fallbackCard) => fallbackCard.id === id) ?? null;
}

export async function fetchCardsByIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];

  const url = `${API_BASE}${buildQuery({ ids: uniqueIds.join(','), catalog: CARD_CATALOG_REVISION })}`;
  const cards = await safeFetchJson(url, async () => {
    const cardsFallback = await loadCardsFallback();
    const requestedIds = new Set(uniqueIds);
    return cardsFallback.filter((card) => requestedIds.has(card.id));
  });
  const resolvedCards = Array.isArray(cards) ? cards : [];
  const resolvedIds = new Set(resolvedCards.map((card) => card.id));
  if (resolvedIds.size === uniqueIds.length) return resolvedCards;

  const missingIds = new Set(uniqueIds.filter((id) => !resolvedIds.has(id)));
  const cardsFallback = await loadCardsFallback();
  return uniqueById([
    ...resolvedCards,
    ...cardsFallback.filter((card) => missingIds.has(card.id))
  ]);
}
