import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTER_DECKS_PATH, buildStarterDecksEditorial, getStarterDecksFaq, getStarterDecksSeo } from '../lib/starter-decks-editorial.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readData = (name) => JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', name), 'utf8'));

// Pre-rendered at build time, so the deck list follows the official calendar and card list of that build.
export function getStarterDecksEntries(today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
  const series = readData('series.json');
  const cards = readData('cards.json');
  const topics = readData('topics.json');
  const editorial = buildStarterDecksEditorial(series, cards, today, topics);
  return [{
    pathname: STARTER_DECKS_PATH,
    seo: {
      ...getStarterDecksSeo(series, cards, today, topics),
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '스타트 덱 체크리스트', items: editorial.checklist }],
      faq: getStarterDecksFaq(series, cards, today, topics),
      links: ['/guide/getting-started', '/guide/rules', '/guide/shops', '/guide/release-schedule']
    }
  }];
}
