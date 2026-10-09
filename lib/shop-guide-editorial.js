// Shared by the /guide/shops page and its pre-rendered HTML.
// Counts come from Card Pone's store list (official ONE PIECE CARD GAME Korea store pages) on dataDate.
// List prices: official product pages checked on reviewedAt (KR onepiece-cardgame.kr/products.do 'OPK-13·OPK-14·EBK-03·EBK-04·STK-25~29',
// JP onepiece-cardgame.com/products/op18.html·eb05.html). Leave out any price that is not on an official page.
export const SHOP_GUIDE_EDITORIAL = {
  heading: '원피스카드 파는 곳: 공인점포·온라인 구매·매입·정가 정리',
  reviewedAt: '2026-10-09',
  dataDate: '2026-10-09',
  paragraphs: [
    '원피스카드는 공식 홈페이지에 등록된 매장에서 사는 것이 가장 안전합니다. Card Pone 구매처 페이지는 이 매장 목록을 지역별·내 주변순으로 보여 주고, 이 글은 온라인 구매·정가·매입 때 볼 점을 정리합니다.',
    '매장 수는 2026년 10월 9일 공식 점포 목록 기준이며 등록·폐점에 따라 바뀝니다.'
  ],
  summary: [
    { value: '80곳', label: '공식 목록 매장' },
    { value: '54곳', label: '공인/공식 점포' },
    { value: '26곳', label: '공식 취급 점포' },
    { value: '56%', label: '수도권(서울·경기·인천)' }
  ],
  sections: [
    {
      heading: '1. 공인점포와 취급점포',
      paragraphs: ['공식 홈페이지는 매장을 공인/공식 점포와 공식 취급 점포로 나눠 안내합니다. Card Pone도 같은 구분으로 표시합니다.'],
      stats: [
        { value: '54곳', label: '공인/공식 점포' },
        { value: '26곳', label: '공식 취급 점포' }
      ],
      items: [
        '공인 여부와 실제 재고는 별개입니다. 신상품 예약, 입고 수량, 판매 방식은 매장마다 다릅니다.',
        '대회와 프로모션 카드 배포 여부도 매장마다 다르니 방문 전에 매장 안내를 확인하세요.',
        '제휴 카드샵 표시는 Card Pone에 상세 정보 제공에 동의한 매장을 구분하는 항목입니다.'
      ]
    },
    {
      heading: '2. 지역별 매장 수',
      paragraphs: ['서울(24곳)과 경기(17곳)에 절반이 넘는 매장이 있습니다. 세종·경상북도·제주에는 아직 등록된 매장이 없습니다.'],
      bars: [
        { label: '서울', value: 24, display: '24곳' },
        { label: '경기', value: 17, display: '17곳' },
        { label: '부산', value: 7, display: '7곳' },
        { label: '경남', value: 6, display: '6곳' },
        { label: '대구', value: 4, display: '4곳' },
        { label: '대전', value: 4, display: '4곳' },
        { label: '인천', value: 4, display: '4곳' },
        { label: '광주', value: 3, display: '3곳' },
        { label: '전북', value: 3, display: '3곳' },
        { label: '충북', value: 3, display: '3곳' },
        { label: '울산', value: 2, display: '2곳' },
        { label: '강원·전남·충남', value: 1, display: '각 1곳' }
      ],
      links: [
        { href: '/guide/shops/seoul', label: '서울 매장 목록' },
        { href: '/guide/shops/gyeonggi', label: '경기 매장 목록' },
        { href: '/guide/shops/busan', label: '부산 매장 목록' },
        { href: '/guide/shops/gyeongnam', label: '경남 매장 목록' }
      ]
    },
    {
      heading: '3. 서울과 경기 안에서는',
      bars: [
        { label: '서울 마포구', value: 5, display: '5곳' },
        { label: '서울 강남구', value: 4, display: '4곳' },
        { label: '경기 평택시', value: 3, display: '3곳' },
        { label: '경기 부천시', value: 2, display: '2곳' },
        { label: '경기 성남 분당구', value: 2, display: '2곳' }
      ],
      items: ['서울은 관악·광진·동작·양천구가 각 2곳이고, 나머지 구는 1곳 이하입니다. 가까운 구에 매장이 없다면 내 주변순 정렬로 인접 지역까지 함께 보세요.']
    },
    {
      heading: '4. 내 주변 매장 찾기',
      items: [
        '지역과 시군구 필터로 범위를 좁히고, 매장명 검색으로 특정 매장을 찾습니다.',
        '위치 권한을 허용하면 가까운 순서로 정렬됩니다. 거리는 등록 좌표까지의 직선거리입니다.',
        '위치 정보는 정렬에만 쓰며 브라우저 설정에서 언제든 끌 수 있습니다.'
      ],
      links: [{ href: '/shops', label: '구매처 찾기' }]
    },
    {
      heading: '5. 방문 전에 확인할 것',
      items: [
        '각 매장 카드의 네이버지도·카카오맵 바로가기로 길찾기, 영업시간, 전화번호를 확인합니다.',
        '신상품 발매일과 예약 가능 여부, 박스·팩·싱글카드 취급 범위를 먼저 확인합니다.',
        '재고와 결제 방식, 이벤트 참여 조건을 확인하면 헛걸음을 줄일 수 있습니다.'
      ]
    },
    {
      heading: '6. 온라인으로 살 때',
      paragraphs: ['공식 점포 온라인 스토어, 오픈마켓, 중고 거래, 해외 구매 어디서든 주문 전에 네 가지를 확인합니다.'],
      items: [
        '언어판: 한글판은 OPK·EBK·STK, 일본판은 OP·EB·ST 상품 번호로 구분합니다.',
        '실링: 박스 수축 포장이 찢기거나 다시 감싼 흔적이 없는지 봅니다.',
        '포장: 완충재·탑로더로 보내는지 확인하고, 받으면 뜯기 전에 사진을 남깁니다.',
        '판매자: 거래 기록과 반품 조건을 보고, 시세보다 지나치게 싼 상품은 피합니다.'
      ],
      links: [{ href: '/prices', label: '카드 시세 보기' }]
    },
    {
      heading: '7. 원피스카드 정가(희망소비자 가격)',
      paragraphs: ['공식 상품 페이지의 정가이며(2026년 10월 9일 확인), 실제 판매가는 매장과 시기에 따라 이보다 높거나 낮을 수 있습니다.'],
      table: {
        columns: ['상품', '구성', '정가', '확인한 상품'],
        rows: [
          ['한글판 부스터 팩', '1팩 6장 · 1박스 24팩', '1팩 2,000원 · 1박스 48,000원', 'OPK-13, OPK-14'],
          ['한글판 엑스트라 부스터 팩', '1팩 6장 · 1박스 24팩', '1팩 2,000원 · 1박스 48,000원', 'EBK-03, EBK-04'],
          ['한글판 스타트 덱', '덱 51장 · 두웅!! 카드 10장', '12,000원', 'STK-25~STK-29'],
          ['일본판 부스터 팩', '1팩 6장', '1팩 240엔(세금 포함)', 'OP-18, EB-05']
        ]
      },
      links: [
        { href: '/guide/box-recommendation', label: '목적별 박스 비교' },
        { href: '/guide/release-schedule', label: '신작·발매 일정' }
      ]
    },
    {
      heading: '8. 팔 때(매입) 확인할 것',
      paragraphs: ['카드샵 매입가는 보통 시세보다 낮게 잡히므로 팔기 전에 아래를 확인합니다.'],
      items: [
        '같은 카드번호·같은 버전(일반·패러렐·망가)의 최근 거래가를 봅니다.',
        '흠집·휨·모서리 상태를 확인하고 앞뒷면 사진을 남깁니다.',
        'PSA 등급 카드는 일반 카드와 따로 시세를 봅니다.',
        '매장마다 매입 기준이 다르니 여러 곳을 비교합니다.'
      ],
      links: [
        { href: '/prices', label: '카드 시세 보기' },
        { href: '/guide/card-price', label: '시세 보는 법' },
        { href: '/guide/psa-grading', label: 'PSA 그레이딩 가이드' }
      ]
    }
  ],
  checklist: [
    '가까운 공식 매장부터 확인하기',
    '공인점포와 취급점포 구분하기',
    '방문 전 재고와 영업시간 확인하기',
    '온라인은 언어판과 판매자 확인하기',
    '정가와 실제 판매가 비교하기',
    '팔기 전 최근 거래가 확인하기'
  ]
};
