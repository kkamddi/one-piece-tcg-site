export const RIFTBOUND_STORAGE_KEY = 'card-pone:riftbound-local-preview:v1';
export const RIFTBOUND_EDITIONS = [
  { id: 'KR', label: 'KR', lang: 'ko' },
  { id: 'EN', label: 'EN', lang: 'en' },
  { id: 'CN', label: 'CN', lang: 'zh-Hans' }
];
export const normalizeRiftboundLocale = (value) => RIFTBOUND_EDITIONS.some((edition) => edition.id === value) ? value : 'EN';

// Card Pone navigation groups, not official gallery category names or product manifests.
export function getRiftboundCategories(sets) {
  const groups = [
    { id: 'booster', label: '부스터 시리즈', shortLabel: '부스터', codes: ['VEN', 'UNL', 'SFD', 'OGN'] },
    { id: 'starter', label: '입문 세트', shortLabel: '입문', codes: ['OGS'] },
    { id: 'special', label: '특별 제품', shortLabel: '특별', codes: ['ARC', 'SGN', 'T1S', 'T1A'] },
    { id: 'promo', label: '프로모', shortLabel: '프로모', codes: ['PR'] }
  ];
  const known = new Set(groups.flatMap((group) => group.codes));
  const other = sets.filter((set) => !known.has(set.id));
  return [...groups.map(({ codes, ...group }) => ({ ...group, sets: codes.flatMap((id) => sets.filter((set) => set.id === id)) })),
    ...(other.length ? [{ id: 'other', label: '기타', shortLabel: '기타', sets: other }] : [])];
}

export function parseRiftboundCardNumber(code) {
  const match = String(code).match(/^([A-Z0-9]+)[·-](SP|R|T)?(\d+)([a-z]*)(\*)?(?:\/(\d+))?(?:·.*)?$/i);
  if (!match) return null;
  return { set: match[1].toUpperCase(), prefix: (match[2] || '').toUpperCase(), number: Number(match[3]), alternate: Boolean(match[4]), signature: Boolean(match[5]), total: match[6] ? Number(match[6]) : null };
}

const championAliases = {
  '아리': 'ahri', '징크스': 'jinx', '리신': 'lee sin', '리 신': 'lee sin',
  '빅토르': 'viktor', '야스오': 'yasuo', '레오나': 'leona', '다리우스': 'darius',
  '미스포츈': 'miss fortune', '미스 포츈': 'miss fortune', '티모': 'teemo',
  '애니': 'annie', '볼리베어': 'volibear', '가렌': 'garen', '세트': 'sett'
};
const normalize = (value) => String(value || '').toLowerCase().replace(/[\s\-_,/·]/g, '');

export function sanitizeCollection(value, cardIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id]) => cardIds.has(id)).map(([id, item]) => [id, {
    quantity: Number.isFinite(item?.quantity) ? Math.min(999, Math.max(0, Math.trunc(item.quantity))) : 0,
    wished: item?.wished === true
  }]));
}

export function filterRiftboundCards(cards, filters, collection = {}) {
  const query = normalize(championAliases[filters.query?.trim()] || filters.query);
  return cards.filter((card) => {
    const entry = collection[card.id];
    return (!filters.locale || card.id.startsWith(`riftbound:${filters.locale}:`))
      && (!filters.set || card.set === filters.set)
      && (!filters.rarity || card.rarity === filters.rarity)
      && (!filters.variant || card.variant === filters.variant)
      && (filters.view !== 'owned' || entry?.quantity > 0)
      && (filters.view !== 'wishlist' || entry?.wished === true)
      && (!query || normalize([card.name, card.code, card.set, ...card.tags, ...card.types, ...card.domains].join(' ')).includes(query));
  });
}

export function collectionSummary(cards, collection) {
  return cards.reduce((result, card) => {
    const entry = collection[card.id];
    result.owned += entry?.quantity > 0 ? 1 : 0;
    result.quantity += entry?.quantity || 0;
    result.wished += entry?.wished ? 1 : 0;
    return result;
  }, { owned: 0, quantity: 0, wished: 0 });
}
