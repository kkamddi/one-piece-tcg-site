const PAGE_SIZE = 200;

export default async function handler(req, res, env) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { locale = 'EN', cursor = '', revision = '' } = req.query || {};
  if (!['KR', 'EN', 'CN'].includes(locale) || typeof cursor !== 'string' || cursor.length > 200 || (cursor && !cursor.startsWith(`riftbound:${locale}:`)) || typeof revision !== 'string' || (revision && !/^[a-f0-9]{64}$/.test(revision))) {
    return res.status(400).json({ error: 'invalid_catalog_query' });
  }
  const db = env?.OPTCG_PUBLIC_D1;
  if (!db) return res.status(503).json({ error: 'catalog_unavailable' });
  try {
    // A batch reads metadata and rows from the same D1 transaction.
    const [editionResult, setsResult, cardsResult] = await db.batch([
      db.prepare('SELECT revision, card_count, metadata_json FROM riftbound_catalog_editions WHERE locale = ?').bind(locale),
      db.prepare('SELECT set_json, product_json FROM riftbound_catalog_sets WHERE locale = ? ORDER BY sort_order').bind(locale),
      db.prepare('SELECT card_json, sort_order FROM riftbound_catalog_cards WHERE locale = ? AND id > ? ORDER BY id LIMIT ?').bind(locale, cursor, PAGE_SIZE + 1)
    ]);
    const edition = editionResult.results[0];
    if (!edition) return res.status(503).json({ error: 'catalog_unavailable' });
    if (revision && revision !== edition.revision) return res.status(409).json({ error: 'catalog_changed', revision: edition.revision });
    const cards = cardsResult.results.slice(0, PAGE_SIZE).map((row) => JSON.parse(row.card_json));
    const sets = setsResult.results.map((row) => JSON.parse(row.set_json));
    const products = Object.fromEntries(setsResult.results.filter((row) => row.product_json).map((row) => [JSON.parse(row.set_json).id, JSON.parse(row.product_json)]));
    return res.status(200).json({ ...JSON.parse(edition.metadata_json), locale, sets, products, cards, order: cardsResult.results.slice(0, PAGE_SIZE).map((row) => row.sort_order), total: edition.card_count, revision: edition.revision, storage: 'd1', nextCursor: cardsResult.results.length > PAGE_SIZE ? cards.at(-1).id : null });
  } catch {
    return res.status(503).json({ error: 'catalog_unavailable' });
  }
}
