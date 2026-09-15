export async function loadRiftboundCatalog(locale, { signal, fetcher = fetch, endpoint = import.meta.env?.DEV ? '/__prod_api/api/riftbound' : '/api/riftbound', revision = '', restarted = false } = {}) {
  if (!['KR', 'EN', 'CN'].includes(locale)) throw new Error('Invalid edition');
  const cards = [];
  const ids = new Set();
  const positions = new Map();
  const usedPositions = new Set();
  const cursors = new Set();
  let cursor = '';
  let first;
  for (let page = 0; page < 100; page += 1) {
    const params = new URLSearchParams({ locale });
    if (cursor) params.set('cursor', cursor);
    if (first || revision) params.set('revision', first?.revision || revision);
    const response = await fetcher(`${endpoint}?${params}`, { signal, credentials: 'omit' });
    if (response.status === 409 && !restarted) {
      const changed = await response.json();
      if (/^[a-f0-9]{64}$/.test(changed.revision)) return loadRiftboundCatalog(locale, { signal, fetcher, endpoint, revision: changed.revision, restarted: true });
    }
    if (!response.ok) throw new Error(response.status === 409 ? 'Catalog changed' : 'Catalog unavailable');
    const data = await response.json();
    if (data.locale !== locale || data.storage !== 'd1' || !/^[a-f0-9]{64}$/.test(data.revision) || !Number.isInteger(data.total) || data.total < 1 || !Array.isArray(data.cards) || !Array.isArray(data.sets)) throw new Error('Invalid catalog response');
    if (!first) first = data;
    if (data.revision !== first.revision || data.total !== first.total) throw new Error('Catalog changed');
    for (const card of data.cards) {
      if (typeof card.id !== 'string' || !card.id.startsWith(`riftbound:${locale}:`) || ids.has(card.id)) throw new Error('Invalid card identity');
      ids.add(card.id);
      cards.push(card);
    }
    if (!Array.isArray(data.order) || data.order.length !== data.cards.length) throw new Error('Invalid catalog order');
    data.order.forEach((position, index) => {
      if (!Number.isInteger(position) || position < 0 || position >= data.total || usedPositions.has(position)) throw new Error('Invalid catalog order');
      usedPositions.add(position);
      positions.set(data.cards[index].id, position);
    });
    if (cards.length > first.total) throw new Error('Catalog count mismatch');
    if (data.nextCursor === null) {
      if (cards.length !== first.total) throw new Error('Incomplete catalog');
      return { ...first, cards: cards.sort((a, b) => positions.get(a.id) - positions.get(b.id)), nextCursor: null };
    }
    if (!data.cards.length || data.nextCursor !== data.cards.at(-1).id || cursors.has(data.nextCursor)) throw new Error('Invalid catalog cursor');
    cursor = data.nextCursor;
    cursors.add(cursor);
  }
  throw new Error('Catalog pagination limit exceeded');
}
