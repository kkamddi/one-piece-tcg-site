import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_REPORT_PATH, getMarketReportEditorial, getMarketReportHighlights, getMarketReportKpis, formatReportChange } from '../lib/market-report.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(rootDir, 'src', 'data', 'market-reports');

export function readMarketReports() {
  const indexPath = path.join(reportsDir, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    .map((entry) => ({ entry, report: JSON.parse(fs.readFileSync(path.join(reportsDir, `${entry.id}.json`), 'utf8')) }));
}

const base = { keywords: '원피스카드 시세, 원피스카드 주간 시세, 원피스카드 PSA10 시세, 원피스카드 가격 변동, 스니덩크 시세', schemaType: 'Article', editor: 'Card Pone 데이터 편집' };

// Pre-rendered text for the report hub and each weekly report.
export function getMarketReportEntries() {
  const reports = readMarketReports();
  if (!reports.length) return [];
  const [latest] = reports;
  const hub = {
    pathname: MARKET_REPORT_PATH,
    seo: {
      ...base,
      schemaType: 'CollectionPage',
      reviewedAt: latest.report.weekEnd,
      title: '원피스카드 주간 시세 리포트 - PSA10·Single 급등·급락 카드 | Card Pone',
      description: '매주 SNKRDUNK 실제 거래로 원피스카드 PSA10·Single 급등·급락 카드, 많이 거래된 카드, 최고가 카드와 박스 최저가를 정리합니다.',
      heading: '원피스카드 주간 시세 리포트',
      paragraphs: [
        '매주 월요일, 지난 한 주 동안 SNKRDUNK에서 실제로 거래된 원피스카드 시세를 정리합니다.',
        `가장 최근 리포트는 ${latest.entry.title}입니다.`
      ],
      sections: [
        {
          heading: '최근 리포트 요약',
          stats: getMarketReportKpis(latest.report).map((kpi) => ({ label: `${kpi.label} (${formatReportChange(kpi.change)})`, value: kpi.value })),
          items: getMarketReportHighlights(latest.report)
        },
        { heading: '리포트 목록', links: reports.map(({ entry }) => ({ href: `${MARKET_REPORT_PATH}/${entry.id}`, label: entry.title })) }
      ],
      links: ['/prices', '/guide/card-price']
    }
  };
  const pages = reports.map(({ entry, report }) => {
    const editorial = getMarketReportEditorial(report);
    return {
      pathname: `${MARKET_REPORT_PATH}/${entry.id}`,
      seo: {
        ...base,
        reviewedAt: report.weekEnd,
        title: `${editorial.heading} | Card Pone`,
        description: editorial.paragraphs[0].slice(0, 150),
        heading: editorial.heading,
        paragraphs: editorial.paragraphs,
        sections: editorial.sections,
        links: [MARKET_REPORT_PATH, '/prices', '/guide/card-price']
      }
    };
  });
  return [hub, ...pages];
}
