import cardsFallback from '../data/cards.json';

const API_BASE = '/api/cards';

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

async function safeFetchJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Falling back for ${url}`, error);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

export async function fetchCards(filters = {}) {
  const url = `${API_BASE}${buildQuery(filters)}`;
  return safeFetchJson(url, () => {
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
  return safeFetchJson(url, () => {
    const keyword = trimmed.toLowerCase();
    return cardsFallback.filter((card) => {
      const matchesLocale = !locale || card.locale === locale;
      const matchesKeyword = [card.cardNo, card.name].some((value) => value.toLowerCase().includes(keyword));
      return matchesLocale && matchesKeyword;
    });
  });
}

export async function fetchCardById(id) {
  if (!id) return null;

  const url = `${API_BASE}/${encodeURIComponent(id)}`;
  return safeFetchJson(url, () => cardsFallback.find((card) => card.id === id) ?? null);
}
