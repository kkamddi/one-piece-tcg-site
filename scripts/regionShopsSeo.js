import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_SHOP_PAGES, buildRegionShopEditorial, getRegionShopFaq, getRegionShopSeo } from '../lib/region-shops-editorial.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pre-rendered at build time from the official store list, like the box price page.
export function getRegionShopEntries() {
  const shops = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'shops.json'), 'utf8'));
  return REGION_SHOP_PAGES.map(({ slug }) => {
    const editorial = buildRegionShopEditorial(shops, slug);
    return {
      pathname: `/guide/shops/${slug}`,
      seo: {
        ...getRegionShopSeo(shops, slug),
        schemaType: 'Article',
        editor: 'Card Pone 데이터 편집',
        reviewedAt: editorial.reviewedAt,
        heading: editorial.heading,
        paragraphs: editorial.paragraphs,
        sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '방문 전 체크리스트', items: editorial.checklist }],
        faq: getRegionShopFaq(shops, slug),
        links: ['/shops', '/guide/shops', ...REGION_SHOP_PAGES.filter((region) => region.slug !== slug).map((region) => `/guide/shops/${region.slug}`)]
      }
    };
  });
}
