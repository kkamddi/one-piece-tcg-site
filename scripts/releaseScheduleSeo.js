import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReleaseScheduleEditorial } from '../lib/release-schedule-editorial.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pre-rendered at build time, so the upcoming list follows the official topics of that build.
export function getReleaseScheduleEntries(today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
  const topics = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', 'topics.json'), 'utf8'));
  const editorial = buildReleaseScheduleEditorial(topics, today);
  return [{
    pathname: '/guide/release-schedule',
    seo: {
      title: '원피스카드 신작·발매 일정 - 일본판·한국판 발매일과 한국 발매 간격 | Card Pone',
      description: '공식 발표 기준 원피스카드 일본판·한국판 신작 발매일과, 같은 제품의 한국판이 일본판보다 얼마나 늦게 나오는지 정리합니다.',
      keywords: '원피스카드 발매 일정, 원피스카드 신작, 원피스카드 한국판 발매일, 원피스카드 부스터 발매일, 원피스카드 엑스트라 부스터',
      schemaType: 'Article',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: editorial.reviewedAt,
      heading: editorial.heading,
      paragraphs: editorial.paragraphs,
      sections: [...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []), ...editorial.sections, { heading: '발매 일정 체크리스트', items: editorial.checklist }],
      links: ['/calendar', '/news', '/prices/boxes', '/guide/booster-comparison']
    }
  }];
}
