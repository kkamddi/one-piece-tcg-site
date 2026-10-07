import market from '../src/data/market-cards.js';
import { BOOSTER_PREVIEWS, BOOSTER_PREVIEW_PATH, formatPreviewYen, getPreviewCards, groupPreviewCards } from '../lib/booster-preview.js';

// Pre-rendered at build time, so the revealed-card list follows the SNKRDUNK sync of that build.
export function getBoosterPreviewEntries(items = market) {
  return BOOSTER_PREVIEWS.map((preview) => {
    const cards = getPreviewCards(preview, items);
    const sections = [
      { heading: '핵심 숫자', stats: preview.facts },
      {
        heading: `공개된 카드 ${cards.length}장`,
        items: cards.length
          ? groupPreviewCards(cards).map(({ group, cards: groupCards }) => `${group} ${groupCards.length}장: ${groupCards.map((card) => `${card.code} ${card.name} ${card.rarity}${card.note ? ` (${card.note})` : ''}`).join(', ')}`)
          : ['아직 공개된 카드가 없습니다. 등록되는 대로 추가됩니다.']
      },
      ...(preview.composition ? [{ heading: '레어도 구성', table: preview.composition }] : []),
      { heading: preview.reference.title, paragraphs: [preview.reference.note], items: preview.reference.cards.map((card) => `${card.label} ${card.version}: Single ${formatPreviewYen(card.single)}`) },
      { heading: '확인할 점', items: preview.notes }
    ];
    return {
      pathname: `${BOOSTER_PREVIEW_PATH}/${preview.slug}`,
      seo: {
        title: preview.seoTitle,
        description: preview.seoDescription,
        keywords: preview.seoKeywords,
        schemaType: 'Article',
        editor: 'Card Pone 데이터 편집',
        reviewedAt: preview.reviewedAt,
        heading: preview.title,
        paragraphs: [preview.lead],
        sections,
        links: preview.related
      }
    };
  });
}
