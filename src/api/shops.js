import shopsFallback from '../data/shops.json';

const API_BASE = '/api/shops';

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

function dedupeShops(shops = []) {
  const uniqueShops = new Map();

  shops.forEach((shop) => {
    const key = [shop?.name, shop?.address]
      .map((value) => String(value ?? '').trim().toLowerCase())
      .join('|');
    const existing = uniqueShops.get(key);

    if (!existing || (existing.sourceType !== 'official' && shop?.sourceType === 'official')) {
      uniqueShops.set(key, shop);
    }
  });

  return [...uniqueShops.values()];
}

export async function fetchShops(filters = {}) {
  const url = `${API_BASE}${buildQuery(filters)}`;
  const shops = await safeFetchJson(url, () => {
    const keyword = filters.q?.trim().toLowerCase();
    return shopsFallback.filter((shop) => {
      const matchesType = !filters.type || shop.sourceType === filters.type;
      const matchesSido = !filters.sido || filters.sido === '전체' || shop.sido === filters.sido;
      const matchesGungu = !filters.gungu || filters.gungu === '전체' || shop.gungu === filters.gungu;
      const matchesQuery =
        !keyword ||
        [shop.name, shop.address, shop.sido, shop.gungu].some((value) =>
          String(value ?? '').toLowerCase().includes(keyword)
        );
      return matchesType && matchesSido && matchesGungu && matchesQuery;
    });
  });

  return dedupeShops(Array.isArray(shops) ? shops : []);
}

export async function fetchShopRegions(type, sido = '') {
  const url = `${API_BASE}/regions${buildQuery({ type, sido })}`;
  return safeFetchJson(url, () => {
    const typed = shopsFallback.filter((shop) => !type || shop.sourceType === type);
    const sidos = [...new Set(typed.map((shop) => shop.sido).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    const gungus = !sido || sido === '전체'
      ? []
      : [...new Set(typed.filter((shop) => shop.sido === sido).map((shop) => shop.gungu).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    return { sidos, gungus };
  });
}
