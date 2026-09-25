import assert from 'node:assert/strict';
import { buildCatalogLineups, getLineupCardIds } from '../src/catalog-lineups.js';
import { MANGA_COLLECTION_GROUPS, CHAMPIONSHIP_COLLECTION_GROUPS, CHAMPIONSHIP_CARD_IDS, CHAMPIONSHIP_CARD_COUNTS, COLLECTION_GUIDE_AUDIT, FLAGSHIP_COLLECTION_GROUPS, PROMO_COLLECTION_GROUPS } from '../src/data/collection-guide.js';

const groups = buildCatalogLineups();
const sources = {
  manga: MANGA_COLLECTION_GROUPS,
  championship: Object.values(CHAMPIONSHIP_COLLECTION_GROUPS).flat(),
  flagship: Object.values(FLAGSHIP_COLLECTION_GROUPS).flat(),
  promo: PROMO_COLLECTION_GROUPS
};
for (const [key, source] of Object.entries(sources)) {
  const expected = new Set(source.flatMap((group) => group.cards.map((card) => card.cardId)));
  assert.deepEqual(groups[key], expected, `${key} must match the collection guide exactly`);
  for (const locale of ['JP', 'KR']) {
    assert.deepEqual(getLineupCardIds(groups, key, locale), [...expected].filter((id) => id.startsWith(`${locale}::`)));
  }
}
assert.equal(groups.manga.size, 39);
assert.equal(sources.championship.reduce((total, group) => total + group.cards.length, 0), 67);
assert.equal(CHAMPIONSHIP_CARD_IDS.length, 58);
assert.deepEqual(new Set(CHAMPIONSHIP_CARD_IDS), groups.championship);
assert.deepEqual(CHAMPIONSHIP_CARD_COUNTS, { JP: 42, KR: 16 });
assert.equal(COLLECTION_GUIDE_AUDIT.matchedChampionshipCards, 58);
for (const locale of ['JP', 'KR']) {
  assert.equal(getLineupCardIds(groups, 'championship', locale).length, CHAMPIONSHIP_CARD_COUNTS[locale]);
}
for (const id of ['JP::EB04-061_p3', 'JP::OP17-079_p2', 'JP::OP17-118_p2']) assert(!groups.manga.has(id));
assert.deepEqual(getLineupCardIds(groups, 'unknown', 'JP'), []);
console.log('Catalog lineup checks passed: exact guide parity, locale separation and exclusion of inferred variants.');
