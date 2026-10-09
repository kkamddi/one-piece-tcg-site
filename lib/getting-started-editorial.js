// Shared by the /guide/getting-started page and its pre-rendered HTML.
// Figures: official JP/KR release calendar (src/data/topics.json), Card Pone catalog, SNKRDUNK latest-trade summary
// (JP card products) on dataDate — see artifacts/content/getting-started-analysis.mjs.
// Rules, pack contents and prices: official JP/KR product and play-guide pages checked on reviewedAt.
// Beginner page: each section is one lead sentence plus a single table or short list.
export const GETTING_STARTED_EDITORIAL = {
  heading: '원피스 카드게임 입문 가이드: 상품 종류, 한글판과 일본판, 처음 시작하는 순서',
  reviewedAt: '2026-10-09',
  dataDate: '2026-10-09',
  paragraphs: [
    '원피스 카드게임은 대전과 수집으로 즐기는 카드게임입니다. 처음이라면 상품 종류, 한글판·일본판 차이, 시작 순서부터 보세요.',
    '2026년 10월 9일 기준 일본·한국 공식 사이트, Card Pone 도감, SNKRDUNK 거래 기록을 바탕으로 합니다.'
  ],
  summary: [
    { value: '덱 50장', label: '대전 구성 (리더 1장·돈!! 10장 별도)' },
    { value: '17탄 · 14탄', label: '정규 부스터 발매 (일본판 · 한글판)' },
    { value: '약 10개월', label: '한글판이 늦게 나온 간격 (최근 6종 중앙값)' },
    { value: '¥2,385', label: '일본판 카드 단품 거래가 중앙값' }
  ],
  sections: [
    {
      heading: '1. 원피스 카드게임이란',
      paragraphs: ['반다이가 만드는 원피스 트레이딩 카드게임입니다.'],
      items: [
        '대전: 리더 카드 1장, 덱 50장, 돈!! 카드 10장으로 겨룹니다. 같은 번호는 4장까지 넣습니다.',
        '수집: 같은 번호도 패러렐·망가·SP처럼 그림이 다른 버전이 있습니다.',
        '한글판은 돈!!을 「두웅!!」으로 씁니다.'
      ],
      links: [{ href: 'https://www.onepiece-cardgame.com/play-guide/', label: '공식 플레이 가이드 (일본어)' }]
    },
    {
      heading: '2. 상품 종류',
      paragraphs: ['상품은 다섯 종류이며, 가격은 최근 상품의 공식 가격입니다.'],
      table: {
        numeric: false,
        columns: ['종류', '코드', '구성·가격', '일본판 수', '한글판 수'],
        rows: [
          ['정규 부스터', 'OP / OPK', '1팩 6장 (240엔 / 2,000원)', '17종', '14종'],
          ['엑스트라 부스터', 'EB / EBK', '1팩 6장 (240엔 / 2,000원)', '4종', '3종'],
          ['프리미엄 부스터', 'PRB', '1팩 10장 (550엔)', '2종', '없음'],
          ['스타트 덱', 'ST / STK', '덱 51장 + 돈!! 10장 (1,430엔 / 12,000원)', '36종', '23종'],
          ['프로모', 'P', '대회·행사 등으로 배포', '도감 425장', '도감 246장']
        ]
      }
    },
    {
      heading: '3. 한글판과 일본판',
      paragraphs: ['문구를 바로 읽으려면 한글판, 새 카드와 시세를 먼저 보려면 일본판이 편합니다.'],
      table: {
        numeric: false,
        columns: ['구분', '일본판', '한글판'],
        rows: [
          ['상품 코드', 'OP · EB · ST', 'OPK · EBK · STK'],
          ['발매 시기', '먼저 나옴', '약 10개월 뒤 (최근 6종 중앙값)'],
          ['최신 정규 부스터', 'OP-17 (2026-08-22)', 'OPK-14 (2026-08-21)'],
          ['1팩 가격', '240엔', '2,000원'],
          ['일본판만 있는 부스터', 'PRB-01·PRB-02·OP-15·OP-16·OP-17', '아직 없음'],
          ['시세 확인', 'Card Pone 시세 (SNKRDUNK)', '국내 판매처에서 직접']
        ]
      },
      links: [{ href: '/guide/release-schedule', label: '신작 발매 일정' }]
    },
    {
      heading: '4. 일본판 카드 가격대',
      paragraphs: ['거래 기록이 있는 일본판 단품 1,613개 기준, 거래가 중앙값은 ¥2,385입니다.'],
      items: [
        '¥5,000 미만: 70%',
        '¥10,000 이상: 20%',
        '지난 거래 기록이며 앞으로의 가격을 보장하지 않습니다.'
      ],
      links: [
        { href: '/prices', label: '시세 검색' },
        { href: '/guide/card-price', label: '시세 읽는 법' },
        { href: '/guide/price-ranking', label: '시세 순위' }
      ]
    },
    {
      heading: '5. 처음 시작하는 순서',
      paragraphs: ['대전이면 스타트 덱, 수집이면 도감에서 시작합니다.'],
      items: [
        '대전할지 수집할지 정합니다.',
        '대전: 좋아하는 색의 스타트 덱 하나를 고릅니다.',
        '수집: 도감에서 원하는 카드와 버전을 찾습니다.',
        '박스를 사기 전에 발매 일정과 박스 비교를 봅니다.',
        '가까운 구매처에서 사고, 카드는 바로 슬리브에 넣습니다.'
      ],
      links: [
        { href: '/guide/card-catalog', label: '도감 사용법' },
        { href: '/guide/card-types', label: '카드 종류와 레어도' },
        { href: '/guide/box-recommendation', label: '박스 비교' },
        { href: '/guide/shops', label: '구매처' },
        { href: '/guide/card-storage', label: '카드 보관' }
      ]
    }
  ],
  checklist: [
    '한글판과 일본판 중 살 쪽 정하기',
    '발매일과 가격은 공식 사이트에서 다시 확인하기',
    '시세는 거래일과 함께 보기'
  ]
};
