// Shared by the /guide/shops page and its pre-rendered HTML.
// Counts come from Card Pone's store list (official ONE PIECE CARD GAME Korea store pages) on dataDate.
export const SHOP_GUIDE_EDITORIAL = {
  heading: '원피스카드 사는 곳: 공인점포·취급점포와 지역별 매장 분포',
  reviewedAt: '2026-10-05',
  dataDate: '2026-10-05',
  paragraphs: [
    '원피스카드를 처음 살 때는 공식 홈페이지에 등록된 매장부터 확인하는 것이 안전합니다. Card Pone 구매처 페이지는 공식 매장 목록을 지역별로 정리하고 내 위치에서 가까운 순서로 보여 줍니다.',
    '아래 수치는 2026년 10월 5일 Card Pone 구매처 데이터(공식 홈페이지 공인·취급 점포 목록) 기준입니다. 매장 등록과 폐점에 따라 바뀝니다.'
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
    }
  ],
  checklist: [
    '가까운 구매처 순서로 먼저 확인하기',
    '공인점포와 취급점포 구분하기',
    '방문 전 매장 재고와 영업시간 확인하기',
    '네이버지도 또는 카카오맵으로 이동 경로 확인하기'
  ]
};
