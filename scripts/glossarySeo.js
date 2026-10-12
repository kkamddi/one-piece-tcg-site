import { GLOSSARY_EDITORIAL, GLOSSARY_PATH, GLOSSARY_SEO } from '../lib/glossary-editorial.js';

// Static article: the counts are fixed in the editorial and checked against cards.json by testGlossaryEditorial.mjs.
export function getGlossaryEntries() {
  const editorial = GLOSSARY_EDITORIAL;
  return [{
    pathname: GLOSSARY_PATH,
    seo: {
      ...GLOSSARY_SEO,
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '용어 체크리스트', items: editorial.checklist }],
      links: ['/guide/rules', '/guide/getting-started', '/guide/card-types', '/guide/psa-grading']
    }
  }];
}
