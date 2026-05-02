import { readSeries } from '../lib/cards-store.js';

export default async function handler(_request, response) {
  const series = await readSeries();
  response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  response.status(200).json(series);
}
