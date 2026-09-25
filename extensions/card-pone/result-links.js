import { normalizeScanCode } from '../../src/lib/card-scan.js';

export function resultLinks(candidate) {
  const code = normalizeScanCode(candidate?.code || '');
  const locale = candidate?.locale;
  const apparelId = Number(candidate?.apparelId);
  const standardCode = /^(?:OP|EB|ST|PRB)\d{2}-\d{3}$|^P-\d{3}$/.test(code);
  if (!['JP', 'EN', 'KR'].includes(locale) || !Number.isSafeInteger(apparelId) || apparelId <= 0
    || candidate.key !== `${locale}-${apparelId}`) return null;
  if (!standardCode) {
    if (!candidate.artwork || !['JP', 'EN'].includes(locale)) return null;
    return { price: `/prices/product/${apparelId}`, catalog: null, catalogLabel: null };
  }

  const card = candidate.catalogCards?.length === 1 ? candidate.catalogCards[0] : null;
  const id = String(card?.id || '');
  const sameCard = card?.locale === locale && normalizeScanCode(card.baseCardNo || card.cardNo) === code && id.startsWith(`${locale}::`);
  const params = new URLSearchParams({ code });
  if (sameCard) params.set('cardId', id);
  const exactCatalog = sameCard && ['KR', 'JP'].includes(locale);
  const cardKey = exactCatalog ? id.slice(4).replace(/_p(\d+)$/i, '-p$1') : '';
  return {
    price: ['JP', 'EN'].includes(locale) ? `/prices/product/${apparelId}?${params}` : null,
    catalog: exactCatalog ? `/cards/${locale.toLowerCase()}/${encodeURIComponent(cardKey)}` : `/search?${new URLSearchParams({ q: code })}`,
    catalogLabel: exactCatalog ? '도감 보기' : '도감 검색'
  };
}
