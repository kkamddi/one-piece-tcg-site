import { MANGA_COLLECTION_GROUPS, CHAMPIONSHIP_COLLECTION_GROUPS, FLAGSHIP_COLLECTION_GROUPS, PROMO_COLLECTION_GROUPS } from './data/collection-guide.js';

export const CATALOG_LINEUPS = [
  { id: 'manga', labels: ['망가', 'Manga', 'コミック'] },
  { id: 'championship', labels: ['챔피언십', 'Championship', 'チャンピオンシップ'] },
  { id: 'flagship', labels: ['플래그십', 'Flagship', 'フラッグシップ'] },
  { id: 'promo', labels: ['프로모', 'Promo', 'プロモ'] }
];

export function buildCatalogLineups() {
  const groups = Object.fromEntries(CATALOG_LINEUPS.map(({ id }) => [id, new Set()]));
  const addGroups = (key, entries) => entries.forEach((group) => group.cards.forEach((card) => {
    if (card.cardId) groups[key].add(card.cardId);
  }));
  addGroups('manga', MANGA_COLLECTION_GROUPS);
  addGroups('championship', Object.values(CHAMPIONSHIP_COLLECTION_GROUPS).flat());
  addGroups('flagship', Object.values(FLAGSHIP_COLLECTION_GROUPS).flat());
  addGroups('promo', PROMO_COLLECTION_GROUPS);
  return groups;
}

export function getLineupCardIds(groups, key, locale) {
  return [...(groups[key] || [])].filter((id) => id.startsWith(`${locale}::`));
}
