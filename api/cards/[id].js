import { readCardById } from '../../lib/cards-store.js';

export default async function handler(request, response) {
  const { id } = request.query ?? {};
  const card = await readCardById(id);

  if (!card) {
    return response.status(404).json({ message: 'Card not found' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(200).json(card);
}
