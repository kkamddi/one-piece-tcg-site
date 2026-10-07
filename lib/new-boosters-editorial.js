// Shared by the /guide/new-boosters page and its pre-rendered HTML.
// Product facts come from the official JP product pages; card lists from SNKRDUNK pre-registered products;
// EB-03 / OP-17 results from Card Pone's SNKRDUNK latest-trade summary on dataDate (artifacts/content/new-boosters-analysis.mjs).
const SNKRDUNK_IMAGE = 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-10-05-';
const CARD_IMAGE = 'https://cards.optcgkorea.com/cards/JP/';

export const NEW_BOOSTERS_EDITORIAL = {
  heading: '원피스카드 신작 프리뷰: EB-05 Heroines Edition vol.2 · OP-18 신의 지배',
  reviewedAt: '2026-10-07',
  dataDate: '2026-10-07',
  paragraphs: [
    '10월 31일 엑스트라 부스터 EB-05 Heroines Edition vol.2, 11월 21일 정규 부스터 OP-18 「神の支配(신의 지배)」가 일본에서 발매됩니다. 공식 발표 내용과 지금까지 공개된 카드, 앞선 부스터의 발매 후 시세를 함께 정리했습니다.',
    '2026년 10월 7일 기준 원피스 카드게임 일본 공식 상품 페이지, SNKRDUNK에 미리 등록된 상품, Card Pone 시세 데이터를 바탕으로 합니다. 수록 카드가 더 공개되면 내용을 갱신합니다.'
  ],
  summary: [
    { value: '10월 31일', label: 'EB-05 일본판 발매' },
    { value: '11월 21일', label: 'OP-18 일본판 발매' },
    { value: '2종', label: 'EB-05 공개된 망가 버전' },
    { value: '¥105,154', label: 'vol.1(EB-03) 최고가 카드 Single' }
  ],
  sections: [
    {
      heading: '1. 한눈에 보기',
      paragraphs: ['공식 상품 페이지의 발매일·희망소매가·구성입니다. 표는 옆으로 넘겨 볼 수 있습니다.'],
      table: {
        columns: ['제품', '발매일', '희망소매가', '구성'],
        rows: [
          ['EB-05 Heroines Edition vol.2', '2026-10-31 (토)', '1팩 240엔', '1팩 6장, 전 75종+돈!! 2종'],
          ['HEROINES PRECIOUS BOX', '2026-10-31 (토)', '8,470엔', 'EB-05 1박스·스토리지 박스·슬리브 70장·돈!! 10장'],
          ['OP-18 神の支配', '2026-11-21 (토)', '1팩 240엔', '1팩 6장, 전 127종+1종']
        ]
      },
      links: [
        { href: 'https://www.onepiece-cardgame.com/products/eb05.html', label: 'EB-05 공식 상품 페이지' },
        { href: 'https://www.onepiece-cardgame.com/products/heroines-box.html', label: 'PRECIOUS BOX 공식 상품 페이지' },
        { href: 'https://www.onepiece-cardgame.com/products/op18.html', label: 'OP-18 공식 상품 페이지' }
      ]
    },
    {
      heading: '2. EB-05는 리더가 7종으로 늘었습니다',
      paragraphs: ['여성 캐릭터를 주인공으로 한 엑스트라 부스터의 두 번째 상품입니다. 1탄 EB-03과 공식 레어도 구성을 비교하면 일반 카드 수는 같고 리더가 크게 늘었습니다. EB-03은 Card Pone 도감 기준입니다.'],
      table: {
        numeric: true,
        columns: ['구분', '리더', '커먼', '레어', '슈퍼레어', '시크릿', 'SP'],
        rows: [
          ['EB-05 (공식)', '7', '29', '21', '9', '1', '8'],
          ['EB-03', '1', '29', '21', '9', '2', '9']
        ]
      },
      items: [
        'SNKRDUNK에 등록된 리더 7종 중 6종은 비비·시라호시·나미·보니·행콕·레베카의 기존 리더 번호이고, 새 번호는 EB05-010 니코 로빈입니다.',
        'SP 8종도 SNKRDUNK 등록 상품과 공식 숫자가 같습니다. EB-05 번호 3종(스투시·로빈·레이주)과 기존 번호 5종(나미 OP01-016, 페로나, 게르드, 푸딩, 행콕 ST17-004)입니다.',
        '시크릿 레어는 EB05-061 나미 1종입니다.'
      ]
    },
    {
      heading: '3. 지금까지 공개된 EB-05 카드',
      paragraphs: ['SNKRDUNK에 미리 등록된 EB-05 상품 35개 기준입니다. 공식 카드 리스트가 아니므로 이름과 버전은 발매 전에 바뀔 수 있습니다.'],
      images: [
        { src: `${SNKRDUNK_IMAGE}EB05-010SP-of.webp?size=m`, alt: 'EB05-010 니코 로빈 리더 망가 버전', caption: '로빈 EB05-010 망가' },
        { src: `${SNKRDUNK_IMAGE}EB05-014SP-of.webp?size=m`, alt: 'EB05-014 시라호시 망가 버전', caption: '시라호시 EB05-014 망가' },
        { src: `${SNKRDUNK_IMAGE}EB05-061P-of.webp?size=m`, alt: 'EB05-061 나미 시크릿 레어 패러렐', caption: '나미 EB05-061 SEC 패러렐' },
        { src: `${SNKRDUNK_IMAGE}EB05-055P_YBK-of.webp?size=m`, alt: 'EB05-055 나미 야부키 켄타로 일러스트 패러렐', caption: '나미 EB05-055 야부키 켄타로' }
      ],
      items: [
        '망가 버전: EB05-010 니코 로빈(리더), EB05-014 시라호시(슈퍼레어) 2종. EB-03의 망가는 EB03-061 우타 1종이었습니다.',
        '특별 일러스트: EB05-055 나미는 만화가 야부키 켄타로가 그린 패러렐과 그 박 찍힌 버전이 따로 등록돼 있습니다.',
        '등장 캐릭터: 나미, 로빈, 시라호시, 보니, 행콕, 야마토, 페로나, 레베카, 비비, 베이비 5, 스투시, 알비다, 레이주, 슈거, 블랙 마리아, 글로리오사, 노지코, 게르드, 푸딩',
        '아직 거래 전이라 시세는 없습니다. 발매 직후에는 거래가 적어 가격 변동이 큽니다.'
      ]
    },
    {
      heading: '4. vol.1(EB-03)에서는 SP가 가장 비쌌습니다',
      paragraphs: ['EB-03 발매(2025년 10월 25일) 약 1년 뒤의 Single 최근 거래가입니다. 최근 거래가 있는 40장 기준이며 망가보다 SP 카드가 위에 많습니다.'],
      table: {
        numeric: true,
        columns: ['카드', '버전', 'Single', 'PSA10'],
        rows: [
          ['EB03-026 보아 행콕', 'SP', '¥105,154', '¥176,028'],
          ['EB03-061 우타', '망가', '¥80,293', '¥165,231'],
          ['EB03-053 나미', 'SP', '¥71,745', '¥103,598'],
          ['EB03-055 니코 로빈', 'SP', '¥60,220', '¥116,548'],
          ['EB03-003 우타', 'SP', '¥30,980', '¥43,567'],
          ['EB03-031 빈스모크 레이주', 'SP', '¥28,878', '¥20,350']
        ]
      },
      images: [
        { src: `${CARD_IMAGE}EB03-026_p2.webp`, alt: 'EB03-026 보아 행콕 SP', caption: 'EB-03 최고가 행콕 SP' },
        { src: `${CARD_IMAGE}EB03-061_p2.webp`, alt: 'EB03-061 우타 망가 버전', caption: 'EB-03 우타 망가' }
      ],
      stats: [
        { value: '¥28,878', label: 'EB-03 SP 9종 Single 중앙값' },
        { value: '¥1,046', label: 'EB-03 기본판 Single 중앙값' }
      ],
      items: [
        'EB-03은 ¥1만 이상 카드가 9장, ¥5만 이상이 4장입니다.',
        'EB-05도 SP 8종 중 나미·행콕·페로나 같은 인기 캐릭터가 들어 있어, vol.1처럼 SP가 가격을 이끌지 발매 후 확인할 만합니다.'
      ]
    },
    {
      heading: '5. OP-18은 워터 세븐과 신의 기사단',
      items: [
        '공식 소개: 「워터 세븐」과 「신의 기사단」이 테마인 18번째 정규 부스터입니다.',
        '군코(軍子宮)와 샴록 성이 원피스 카드게임에 처음 등장합니다.',
        '전 127종+1종이며 1팩 6장, 1팩 240엔입니다. 레어도별 구성과 수록 카드는 아직 공개되지 않았고 SNKRDUNK 등록 상품도 없습니다.'
      ]
    },
    {
      heading: '6. 직전 정규 부스터 OP-17의 발매 후 6주',
      paragraphs: ['OP-17은 2026년 8월 22일 발매됐습니다. 정규 부스터가 나온 뒤 어떤 카드가 비싸지는지 참고할 수 있습니다. 최근 거래가 있는 62장 기준입니다.'],
      table: {
        numeric: true,
        columns: ['카드', '버전', 'Single'],
        rows: [
          ['EB04-061 루피', '망가 해적단 슈퍼 패러렐', '¥1,297,048'],
          ['OP17-118 록스 D. 지벡', '망가 해적단 슈퍼 패러렐', '¥529,299'],
          ['OP17-022 샹크스', '망가', '¥143,004'],
          ['OP17-079 루피', '리더 망가', '¥116,509'],
          ['OP17-005 에드워드 뉴게이트', '망가', '¥88,546']
        ]
      },
      bars: [
        { label: '망가 (7장)', value: 116509, display: '¥116,509' },
        { label: 'SP (10장)', value: 15254, display: '¥15,254' },
        { label: '패러렐 (31장)', value: 1240, display: '¥1,240' },
        { label: '기본 (14장)', value: 1124, display: '¥1,124' }
      ],
      items: [
        '막대는 버전별 Single 중앙값입니다. OP-17은 망가가 7장으로 많고 가격도 망가에 몰렸습니다.',
        '박스 등록 최저가는 2026년 10월 6일 기준 OP-17 US $74, OP-16 US $54, EB-03 US $86입니다.'
      ]
    },
    {
      heading: '7. 발매 전 확인할 점',
      items: [
        '발매일과 가격은 공식 발표 기준이며 바뀔 수 있습니다. PRECIOUS BOX는 공인점 한정이고 취급하지 않는 매장도 있습니다.',
        '공개 카드 목록은 SNKRDUNK 등록 상품 기준입니다. 정식 카드 리스트는 공식 사이트 발표를 확인하세요.',
        '봉입률은 공식 자료가 없어 다루지 않았습니다. 앞선 부스터의 시세는 참고 자료일 뿐 새 부스터의 가격을 보장하지 않습니다.',
        '한국판 발매일은 아직 발표되지 않았습니다. 지금까지 한국판은 일본판보다 수개월 늦게 나왔습니다.'
      ],
      links: [
        { href: '/guide/release-schedule', label: '신작·발매 일정' },
        { href: '/guide/booster-comparison', label: '부스터별 히트 카드 비교' },
        { href: '/prices/boxes', label: '박스 시세' },
        { href: '/guide/shops', label: '공인점포 찾기' }
      ]
    }
  ],
  checklist: [
    '발매일·가격은 공식 상품 페이지에서 다시 확인하기',
    '공개 카드는 정식 리스트가 나오면 다시 대조하기',
    '발매 직후 시세는 거래가 쌓인 뒤 판단하기',
    '한국판 일정은 한국 공식 발표 기다리기'
  ]
};
