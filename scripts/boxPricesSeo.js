import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import boxMarketItems from '../src/data/box-market-items.js';
import { BOX_PRICES_PATH, BOX_PRICES_SEO, buildBoxPricesEditorial } from '../lib/box-prices-editorial.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pre-rendered at build time, so the table follows the box prices of that build.
export function getBoxPricesEntries(today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
  const prices = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'box-market-prices.json'), 'utf8'));
  const editorial = buildBoxPricesEditorial(boxMarketItems, prices, today);
  return [{
    pathname: BOX_PRICES_PATH,
    seo: {
      ...BOX_PRICES_SEO,
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '박스 가격 체크리스트', items: editorial.checklist }],
      links: ['/prices/boxes', '/guide/box-recommendation', '/guide/release-schedule', '/guide/shops']
    }
  }];
}
