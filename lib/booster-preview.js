// New booster preview pages (/guide/preview/<slug>), shared by the React page and the pre-rendered HTML.
// Product facts: official JP product pages. Revealed cards: SNKRDUNK products registered under `setName`
// (src/data/market-cards.js, synced daily), so the gallery fills in by itself as more cards are listed.
// Reference prices: Card Pone SNKRDUNK latest trades on dataDate; the page shows live prices when it can.
const OFFICIAL = 'https://www.onepiece-cardgame.com/onepiececg/bccard/jp/products/';

export const BOOSTER_PREVIEWS = [
  {
    slug: 'eb-05',
    code: 'EB-05',
    title: 'EB-05 Heroines Edition vol.2 프리뷰',
    lead: '여성 캐릭터 중심 엑스트라 부스터 2탄. 지금까지 공개된 카드와 1탄 시세를 모았습니다.',
    seoTitle: '원피스카드 EB-05 Heroines Edition vol.2 프리뷰 - 공개 카드·망가·SP 모음 | Card Pone',
    seoDescription: '10월 31일 발매 EB-05 Heroines Edition vol.2의 공개된 망가·SP·SEC 카드 이미지와 레어도 구성, 1탄 EB-03의 비싼 카드 시세를 한눈에 봅니다.',
    seoKeywords: '원피스카드 EB-05, EB05, 히로인즈 에디션 vol.2, Heroines Edition vol.2, 원피스카드 신작, 원피스카드 망가 레어',
    reviewedAt: '2026-10-07',
    dataDate: '2026-10-07',
    image: `${OFFICIAL}2026/09/28/FHBmiFAZAVNXT3A0/img_features_01.webp`,
    officialUrl: 'https://www.onepiece-cardgame.com/products/eb05.html',
    setName: 'Extra Booster "Heroines Edition Vol.2"',
    facts: [
      { value: '10월 31일', label: '일본판 발매' },
      { value: '240엔', label: '1팩 6장' },
      { value: '75종', label: '수록 (돈!! 2종 별도)' },
      { value: '리더 7종', label: '1탄은 1종' }
    ],
    composition: {
      columns: ['', '리더', 'C', 'R', 'SR', 'SEC', 'SP'],
      rows: [['EB-05', '7', '29', '21', '9', '1', '8'], ['EB-03 (1탄)', '1', '29', '21', '9', '2', '9']]
    },
    reference: {
      title: '1탄 EB-03에서 비싼 카드',
      note: '발매 약 1년 뒤 Single. 1탄은 망가보다 SP가 비쌌습니다.',
      cards: [
        { apparelId: 710430, label: '보아 행콕', version: 'SP', single: 105154, image: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-10-10-EB03-026-of.webp?size=m' },
        { apparelId: 714426, label: '우타', version: '망가', single: 80293, image: 'https://cdn.snkrdunk.com/upload_bg_removed/20251024123854-0.webp?size=m' },
        { apparelId: 710436, label: '나미', version: 'SP', single: 71745, image: 'https://cdn.snkrdunk.com/upload_bg_removed/20251022105956-15.webp?size=m' },
        { apparelId: 710437, label: '니코 로빈', version: 'SP', single: 60220, image: 'https://cdn.snkrdunk.com/upload_bg_removed/20251022110622-1.webp?size=m' }
      ]
    },
    notes: [
      '공개 카드는 SNKRDUNK 사전 등록 상품 기준이며, 공식 카드 리스트는 발매일에 공개됩니다.',
      'HEROINES PRECIOUS BOX(8,470엔, 공인점 한정)는 EB-05 1박스와 스토리지 박스·슬리브 70장·돈!! 10장 구성입니다.',
      '봉입률은 공식 자료가 없습니다. 1탄 시세는 참고일 뿐 가격을 보장하지 않습니다.'
    ],
    related: ['/guide/preview/op-18', '/guide/release-schedule', '/guide/booster-comparison']
  },
  {
    slug: 'op-18',
    code: 'OP-18',
    title: 'OP-18 神の支配(신의 지배) 프리뷰',
    lead: '워터 세븐과 신의 기사단이 테마인 18번째 정규 부스터. 군코와 샴록 성이 처음 등장합니다.',
    seoTitle: '원피스카드 OP-18 신의 지배 프리뷰 - 발매일·구성·공개 카드 | Card Pone',
    seoDescription: '11월 21일 발매 OP-18 신의 지배(神の支配)의 발매일·가격·수록 종류와 공개 카드, 직전 부스터 OP-17의 발매 후 비싼 카드를 정리합니다.',
    seoKeywords: '원피스카드 OP-18, OP18, 신의 지배, 神の支配, 원피스카드 신작, 원피스카드 부스터',
    reviewedAt: '2026-10-07',
    dataDate: '2026-10-07',
    image: `${OFFICIAL}2026/09/17/7uzbgKpyFz1VnsOG/img_features_01.webp`,
    officialUrl: 'https://www.onepiece-cardgame.com/products/op18.html',
    // SNKRDUNK's English set name is not known before listing; new OP18 numbers identify the cards.
    setName: '',
    setPattern: '神の支配|OP-18',
    codePattern: '^OP18-',
    facts: [
      { value: '11월 21일', label: '일본판 발매' },
      { value: '240엔', label: '1팩 6장' },
      { value: '127종', label: '수록 (+1종)' },
      { value: '4주년', label: '패키지 로고' }
    ],
    reference: {
      title: '직전 정규 부스터 OP-17에서 비싼 카드',
      note: '발매 6주 뒤 Single. OP-17은 망가 버전에 가격이 몰렸습니다.',
      cards: [
        { apparelId: 871034, label: '루피 (해적단 슈퍼 패러렐)', version: '망가', single: 1297048, image: 'https://cdn.snkrdunk.com/upload_bg_removed/96d53107-5908-4b4b-82e3-e11c4dbfb1c4.webp?size=m' },
        { apparelId: 871062, label: '록스 D. 지벡 (해적단 슈퍼 패러렐)', version: '망가', single: 529299, image: 'https://cdn.snkrdunk.com/upload_bg_removed/d69f0a9d-f02f-4f4b-b795-095fcf5ef82b.webp?size=m' },
        { apparelId: 871066, label: '샹크스', version: '망가', single: 143004, image: 'https://cdn.snkrdunk.com/upload_bg_removed/8bf530d3-6e13-43f7-9304-c8d69e74387e.webp?size=m' },
        { apparelId: 871055, label: '루피 (리더)', version: '망가', single: 116509, image: 'https://cdn.snkrdunk.com/upload_bg_removed/957c31c0-e5e4-478e-8a8b-eb15fe4cff68.webp?size=m' }
      ]
    },
    notes: [
      '수록 카드는 아직 공식 사이트와 SNKRDUNK 어디에도 공개되지 않았습니다. 등록되는 대로 위 목록에 추가됩니다.',
      '봉입률은 공식 자료가 없습니다. 직전 부스터 시세는 참고일 뿐 가격을 보장하지 않습니다.'
    ],
    related: ['/guide/preview/eb-05', '/guide/release-schedule', '/guide/booster-comparison']
  }
];

export const BOOSTER_PREVIEW_PATH = '/guide/preview';
export const getBoosterPreview = path => BOOSTER_PREVIEWS.find(preview => `${BOOSTER_PREVIEW_PATH}/${preview.slug}` === path) || null;

const KOREAN_NAMES = {
  'Nefeltari Vivi': '네펠타리 비비', 'Jewelry Bonney': '쥬얼리 보니', 'Baby 5': '베이비 5', 'Miss Buckingham Stussy': '스투시',
  'Nico Robin': '니코 로빈', Shirahoshi: '시라호시', Rebecca: '레베카', Alvida: '알비다', 'Boa Hancock': '보아 행콕',
  'Vinsmoke Reiju': '빈스모크 레이주', Sugar: '슈거', 'Black Maria': '블랙 마리아', Perona: '페로나', Yamato: '야마토',
  Gloriosa: '글로리오사', Nami: '나미', Nojiko: '노지코', Gerd: '게르드', 'Charlotte Pudding': '샬롯 푸딩', Uta: '우타'
};
const ARTISTS = { 'Kentaro Yabuki': '야부키 켄타로 일러스트' };
const GROUPS = ['망가', 'SP', 'SEC', '리더', '특별 일러스트', '패러렐', '기본'];

// "Nico Robin L-SP (Manga Alt Art) [EB05-010](Extra Booster ...)" -> name, rarity, version group.
export function parsePreviewCard(item) {
  const head = String(item.name || '').split(' [')[0];
  const match = head.match(/^(.*?) (L|C|UC|R|SR|SEC|TR|SP)(-[A-Z]+)?\b(.*)$/) || [];
  const english = (match[1] || head).replace(/\s*\(([^)]*)\)\s*$/, '').trim();
  const artist = (head.match(/\(([^)]*)\)/) || [])[1];
  const rarity = `${match[2] || ''}${match[3] || ''}`;
  const extra = match[4] || '';
  const group = /Manga|Comic/i.test(head) ? '망가'
    : /-SPC\b/.test(rarity) || /Special Card/i.test(extra) ? 'SP'
      : /^SEC/.test(rarity) ? 'SEC'
        : /^L/.test(rarity) ? '리더'
          : (artist && !/Manga|Comic/i.test(artist)) || /Foil Stamped/i.test(extra) ? '특별 일러스트'
            : /-P\b/.test(rarity) ? '패러렐' : '기본';
  const note = [artist && !/Manga|Comic/i.test(artist) ? ARTISTS[artist] || artist : '', /Foil Stamped/i.test(extra) ? '박 버전' : ''].filter(Boolean).join(' · ');
  return { apparelId: item.apparelId, code: item.code, name: KOREAN_NAMES[english] || english, rarity, group, note, image: item.previewImageUrl || '' };
}

export function getPreviewCards(preview, market = []) {
  const pattern = preview.setPattern ? new RegExp(preview.setPattern, 'i') : null;
  const codePattern = preview.codePattern ? new RegExp(preview.codePattern) : null;
  return market
    .filter(item => item.locale === 'JP' && !/DON!!/.test(item.name) && ((preview.setName && item.setName === preview.setName) || (pattern && pattern.test(item.setName || '')) || (codePattern && codePattern.test(item.code || ''))))
    .map(parsePreviewCard)
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.code.localeCompare(b.code));
}

export function groupPreviewCards(cards) {
  return GROUPS.map(group => ({ group, cards: cards.filter(card => card.group === group) })).filter(entry => entry.cards.length);
}

export const formatPreviewYen = value => `¥${Math.round(value).toLocaleString('ja-JP')}`;
