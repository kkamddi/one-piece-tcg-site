// Shared by the /guide/card-price page and its pre-rendered HTML.
// Figures come from Card Pone's SNKRDUNK latest-trade summary collected on dataDate.
export const CARD_PRICE_EDITORIAL = {
  heading: '원피스카드 시세 읽는 법: Single·PSA10과 최근 거래일 중앙값',
  reviewedAt: '2026-10-05',
  dataDate: '2026-10-05',
  paragraphs: [
    'Card Pone 시세는 SNKRDUNK에서 실제로 거래된 가격을 정리한 참고값입니다. 같은 카드라도 감정 여부, 버전, 거래 시점에 따라 가격이 크게 달라지므로 숫자 하나만 보면 시장과 어긋나기 쉽습니다.',
    '아래 통계는 2026년 10월 5일 SNKRDUNK 카드 상품 1,924개의 최근 거래 요약을 집계한 값입니다. 경향을 이해하는 용도로 봐 주세요.'
  ],
  summary: [
    { value: '3.7배', label: 'PSA10 ÷ Single (중앙값)' },
    { value: '64%', label: '마지막 Single 거래가 30일 넘음' },
    { value: '1.04배', label: '등록가 ÷ 거래가 (중앙값)' },
    { value: '1,924개', label: '집계한 카드 상품' }
  ],
  sections: [
    {
      heading: '1. 화면의 숫자가 뜻하는 것',
      items: [
        'Single: SNKRDUNK A등급, 감정받지 않은 상태 좋은 단품 카드의 거래',
        'PSA10: 미국 감정 회사 PSA의 최고 등급 GEM MINT 10 카드의 거래',
        '최근 거래일 중앙값: 마지막으로 거래된 날의 거래 가격 가운데 값',
        '원화: 1엔=9.4원 환산 참고값. 수수료·배송비·관세는 별도'
      ]
    },
    {
      heading: '2. 가격보다 거래일을 먼저 보세요',
      paragraphs: ['마지막 거래일이 오래됐다면 지금 시세와 다를 수 있습니다. 생각보다 거래가 드문 카드가 많습니다.'],
      bars: [
        { label: 'Single 7일 이내', value: 9, display: '9%' },
        { label: 'Single 30일 초과', value: 64, display: '64%' },
        { label: 'Single 90일 초과', value: 24, display: '24%' },
        { label: 'PSA10 7일 이내', value: 24, display: '24%' },
        { label: 'PSA10 30일 초과', value: 44, display: '44%' },
        { label: 'PSA10 90일 초과', value: 17, display: '17%' }
      ],
      items: ['Single은 1,757개, PSA10은 1,440개 상품 기준이며 PSA10 쪽이 최근 거래 비중이 더 높았습니다.', '거래가 오래된 카드는 7일·1개월 그래프가 비어 있을 수 있으니 1년 흐름과 현재 등록가를 함께 보세요.']
    },
    {
      heading: '3. 등록가와 거래가는 다른 숫자입니다',
      paragraphs: ['SNKRDUNK 최저 등록가는 판매 희망가이고, 시세 화면의 Single 가격은 실제로 팔린 가격입니다. 두 값을 함께 볼 수 있는 1,564개 상품을 비교했습니다(1달러=155엔 환산).'],
      stats: [
        { value: '1.04배', label: '중앙값' },
        { value: '0.8배 이하', label: '하위 25%' },
        { value: '1.5배 이상', label: '상위 25%' }
      ],
      items: ['등록가가 거래가보다 많이 낮다면 카드 상태, 다른 버전, 오래된 거래가 중 하나일 수 있습니다.']
    },
    {
      heading: '4. PSA10은 Single의 몇 배일까',
      paragraphs: ['두 가격이 모두 있는 1,273개 상품에서 PSA10은 Single의 중앙값 3.7배였고, 절반이 2.0~7.0배 사이였습니다. 싼 카드일수록 배수가 컸습니다.'],
      bars: [
        { label: 'Single ¥1,000 미만', value: 10.2, display: '10.2배' },
        { label: '¥1,000~5,000', value: 5.6, display: '5.6배' },
        { label: '¥5,000~20,000', value: 2.0, display: '2.0배' },
        { label: '¥20,000 이상', value: 1.4, display: '1.4배' }
      ],
      items: [
        '감정 비용과 시간은 카드 가격과 관계없이 비슷하게 들어서 저가 카드의 PSA10 가격에 크게 반영되는 것으로 보입니다.',
        '배수는 감정 결과를 보장하지 않습니다. 감정 후 판매를 계산할 때는 10등급을 받지 못할 가능성도 고려하세요.'
      ]
    },
    {
      heading: '5. 예시: OP01-120 샹크스 SEC 패러렐',
      paragraphs: ['일본판 ROMANCE DAWN 샹크스 SEC 패러렐(SNKRDUNK 상품 93512)의 2026년 10월 5일 값입니다.'],
      images: [{ src: 'https://cards.optcgkorea.com/cards/JP/OP01-120_p1.webp', alt: 'OP01-120 샹크스 SEC 패러렐', caption: 'OP01-120 SEC 패러렐' }],
      stats: [
        { value: '¥6,016', label: 'Single · 07-31 거래' },
        { value: '¥13,690', label: 'PSA10 · 10-02 거래' },
        { value: 'US $54', label: '등록 최저가' }
      ],
      items: [
        'Single 거래가 두 달 전이라 등록가(약 ¥8,370)와 39% 차이가 납니다. 지금 가치가 올랐을 수도, 그 가격에 안 팔리고 있을 수도 있습니다.',
        'PSA10은 사흘 전 거래라 비교적 최근 값이며 Single의 약 2.3배입니다. 원화로는 Single 약 ₩56,550, PSA10 약 ₩128,686입니다.'
      ],
      links: [{ href: '/prices/product/93512?code=OP01-120', label: 'OP01-120 샹크스 SEC 패러렐 시세' }]
    },
    {
      heading: '6. 같은 번호라도 상품이 다르면 시세도 다릅니다',
      items: [
        'OP01-120 하나에도 기본 SEC, 패러렐, 코믹 패러렐, 프리미엄 부스터 재록, 대회 프로모가 각각 다른 상품으로 거래됩니다.',
        '시세 화면에서 번호로 검색한 뒤 이미지와 괄호 안 출시 상품으로 내 카드와 같은 상품을 고르세요.',
        '카드 스캔의 "카드번호만 일치"는 그림까지 확인되지 않은 후보이니 버전을 직접 비교하세요.'
      ],
      links: [{ href: '/guide/card-catalog', label: '같은 번호의 버전 구별하기' }]
    }
  ],
  checklist: [
    '내 카드와 같은 상품(버전·출시 상품·언어)인지 이미지로 확인하기',
    'Single과 PSA10 가격을 섞지 않기',
    '최근 거래일이 30일보다 오래됐다면 그래프와 현재 등록가를 함께 보기',
    '등록가는 판매 희망가, 시세는 실제 거래가라는 점 구분하기',
    '원화는 1엔=9.4원 환산 참고값이며 수수료·배송비·관세는 별도'
  ]
};
