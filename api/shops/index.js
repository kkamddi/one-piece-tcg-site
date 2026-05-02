import { filterShops, readShops } from '../../lib/cards-store.js';

export default async function handler(request, response) {
  const { type, sido, gungu, q } = request.query ?? {};
  const shops = await readShops();
  const filtered = filterShops(shops, { type, sido, gungu, q });

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json(filtered);
}
