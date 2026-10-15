import { readFxRates } from '../lib/fx-rates.js';

export default async function handler(_request, response) {
  const rates = await readFxRates();
  response.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=21600');
  response.status(200).json(rates);
}
