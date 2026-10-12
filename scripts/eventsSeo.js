import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardShowEvents } from '../src/data/card-show-events.js';
import { CHAMPIONSHIP_COLLECTION_GROUPS, FLAGSHIP_COLLECTION_GROUPS } from '../src/data/collection-guide.js';
import { EVENTS_PATH, buildEventsEditorial, getEventsFaq, getEventsSeo } from '../lib/events-editorial.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pre-rendered at build time, so the official notices and card shows follow the data of that build.
export function getEventsEntries(today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
  const topics = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'topics.json'), 'utf8'));
  const collectionGroups = { flagship: FLAGSHIP_COLLECTION_GROUPS, championship: CHAMPIONSHIP_COLLECTION_GROUPS };
  const editorial = buildEventsEditorial(cardShowEvents, topics, collectionGroups, today);
  return [{
    pathname: EVENTS_PATH,
    seo: {
      ...getEventsSeo(),
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '대회 참가 체크리스트', items: editorial.checklist }],
      faq: getEventsFaq(cardShowEvents, topics, collectionGroups, today),
      links: ['/guide/collection/flagship', '/guide/collection/championship', '/guide/shops', '/calendar']
    }
  }];
}
