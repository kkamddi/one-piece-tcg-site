import { LEADER_CARDS_EDITORIAL, LEADER_CARDS_FAQ, LEADER_CARDS_PATH, LEADER_CARDS_SEO } from '../lib/leader-cards-editorial.js';

// Static article (figures fixed at dataDate), pre-rendered with the same sections as the React page.
export function getLeaderCardsEntries() {
  const editorial = LEADER_CARDS_EDITORIAL;
  return [{
    pathname: LEADER_CARDS_PATH,
    seo: {
      ...LEADER_CARDS_SEO,
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [{ heading: '핵심 숫자', stats: editorial.summary }, ...editorial.sections, { heading: '리더 카드 체크리스트', items: editorial.checklist }],
      faq: LEADER_CARDS_FAQ,
      links: ['/cards', '/prices', '/guide/starter-decks', '/guide/card-types', '/guide/price-ranking']
    }
  }];
}
