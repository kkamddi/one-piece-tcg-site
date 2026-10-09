// Shared by the /guide/card-types page and its pre-rendered HTML.
// Figures come from Card Pone's SNKRDUNK latest-trade summary (JP card products, JPY) and the card catalog on dataDate.
// Recompute with: node artifacts/content/card-types-analysis.mjs
export const CARD_TYPES_EDITORIAL = {
  heading: '원피스카드 종류·레어도 가이드: 리더·SR·SEC부터 패러렐·SP·망가까지 시세 차이',
  reviewedAt: '2026-10-09',
  dataDate: '2026-10-09',
  paragraphs: [
    'SR, SEC, 패러렐, SP, 망가가 무엇인지와 실제 거래가가 얼마나 다른지 표로 정리했습니다.'
  ],
  summary: [
    { value: '1,488개', label: '집계한 일본판 카드 상품' },
    { value: '¥1,085~1,550', label: '기본 C·UC·R·SR·SEC·리더 Single 중앙값' },
    { value: '¥13,812', label: 'SP Single 중앙값' },
    { value: '¥143,004', label: '망가 Single 중앙값' }
  ],
  sections: [
    {
      heading: '1. 카드 종류와 레어도',
      paragraphs: ['레어도는 카드 오른쪽 아래, 카드 번호 옆에 인쇄됩니다.'],
      table: {
        columns: ['구분', '뜻'],
        rows: [
          ['리더', '덱의 중심 카드, 한 덱에 1장. 레어도 L'],
          ['캐릭터', '비용을 내고 필드에 꺼내 싸우는 카드'],
          ['이벤트', '쓰면 효과를 내고 끝나는 카드'],
          ['스테이지', '필드에 두고 효과를 계속 쓰는 카드'],
          ['돈!!', '카드를 낼 때 비용으로 쓰는 카드, 덱과 따로 준비'],
          ['C·UC·R', '팩에서 가장 많이 나오는 등급'],
          ['SR·SEC', '팩의 상위 등급'],
          ['P', '대회·행사 등 팩 밖에서 배포한 프로모'],
          ['SP', '스페셜 카드, 도감에 SP로 따로 표시'],
          ['TR', '트레저 레어, 일본판 도감에 OP16-042·OP17-033 2장']
        ]
      }
    },
    {
      heading: '2. 같은 번호의 다른 그림 버전',
      paragraphs: ['같은 OP05-119도 기본 SEC는 ¥8,281, 그림이 다른 버전은 아래 가격에 거래됐습니다(10월 3일).'],
      images: [
        { src: 'https://cards.optcgkorea.com/cards/JP/OP05-119_p1.webp', alt: 'OP05-119 몽키 D. 루피 SEC 패러렐', caption: 'SEC 패러렐 ¥21,991' },
        { src: 'https://cards.optcgkorea.com/cards/JP/OP05-119_p2.webp', alt: 'OP05-119 몽키 D. 루피 망가', caption: '망가 ¥680,878' }
      ],
      table: {
        columns: ['버전', '그림', 'SNKRDUNK 상품명'],
        rows: [
          ['패러렐', '같은 레어도에 그림만 다름', '-P (SR-P, SEC-P, L-P)'],
          ['SP', '이전 카드를 새 그림으로 다시 수록', '-SPC'],
          ['망가', '만화 원고 장면이 배경', 'Comic Parallel, -RSP, -GSP'],
          ['슈퍼 패러렐', '리더(EB05-010)·해적단(EB04-061) 특별판', 'Manga Alt Art여도 망가로 세지 않았습니다']
        ]
      },
      links: [
        { href: '/prices/product/135437?code=OP05-119', label: 'OP05-119 SEC 시세' },
        { href: '/prices/product/135438?code=OP05-119', label: 'SEC 패러렐 시세' },
        { href: '/prices/product/135439?code=OP05-119', label: '망가 시세' }
      ]
    },
    {
      heading: '3. 레어도·버전별 거래가',
      paragraphs: ['같은 번호의 가장 싼 기본 카드보다 SR·SEC·리더 패러렐은 1.9~2.6배, SP는 14.6배(71개 번호, 중앙값)에 거래됐습니다. 망가와 기본판 배수는 캐릭터별 시세 가이드에 정리했습니다.'],
      table: {
        numeric: true,
        columns: ['구분', '거래 상품', 'Single 중앙값', '중간 50%'],
        rows: [
          ['C·UC', '85', '¥1,550', '¥1,085~2,888'],
          ['R', '81', '¥1,172', '¥1,085~2,869'],
          ['SR', '198', '¥1,085', '¥1,085~1,628'],
          ['SEC', '47', '¥1,395', '¥1,018~2,041'],
          ['리더', '67', '¥1,550', '¥1,085~4,112'],
          ['C·UC·R 패러렐', '212', '¥1,667', '¥1,106~2,945'],
          ['SR 패러렐', '228', '¥2,015', '¥1,240~3,293'],
          ['SEC 패러렐', '45', '¥3,004', '¥2,051~4,463'],
          ['리더 패러렐', '127', '¥2,790', '¥1,798~4,731'],
          ['SP', '148', '¥13,812', '¥6,176~30,044'],
          ['망가', '41', '¥143,004', '¥86,463~256,709'],
          ['프로모', '204', '¥3,333', '¥1,704~9,102'],
          ['돈!! 카드', '141', '¥2,730', '¥1,268~5,115']
        ]
      },
      links: [{ href: '/guide/character-cards', label: '캐릭터별 카드 시세' }]
    },
    {
      heading: '4. 가격을 볼 때 주의할 점',
      paragraphs: ['표의 가격에는 아래 조건이 있습니다.'],
      items: [
        '2026년 10월 9일 일본판 SNKRDUNK 거래 1,488개 기준이며 한국판 가격이 아닙니다.',
        '기본 레어도 중앙값은 SNKRDUNK 최저 거래가 근처라 레어도끼리 차이가 작게 보입니다.',
        '대회 입상 상품과 시리얼 넘버 카드 81개는 뺐습니다.',
        '과거 거래가이며 앞으로의 가격이나 수익을 보장하지 않습니다.'
      ],
      links: [
        { href: '/prices', label: '시세 검색' },
        { href: '/guide/card-catalog', label: '도감 보는 법' }
      ]
    }
  ],
  checklist: [
    '번호·레어도와 함께 그림·수록 상품으로 버전 맞추기',
    '상품명 표기(-P, -SPC, Comic Parallel)로 패러렐·SP·망가 확인하기',
    '같은 버전의 Single·PSA10 거래가와 거래일 보기'
  ]
};
