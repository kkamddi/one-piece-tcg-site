import fs from 'node:fs';
import boxMarketItems from '../src/data/box-market-items.js';
import marketItems from '../src/data/market-cards.js';
import { analyzeBoxSeries, getBoxGuideSections } from '../src/lib/series-guide-analysis.js';
import { MANGA_COLLECTION_GROUPS } from '../src/data/collection-guide.js';
import { BOX_GUIDE_COPY, BOX_RECOMMENDATION_CATEGORIES, getBoxCategorySections, getBoxHubSections } from '../lib/box-recommendation-editorial.js';

const seriesData = JSON.parse(fs.readFileSync(new URL('../src/data/series.json', import.meta.url), 'utf8'));

const cardsData = JSON.parse(fs.readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8'));
const contentReviewedAt = '2026-10-05';

function getSeriesId(code = '') {
  const normalized = String(code).toUpperCase();
  const match = normalized.match(/^(OP|EB|PRB)-(\d{2})$/)
    || normalized.match(/^OPC-TCG-(OP|EB|PRB)-(\d{2})$/);
  return match ? `${match[1]}${match[2]}` : '';
}

function getSeriesCode(seriesId = '') {
  return String(seriesId).replace(/^(OP|EB|PRB)(\d{2})$/, '$1-$2');
}

export const boxRecommendationSourcePaths = [
  new URL('../src/data/cards.json', import.meta.url),
  new URL('../src/data/market-cards.js', import.meta.url),
  new URL('../src/data/box-market-items.js', import.meta.url)
];

const HUB_SEO = {
  '/guide/box-recommendation': ['원피스카드 박스 추천 가이드 | Card Pone', '최고가 카드, 안정적인 가격 분포, 유효 히트 수를 기준으로 원피스카드 부스터 박스를 목적별로 비교합니다.'],
  '/guide/box-recommendation/high-price': ['최고가 카드를 노리는 원피스카드 박스 추천 | Card Pone', '박스 현재가 대비 최고가 Single 카드의 가격 비중이 큰 원피스카드 부스터를 비교합니다.'],
  '/guide/box-recommendation/stable': ['가격 분포가 안정적인 원피스카드 박스 추천 | Card Pone', '매핑된 히트 카드 가격이 일부 카드에만 집중되지 않은 원피스카드 부스터를 비교합니다.'],
  '/guide/box-recommendation/more-hits': ['히트 카드가 많은 원피스카드 박스 추천 | Card Pone', '박스 가격과 비교해 의미 있는 Single 시세가 확인되는 히트 카드 수가 많은 원피스카드 부스터를 비교합니다.']
};

// Hub series list in the same order as the page (newest release first).
function getHubSeriesItems() {
  const bySeries = new Map();
  boxMarketItems.forEach((item) => {
    const seriesId = getSeriesId(item.code);
    if (!seriesId) return;
    const previous = bySeries.get(seriesId);
    if (!previous || String(item.releaseDate || '') > String(previous.releaseDate || '')) bySeries.set(seriesId, item);
  });
  return [...bySeries.entries()].map(([seriesId, item]) => {
    const code = getSeriesCode(seriesId);
    const series = seriesData.find((entry) => (entry.locale || 'KR') === 'KR' && String(entry.baseSeriesId || '') === seriesId)
      || seriesData.find((entry) => String(entry.baseSeriesId || '') === seriesId);
    return { code, title: series?.koName || series?.enName || seriesId, releaseDate: item.releaseDate || '', href: `/guide/box-recommendation/series/${code.toLowerCase()}` };
  }).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || b.code.localeCompare(a.code));
}

function getBoxHubEntries() {
  const base = { keywords: '원피스카드 박스 추천, 원피스카드 박스 가격, 원피스카드 히트 카드', schemaType: 'Article', editor: 'Card Pone 데이터 편집', reviewedAt: contentReviewedAt };
  return [
    { pathname: '/guide/box-recommendation', seo: { ...base, title: HUB_SEO['/guide/box-recommendation'][0], description: HUB_SEO['/guide/box-recommendation'][1], heading: BOX_GUIDE_COPY.hubHeading, paragraphs: [BOX_GUIDE_COPY.hubIntro], sections: getBoxHubSections(getHubSeriesItems()), links: BOX_RECOMMENDATION_CATEGORIES.map((category) => category.path) } },
    ...BOX_RECOMMENDATION_CATEGORIES.map((category) => ({
      pathname: category.path,
      seo: { ...base, title: HUB_SEO[category.path][0], description: HUB_SEO[category.path][1], heading: category.title, paragraphs: [category.description], sections: getBoxCategorySections(category), links: ['/guide/box-recommendation', '/guide/booster-comparison', '/prices/boxes'] }
    }))
  ];
}

export function getBoxRecommendationEntries() {
  return [...getBoxHubEntries(), ...getBoxSeriesEntries()];
}

function getBoxSeriesEntries() {
  const seen = new Set();
  return boxMarketItems.flatMap((item) => {
    const seriesId = getSeriesId(item.code);
    if (!seriesId || seen.has(seriesId)) return [];
    seen.add(seriesId);
    const code = getSeriesCode(seriesId);
    const seriesSlug = seriesId.toLowerCase();
    const releaseDate = item.releaseDate || '';
    return [{
      pathname: `/guide/box-recommendation/series/${code.toLowerCase()}`,
      seo: {
        title: `${code} 박스 추천·가격 가이드 | Card Pone`,
        description: `${code} 원피스카드 박스의 현재 가격, 최고가 수록 카드, 가격 중앙값과 유효 히트를 최신 시세 데이터로 확인합니다.`,
        keywords: `${code} 박스 추천, ${code} 박스 가격, 원피스카드 박스 추천, 원피스카드 박스 시세`,
        schemaType: 'Article',
        editor: 'Card Pone 데이터 편집',
        reviewedAt: contentReviewedAt,
        heading: `${code} 원피스카드 박스 가격·수록 카드 가이드`,
        paragraphs: [
          `${item.name}. 이 상품을 기준으로 정리한 박스 가이드입니다.${releaseDate ? ` 등록 발매일은 ${releaseDate}입니다.` : ''}`,
          '박스 현재가와 가격이 연결된 수록 카드의 Single 시세를 함께 비교해 최고가 카드, 상위 3장 합계, 가격 중앙값과 유효 히트를 확인합니다.'
        ],
        sections: [
          ...getBoxGuideSections(analyzeBoxSeries(seriesId, cardsData, marketItems, MANGA_COLLECTION_GROUPS)),
          {
            heading: '결과를 볼 때 주의할 점',
            paragraphs: ['봉입률과 미확인 카드 가격은 임의로 추정하지 않습니다. 따라서 추천 순위는 개봉 기대수익이나 수익 보장이 아니라 현재 확인 가능한 가격 분포를 비교하는 자료입니다.']
          }
        ],
        links: [`/guides/series/jp${seriesSlug}`, `/cards/jp${seriesSlug}`, '/prices/boxes', '/guide/box-recommendation']
      }
    }];
  });
}
