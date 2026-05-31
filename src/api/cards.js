const API_BASE = '/api/cards';
const CARD_API_CACHE_TTL_MS = 5 * 60 * 1000;
let cardsFallbackPromise;
const responseCache = new Map();
const pendingRequests = new Map();

async function loadCardsFallback() {
  cardsFallbackPromise ??= import('../data/cards.json').then((module) => module.default);
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
  const url = `${API_BASE}${buildQuery(filters)}`;
  return safeFetchJson(url, async () => {
    const cardsFallback = await loadCardsFallback();
    return cardsFallback.filter((card) => {
      const matchesLocale = !filters.locale || card.locale === filters.locale;
      const matchesSeries = !filters.series || card.series === filters.series;
      const matchesRarity = !filters.rarity || card.rarity === filters.rarity;
      return matchesLocale && matchesSeries && matchesRarity;
    });
  });
}

export async function searchCards(query, locale) {
  const trimmed = query?.trim() ?? '';
  if (!trimmed) return [];

  const url = `${API_BASE}/search${buildQuery({ q: trimmed, locale })}`;
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

  const url = `${API_BASE}/${encodeURIComponent(id)}`;
  return safeFetchJson(url, async () => {
    const cardsFallback = await loadCardsFallback();
    return cardsFallback.find((card) => card.id === id) ?? null;
  });
}
