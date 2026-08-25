import boxMarketItems from '../src/data/box-market-items.js';

const contentReviewedAt = '2026-08-25';

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
          {
            heading: '이 페이지의 계산 범위',
            items: ['최고가 카드는 수록 카드 중 연결된 최신 Single 가격으로 정렬', '가격 중앙값은 가격이 확인된 카드만 사용', '유효 히트는 박스 현재가의 35% 이상인 카드 수로 표시']
          },
          {
            heading: '결과를 볼 때 주의할 점',
            paragraphs: ['봉입률과 미확인 카드 가격은 임의로 추정하지 않습니다. 따라서 추천 순위는 개봉 기대수익이나 수익 보장이 아니라 현재 확인 가능한 가격 분포를 비교하는 자료입니다.']
          },
          {
            heading: '확인 순서',
            items: ['박스 현재가와 데이터 기준일 확인', '최고가와 중앙값의 차이로 가격 집중도 확인', '수록 카드 목록에서 실제 카드와 연결 시세 재확인']
          }
        ],
        links: [`/guides/series/jp${seriesSlug}`, `/cards/jp${seriesSlug}`, '/prices/boxes', '/guide/box-recommendation']
      }
    }];
  });
}
