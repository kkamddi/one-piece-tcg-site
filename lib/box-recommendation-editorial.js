// Shared copy for the box recommendation hub and category pages and their pre-rendered HTML.
export const BOX_RECOMMENDATION_CATEGORIES = [
  {
    id: 'jackpot',
    path: '/guide/box-recommendation/high-price',
    eyebrow: 'HIGH CEILING',
    title: '최고가 카드 노리기',
    description: '박스 가격과 관계없이 각 시리즈에 수록된 Single 카드의 현재 최고가 순으로 비교합니다.',
    audience: '최상위 희귀 카드 한 장의 가격을 가장 중요하게 보는 경우',
    caution: '박스 가격과 봉입률은 순위에 반영하지 않아 개봉 결과의 편차가 클 수 있습니다.',
    score: 'maximum',
    method: [
      "대상 카드는 그 시리즈 일본판의 패러렐·SEC·SP 카드이며, 카드 가격은 최근 거래 Single 가격을 쓰고 없으면 SNKRDUNK 등록 최저가를 씁니다.",
      "대상 카드 중 가장 비싼 카드의 가격 순으로 정렬합니다.",
      "박스 가격과 봉입률은 반영하지 않으며, 가격이 확인된 카드가 한 장 이상인 박스만 비교합니다."
    ]
  },
  {
    id: 'stable',
    path: '/guide/box-recommendation/stable',
    eyebrow: 'BALANCED',
    title: '가격과 히트가 균형적인 박스',
    description: '박스 현재가 대비 카드 가격이 괜찮고, 일부 카드에만 가치가 몰리지 않은 상품을 비교합니다.',
    audience: '최고가 한 장보다 여러 유효 카드의 가격 분포를 함께 보고 싶은 경우',
    caution: '카드별 실제 봉입률을 적용한 기대값은 아니므로 수익을 보장하지 않습니다.',
    score: 'stableScore',
    method: [
      "대상 카드는 그 시리즈 일본판의 패러렐·SEC·SP 카드이며, 카드 가격은 최근 거래 Single 가격을 쓰고 없으면 SNKRDUNK 등록 최저가를 씁니다.",
      "점수는 박스 현재가 대비 카드 가격 중앙값에 가격 편차(변동계수)가 작을수록, 가격이 확인된 카드가 많을수록, 가격 확인 비율이 높을수록 커집니다.",
      "박스 현재가가 있고 가격이 확인된 카드가 3장 이상이며 확인 비율이 25% 이상인 박스만 비교합니다."
    ]
  },
  {
    id: 'hits',
    path: '/guide/box-recommendation/more-hits',
    eyebrow: 'MORE HITS',
    title: '유효 히트가 많은 박스',
    description: '박스 가격의 35% 이상인 Single 히트 카드가 상대적으로 많이 확인되는 박스를 비교합니다.',
    audience: '박스 가격 대비 의미 있는 가격의 카드가 여러 장인 시리즈를 찾는 경우',
    caution: '유효 히트 수는 현재 가격 기준이며 카드 가격이 바뀌면 순위도 달라집니다.',
    score: 'hitScore',
    method: [
      "대상 카드는 그 시리즈 일본판의 패러렐·SEC·SP 카드이며, 카드 가격은 최근 거래 Single 가격을 쓰고 없으면 SNKRDUNK 등록 최저가를 씁니다.",
      "유효 히트는 박스 현재가의 35% 이상인 카드이며, 점수는 유효 히트 수에 가격 확인 비율(최소 35%로 계산)을 곱하고 가격 확인 카드 수(최대 12장)를 조금 더합니다.",
      "박스 현재가가 있고 가격이 확인된 카드가 3장 이상이며 확인 비율이 25% 이상인 박스만 비교합니다."
    ]
  }
];

export const BOX_GUIDE_COPY = {
  hubHeading: '원피스카드 박스 구매 가이드',
  hubIntro: '원하는 개봉 방향을 선택하면 해당 기준으로 계산된 박스만 따로 확인할 수 있습니다.',
  readingHeading: '어떤 기준을 선택해야 하나요?',
  readingNote: '추천 결과는 Card Pone에 연결된 박스 현재가와 수록 카드의 최신 Single 시세를 비교합니다. 개봉 확률이나 미확인 카드 가격은 임의로 추정하지 않습니다.',
  seriesIndexHeading: '시리즈별 박스 분석',
  seriesIndexIntro: '출시된 박스의 현재가, 가격이 연결된 주요 카드와 가격 분포를 시리즈별로 확인합니다.',
  methodNote: '미개봉 박스와 패러렐·SEC·SP 카드에 연결된 최신 Single 시세만 사용합니다. 봉입률이 반영된 기대값이나 수익 보장이 아니며, 가격 데이터가 부족한 상품은 추천에서 제외됩니다.'
};

// Pre-rendered sections: the same text the page shows. Live rankings are left to the page.
export function getBoxHubSections(seriesItems = []) {
  return [
    { heading: '분석 기준', items: BOX_RECOMMENDATION_CATEGORIES.map((category) => `${category.title}: ${category.description}`) },
    { heading: BOX_GUIDE_COPY.readingHeading, paragraphs: [BOX_GUIDE_COPY.readingNote], items: BOX_RECOMMENDATION_CATEGORIES.map((category) => `${category.title}: ${category.audience}`) },
    {
      heading: BOX_GUIDE_COPY.seriesIndexHeading,
      paragraphs: [BOX_GUIDE_COPY.seriesIndexIntro],
      links: seriesItems.map((item) => ({ href: item.href, label: `${item.code} · ${item.title}${item.releaseDate ? ` · ${item.releaseDate}` : ''}` }))
    }
  ];
}

export function getBoxCategorySections(category) {
  return [
    { heading: '이 기준이 맞는 경우', paragraphs: [category.audience] },
    { heading: '확인할 점', paragraphs: [category.caution] },
    { heading: '계산 기준', paragraphs: [BOX_GUIDE_COPY.methodNote] },
    { heading: '점수 계산 방법', items: category.method }
  ];
}
