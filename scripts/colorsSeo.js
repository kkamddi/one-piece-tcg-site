import { COLORS_EDITORIAL, COLORS_PATH, COLORS_SEO } from '../lib/colors-editorial.js';

// Static article: the counts are fixed in the editorial and checked against cards.json by testColorsEditorial.mjs.
export function getColorsEntries() {
  const editorial = COLORS_EDITORIAL;
  return [{
    pathname: COLORS_PATH,
    seo: {
      ...COLORS_SEO,
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '색 체크리스트', items: editorial.checklist }],
      links: ['/guide/leader-cards', '/guide/starter-decks', '/guide/glossary', '/guide/rules']
    }
  }];
}
