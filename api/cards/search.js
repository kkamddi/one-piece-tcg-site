import { filterCards, readCards } from '../../lib/cards-store.js';

export default async function handler(request, response) {
  const { q = '' } = request.query ?? {};
  const cards = await readCards();
  const results = filterCards(cards, { q });

  response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  response.status(200).json(results);
}
