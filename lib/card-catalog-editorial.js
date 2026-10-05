// Shared by the /guide/card-catalog page and its pre-rendered HTML.
// Counts come from Card Pone's catalog and SNKRDUNK product data on dataDate.
export const CARD_CATALOG_EDITORIAL = {
  heading: '원피스카드 도감 사용법: 같은 번호의 다른 버전 구별하기',
  reviewedAt: '2026-10-05',
  dataDate: '2026-10-05',
  paragraphs: [
    '원피스카드는 카드 하단의 번호 하나로 찾기 시작하지만, 같은 번호에 그림과 출시 상품이 다른 카드가 여러 장인 경우가 흔합니다. 번호 읽는 법과 버전이 갈리는 이유를 알면 도감과 시세에서 원하는 카드를 정확히 찾을 수 있습니다.',
    '수치는 2026년 10월 5일 Card Pone 일본판 도감과 SNKRDUNK 일본판 상품 데이터 기준입니다.'
  ],
  summary: [
    { value: '35%', label: '패러렐이 있는 카드번호' },
    { value: '575개', label: '여러 시리즈에 수록된 번호' },
    { value: '1,232개', label: 'SNKRDUNK 상품이 2개 이상' },
    { value: '9개', label: 'OP01-120 일본판 상품 수' }
  ],
  sections: [
    {
      heading: '1. 카드번호 읽는 법',
      items: [
        'OP01-120 = 시리즈 코드 OP01 + 수록 번호 120',
        'OP 정규 부스터 · EB 엑스트라 부스터 · ST 스타트 덱 · PRB 프리미엄 부스터 · P 프로모',
        '한글판과 일본판 도감은 따로 있으니 언어판부터 선택하세요.'
      ]
    },
    {
      heading: '2. 같은 번호가 여러 장인 이유',
      paragraphs: ['그림을 바꾼 패러렐, 다른 상품에 다시 실린 재록, 대회·행사 프로모가 같은 번호로 존재합니다.'],
      stats: [
        { value: '960 / 2,773', label: '패러렐 있는 번호' },
        { value: '575', label: '2개 이상 시리즈 수록' },
        { value: '138', label: 'SNKRDUNK 상품 5개 이상' }
      ],
      items: ['다시 수록된 곳은 프리미엄 부스터(265개 번호)가 가장 많고 프로모(250개), 스타트 덱(132개) 순입니다.']
    },
    {
      heading: '3. 버전 종류와 SNKRDUNK 표기',
      paragraphs: ['Card Pone 시세는 SNKRDUNK 상품 단위로 집계합니다. 상품명 표기로 버전을 빠르게 구별할 수 있습니다.'],
      table: {
        columns: ['버전', 'SNKRDUNK 표기', '예시', '일본판 상품 수'],
        rows: [
          ['기본', '레어도만', 'Shanks SEC [OP01-120]', '-'],
          ['패러렐', '레어도 뒤 -P', 'SEC-P', '760'],
          ['코믹 패러렐', 'SP (Comic Parallel)', 'SEC-SP (Comic Parallel)', '43'],
          ['재록', '다른 출시 상품명', 'Premium Booster "The Best"', '675'],
          ['대회·프로모', '배포처 표기', 'Flagship · Championship · Promotional', '66 · 60 · 491'],
          ['해외판', '언어 표기', '[CN]', '89']
        ]
      }
    },
    {
      heading: '4. 예시: OP01-120 샹크스',
      paragraphs: ['일본판 OP01-120은 SNKRDUNK에서 아홉 개 상품으로 거래됩니다. 그림이 비슷해도 가격은 상품마다 따로 형성됩니다.'],
      images: [
        { src: 'https://cards.optcgkorea.com/cards/JP/OP01-120.webp', alt: 'OP01-120 샹크스 기본 SEC', caption: '기본 SEC' },
        { src: 'https://cards.optcgkorea.com/cards/JP/OP01-120_p1.webp', alt: 'OP01-120 샹크스 SEC 패러렐', caption: '패러렐' },
        { src: 'https://cards.optcgkorea.com/cards/JP/OP01-120_p2.webp', alt: 'OP01-120 샹크스 코믹 패러렐', caption: '코믹 패러렐' }
      ],
      items: [
        'ROMANCE DAWN: 기본 SEC · 패러렐 SEC-P · 코믹 패러렐 SEC-SP',
        '프리미엄 부스터 재록: 기본 SEC · SEC-P · 코믹 패러렐 SEC-SP',
        '플래그십 우승 기념품: 일본용 · 아시아용 SEC-P (개봉품)',
        '중국판 프로모: 플래그십 1월 트로피 SEC-P [CN]'
      ],
      links: [{ href: '/prices?code=OP01-120', label: 'OP01-120 시세에서 버전 비교' }]
    },
    {
      heading: '5. 최근 시리즈일수록 패러렐이 늘었습니다',
      bars: [
        { label: 'OP01', value: 33, display: '33장' },
        { label: 'OP05', value: 35, display: '35장' },
        { label: 'OP09', value: 39, display: '39장' },
        { label: 'OP13', value: 54, display: '54장' }
      ],
      items: [
        '일본판 도감 기준 패러렐 수입니다. 레어도별로는 R(340장)과 SR(333장)이 가장 많고 C 232장, 리더 167장 순입니다.',
        '최근 시리즈는 같은 번호의 패러렐이 여러 장일 수 있으니 이미지를 끝까지 비교하세요.'
      ]
    },
    {
      heading: '6. 도감에서 찾는 순서',
      items: [
        '언어판(한글판·일본판) 선택',
        '카드 하단 번호를 하이픈까지 검색 (예: OP05-119)',
        '번호를 모르면 카드명 검색 후 시리즈·등급 필터로 좁히기 (일본판도 한글 이름 검색 가능)',
        '같은 번호가 여러 장이면 이미지·레어도·수록 상품 비교',
        '로그인하면 보유·위시리스트 저장 (버전·언어판별로 따로 저장)'
      ]
    }
  ],
  checklist: [
    '한글판과 일본판을 먼저 정확히 선택하기',
    '카드번호를 하이픈까지 포함해 검색하기',
    '같은 번호의 패러렐·재록·프로모를 이미지와 수록 상품으로 비교하기',
    '시세를 볼 때도 같은 버전의 상품을 골랐는지 확인하기'
  ]
};
