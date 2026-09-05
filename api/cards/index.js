import { filterCards, readCards } from '../../lib/cards-store.js';

function parsePositiveInt(value, fallback = 0, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function parseOffset(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function paginate(items, query = {}) {
  const limit = parsePositiveInt(query.limit, 0);
  if (!limit) return items;
  const page = parsePositiveInt(query.page, 1, 100000);
  const offset = query.offset !== undefined
    ? parseOffset(query.offset)
    : (page - 1) * limit;
  return items.slice(offset, offset + limit);
}

export default async function handler(request, response) {
  const { locale, series, rarity, q, color, excludeCategory, ids, limit, page, offset } = request.query ?? {};
  const cards = await readCards({ locale, series, rarity, q, color, excludeCategory, limit, page, offset });
  const requestedIds = new Set(String(ids || '').split(',').map((id) => id.trim()).filter(Boolean));
  const filtered = filterCards(cards, { locale, series, rarity, q, color, excludeCategory })
    .filter((card) => !requestedIds.size || requestedIds.has(card.id));
  const paged = paginate(filtered, { limit, page, offset });

  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.status(200).json(paged);
}
