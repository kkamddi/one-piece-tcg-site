import boxMarketItems from '../src/data/box-market-items.js';

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
  new URL('../src/data/box-market-items.js', import.meta.url)
];

export function getBoxRecommendationEntries() {
  const seen = new Set();
  return boxMarketItems.flatMap((item) => {
    const seriesId = getSeriesId(item.code);
    if (!seriesId || seen.has(seriesId)) return [];
    seen.add(seriesId);
    const code = getSeriesCode(seriesId);
    return [{
      pathname: `/guide/box-recommendation/series/${code.toLowerCase()}`,
      seo: {
        title: `${code} 박스 추천·가격 가이드 | Card Pone`,
        description: `${code} 원피스카드 박스의 현재 가격, 최고가 수록 카드, 가격 중앙값과 유효 히트를 최신 시세 데이터로 확인합니다.`,
        keywords: `${code} 박스 추천, ${code} 박스 가격, 원피스카드 박스 추천, 원피스카드 박스 시세`,
        schemaType: 'Article'
      }
    }];
  });
}
