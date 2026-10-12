import { RULES_EDITORIAL, RULES_PATH, RULES_SEO } from '../lib/rules-editorial.js';

// Static rules guide: the pre-rendered HTML uses the same editorial as the page.
export function getRulesEntries() {
  const editorial = RULES_EDITORIAL;
  return [{
    pathname: RULES_PATH,
    seo: {
      ...RULES_SEO,
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '룰 체크리스트', items: editorial.checklist }],
      links: ['/guide/getting-started', '/guide/glossary', '/guide/card-types', '/cards']
    }
  }];
}
