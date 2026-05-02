import { filterShops, readShops } from '../../lib/cards-store.js';

export default async function handler(request, response) {
  const { type, sido } = request.query ?? {};
  const shops = await readShops();
  const typed = filterShops(shops, { type });

  const sidos = [...new Set(typed.map((shop) => shop.sido).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ko')
  );

  const gungus = !sido || sido === '전체'
    ? []
    : [...new Set(typed.filter((shop) => shop.sido === sido).map((shop) => shop.gungu).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ko')
      );

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json({ sidos, gungus });
}
