// New booster preview pages (/guide/preview/<slug>), shared by the React page and the pre-rendered HTML.
// Product facts: official JP product pages. Revealed cards: SNKRDUNK products registered under `setName`
// (src/data/market-cards.js, synced daily), so the gallery fills in by itself as more cards are listed.
// `revealed`: cards from the official X account's daily card introductions (image, code read from the card) and,
// without images, cards that at least two Japanese card-info sites list the same way (artifacts/build-revealed.cjs).
// Reference prices: Card Pone SNKRDUNK latest trades on dataDate; the page shows live prices when it can.
const OFFICIAL = 'https://www.onepiece-cardgame.com/onepiececg/bccard/jp/products/';
const x = media => `https://pbs.twimg.com/media/${media}?format=jpg&name=small`;
const info = (code, name, rarity, group = '기본', note = '', file = '') => ({ code, name, rarity, group, note, image: file ? `/card-preview/op18/${file}.webp` : '' });

export const BOOSTER_PREVIEWS = [
  {
    slug: 'eb-05',
    code: 'EB-05',
    title: 'EB-05 Heroines Edition vol.2 프리뷰',
    lead: '여성 캐릭터 중심 엑스트라 부스터 2탄. 지금까지 공개된 카드와 1탄 시세를 모았습니다.',
    seoTitle: '원피스카드 EB-05 Heroines Edition vol.2 프리뷰 - 공개 카드·망가·SP 모음 | Card Pone',
    seoDescription: '10월 31일 발매 EB-05 Heroines Edition vol.2의 공개 카드 이미지(공식 X·SNKRDUNK)와 망가·SP·SEC, 레어도 구성, 1탄 EB-03의 비싼 카드 시세를 한눈에 봅니다.',
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
      '공개 카드는 공식 X 카드 소개와 SNKRDUNK 사전 등록 상품을 모은 것입니다. 공식 카드 리스트는 발매일에 공개됩니다.',
      'HEROINES PRECIOUS BOX(8,470엔, 공인점 한정)는 EB-05 1박스와 스토리지 박스·슬리브 70장·돈!! 10장 구성입니다.',
      '봉입률은 공식 자료가 없습니다. 1탄 시세는 참고일 뿐 가격을 보장하지 않습니다.'
    ],
    related: ['/guide/preview/op-18', '/guide/release-schedule', '/guide/booster-comparison'],
    // Official X introductions (base illustrations); SNKRDUNK supplies the parallels.
    revealed: [
      { code: 'EB05-001', name: '쥬얼리 보니', rarity: 'SR', group: '기본', note: '', image: x('HTD0Ea2aEAANvbR'), source: 'https://x.com/ONEPIECE_tcg/status/2104737933752463364' },
      { code: 'EB05-002', name: '돌', rarity: 'R', group: '기본', note: '', image: x('HRnG5GqbsAAkT_o'), source: 'https://x.com/ONEPIECE_tcg/status/2097490170899763617' },
      { code: 'EB05-005', name: '벨로 베티', rarity: 'C', group: '기본', note: '', image: x('HRGf-0VbMAEbzSP'), source: 'https://x.com/ONEPIECE_tcg/status/2095678228669321405' },
      { code: 'EB05-007', name: '모네', rarity: 'C', group: '기본', note: '', image: x('HQzCFOeaMAAgl9A'), source: 'https://x.com/ONEPIECE_tcg/status/2093503908006302174' },
      { code: 'EB05-009', name: '나랑 같이 죽어 줘!!! (이벤트)', rarity: 'R', group: '기본', note: '', image: x('HSeSRY9bMAAiaXW'), source: 'https://x.com/ONEPIECE_tcg/status/2101838832064942556' },
      { code: 'EB05-011', name: '오토히메', rarity: 'C', group: '기본', note: '', image: x('HRGfvlUbgAA3aJU'), source: 'https://x.com/ONEPIECE_tcg/status/2095315844095951048' },
      { code: 'EB05-012', name: '케이미', rarity: 'R', group: '기본', note: '', image: x('HR2f44VbcAAVd88'), source: 'https://x.com/ONEPIECE_tcg/status/2099302107400605909' },
      { code: 'EB05-013', name: '샤리', rarity: 'C', group: '기본', note: '', image: x('HQjxRBpbwAAWu0x'), source: 'https://x.com/ONEPIECE_tcg/status/2093141521986158608' },
      { code: 'EB05-014', name: '시라호시', rarity: 'SR', group: '기본', note: '', image: x('HSeS4Oha0AAzpKU'), source: 'https://x.com/ONEPIECE_tcg/status/2103650763436093641' },
      { code: 'EB05-016', name: '니코 로빈', rarity: 'SR', group: '기본', note: '', image: x('HTDzFRDbAAAWDjz'), source: 'https://x.com/ONEPIECE_tcg/status/2104375537556734129' },
      { code: 'EB05-017', name: '머메이드 카페 댄서즈', rarity: 'C', group: '기본', note: '', image: x('HRnGgU6bIAAkVti'), source: 'https://x.com/ONEPIECE_tcg/status/2097127786213150913' },
      { code: 'EB05-020', name: '시라호시라고 합니다!! (이벤트)', rarity: 'R', group: '기본', note: '', image: x('HSeSA0jaYAAa3Rq'), source: 'https://x.com/ONEPIECE_tcg/status/2101476441225662915' },
      { code: 'EB05-021', name: '알비다', rarity: 'SR', group: '기본', note: '', image: x('HSeSxNwasAAmuYL'), source: 'https://x.com/ONEPIECE_tcg/status/2103288379744072171' },
      { code: 'EB05-022', name: '옥토파코', rarity: 'C', group: '기본', note: '', image: x('HRXNiCfaEAAV21l'), source: 'https://x.com/ONEPIECE_tcg/status/2096765394396868690' },
      { code: 'EB05-023', name: '오소메', rarity: 'C', group: '기본', note: '', image: x('HQjwrhbakAArkFr'), source: 'https://x.com/ONEPIECE_tcg/status/2092779133533368534' },
      { code: 'EB05-025', name: '도미노', rarity: 'C', group: '기본', note: '', image: x('HRGfQyXboAImZ0s'), source: 'https://x.com/ONEPIECE_tcg/status/2094953456423370983' },
      { code: 'EB05-027', name: '히바리', rarity: 'R', group: '기본', note: '', image: x('HR2fkgTb0AAIkwF'), source: 'https://x.com/ONEPIECE_tcg/status/2098939720529293376' },
      { code: 'EB05-028', name: '보아 행콕', rarity: 'R', group: '기본', note: '', image: x('HSO-ZXBbUAAc1xm'), source: 'https://x.com/ONEPIECE_tcg/status/2100026888118804678' },
      { code: 'EB05-029', name: '袷羽檻(이벤트)', rarity: 'C', group: '기본', note: '', image: x('HSeR4rSbUAAFr3B'), source: 'https://x.com/ONEPIECE_tcg/status/2101114058388742509' },
      { code: 'EB05-034', name: '슈거', rarity: 'SR', group: '기본', note: '', image: x('HSeSoqDboAAm_a4'), source: 'https://x.com/ONEPIECE_tcg/status/2102925985939427515' },
      { code: 'EB05-035', name: '스피드', rarity: 'C', group: '기본', note: '', image: x('HQzDKqeaEAAYcNF'), source: 'https://x.com/ONEPIECE_tcg/status/2094591071674110265' },
      { code: 'EB05-036', name: '츠루', rarity: 'C', group: '기본', note: '', image: x('HQjvN7Ua8AAoEjc'), source: 'https://x.com/ONEPIECE_tcg/status/2092416740772683932' },
      { code: 'EB05-037', name: '블랙 마리아', rarity: 'R', group: '기본', note: '', image: x('HSO-scObEAAjf0E'), source: 'https://x.com/ONEPIECE_tcg/status/2100389276521226562' },
      { code: 'EB05-038', name: '루시안', rarity: 'C', group: '기본', note: '', image: x('HRGgdOebwAEavWi'), source: 'https://x.com/ONEPIECE_tcg/status/2096403010582876250' },
      { code: 'EB05-042', name: '시노부', rarity: 'C', group: '기본', note: '', image: x('HQcijqsasAAjOwe'), source: 'https://x.com/ONEPIECE_tcg/status/2092054351431008547' },
      { code: 'EB05-044', name: '미스 파더스데이', rarity: 'R', group: '기본', note: '', image: x('HR2gMMQakAAX_dA'), source: 'https://x.com/ONEPIECE_tcg/status/2099664496163790940' },
      { code: 'EB05-045', name: '미스 먼데이', rarity: 'C', group: '기본', note: '', image: x('HQzDBR-bsAASJmg'), source: 'https://x.com/ONEPIECE_tcg/status/2094228680814035091' },
      { code: 'EB05-046', name: '야마토', rarity: 'SR', group: '기본', note: '', image: x('HTDyzbdasAAuX4j'), source: 'https://x.com/ONEPIECE_tcg/status/2104013153688309889' },
      { code: 'EB05-047', name: '리플리', rarity: 'R', group: '기본', note: '', image: x('HRnHuPRaUAAbnDf'), source: 'https://x.com/ONEPIECE_tcg/status/2097852556492062837' },
      { code: 'EB05-048', name: '스팅어 헤지호그 (이벤트)', rarity: 'R', group: '기본', note: '', image: x('HSeShvlaoAIj_Jp'), source: 'https://x.com/ONEPIECE_tcg/status/2102563598555853249' },
      { code: 'EB05-051', name: '아히루', rarity: 'C', group: '기본', note: '', image: x('HRGgNbMb0AAibNK'), source: 'https://x.com/ONEPIECE_tcg/status/2096040624067932375' },
      { code: 'EB05-054', name: '샬롯 브륄레', rarity: 'C', group: '기본', note: '', image: x('HQzCkOMbIAAPxWx'), source: 'https://x.com/ONEPIECE_tcg/status/2093866294370013550' },
      { code: 'EB05-055', name: '나미', rarity: 'SR', group: '기본', note: '', image: x('HTD0X6QbQAAswqG'), source: 'https://x.com/ONEPIECE_tcg/status/2105100317209620719' },
      { code: 'EB05-055', name: '나미', rarity: 'SR-P', group: '패러렐', note: '공식 공개 패러렐', image: x('HT1blvqboAAI00l'), source: 'https://x.com/ONEPIECE_tcg/status/2106942459687121154' },
      { code: 'EB05-056', name: '니코 올비아', rarity: 'C', group: '기본', note: '', image: x('HQcieQfbAAAzL7T'), source: 'https://x.com/ONEPIECE_tcg/status/2091691962436849667' },
      { code: 'EB05-057', name: '노지코', rarity: 'R', group: '기본', note: '', image: x('HR2fPXLa0AATdsY'), source: 'https://x.com/ONEPIECE_tcg/status/2098577332130971789' },
      { code: 'EB05-060', name: '「릴리스」를 부탁해!!! (이벤트)', rarity: 'C', group: '기본', note: '', image: x('HSeSaMwaUAAsNNm'), source: 'https://x.com/ONEPIECE_tcg/status/2102201215350341922' },
      info('EB05-024', '사디짱', 'R'),
      info('EB05-050', '아틀라스', 'R')
    ]
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
      note: '발매 6주 뒤 Single. OP-17은 해적단 슈퍼 패러렐과 망가에 가격이 몰렸습니다.',
      cards: [
        { apparelId: 871034, label: '루피', version: '해적단 슈퍼 패러렐', single: 1297048, image: 'https://cdn.snkrdunk.com/upload_bg_removed/96d53107-5908-4b4b-82e3-e11c4dbfb1c4.webp?size=m' },
        { apparelId: 871062, label: '록스 D. 지벡', version: '해적단 슈퍼 패러렐', single: 529299, image: 'https://cdn.snkrdunk.com/upload_bg_removed/d69f0a9d-f02f-4f4b-b795-095fcf5ef82b.webp?size=m' },
        { apparelId: 871066, label: '샹크스', version: '망가', single: 143004, image: 'https://cdn.snkrdunk.com/upload_bg_removed/8bf530d3-6e13-43f7-9304-c8d69e74387e.webp?size=m' },
        { apparelId: 871055, label: '루피 (리더)', version: '슈퍼 리더 패러렐', single: 116509, image: 'https://cdn.snkrdunk.com/upload_bg_removed/957c31c0-e5e4-478e-8a8b-eb15fe4cff68.webp?size=m' }
      ]
    },
    notes: [
      '이미지는 공식 X 카드 소개와, ONE PIECE DAY’26에서 공개된 카드는 일본 카드 정보 사이트(tier-one)의 이미지입니다.',
      '봉입률은 공식 자료가 없습니다. 직전 부스터 시세는 참고일 뿐 가격을 보장하지 않습니다.'
    ],
    related: ['/guide/preview/eb-05', '/guide/release-schedule', '/guide/booster-comparison'],
    revealed: [
      { code: 'OP18-003', name: '바다고양이', rarity: 'C', group: '기본', note: '', image: x('HSeWsCObkAA-ycc'), source: 'https://x.com/ONEPIECE_tcg/status/2102216315901796373' },
      { code: 'OP18-016', name: '몽키 D. 루피', rarity: 'C', group: '기본', note: '', image: x('HTDxTz1a4AEdZih'), source: 'https://x.com/ONEPIECE_tcg/status/2104390640670998733' },
      { code: 'OP18-017', name: '롤로노아 조로', rarity: 'C', group: '기본', note: '', image: x('HTR8r-TaEAADfCC'), source: 'https://x.com/ONEPIECE_tcg/status/2106564968602574946' },
      { code: 'OP18-024', name: '코코로', rarity: 'C', group: '기본', note: '', image: x('HTR88N-acAAq--a'), source: 'https://x.com/ONEPIECE_tcg/status/2106927351992840538' },
      { code: 'OP18-025', name: '곤베', rarity: 'C', group: '기본', note: '', image: x('HTDxlWZbAAAwjm3'), source: 'https://x.com/ONEPIECE_tcg/status/2104753028741881962' },
      { code: 'OP18-028', name: '침니', rarity: 'C', group: '기본', note: '', image: x('HSeWzEqaEAA6-Xb'), source: 'https://x.com/ONEPIECE_tcg/status/2102578702467072201' },
      { code: 'OP18-044', name: 'Mr.빈즈 & 미스 캐서리나', rarity: 'C', group: '기본', note: '', image: x('HTR7b6tbMAAvM9N'), source: 'https://x.com/ONEPIECE_tcg/status/2105115417593389499' },
      { code: 'OP18-055', name: 'Mr.9 & 미스 웬즈데이', rarity: 'C', group: '기본', note: '', image: x('HTR9I1raEAAbYVq'), source: 'https://x.com/ONEPIECE_tcg/status/2107289742358495406' },
      { code: 'OP18-056', name: 'Mr.13 & 미스 프라이데이', rarity: 'C', group: '기본', note: '', image: x('HSeW5rTb0AA8nIG'), source: 'https://x.com/ONEPIECE_tcg/status/2102947558436024702' },
      { code: 'OP18-066', name: '잠바이', rarity: 'C', group: '기본', note: '', image: x('HTBRQUyboAExjXO'), source: 'https://x.com/ONEPIECE_tcg/status/2103303479720604068' },
      { code: 'OP18-069', name: '소돔 & 고모라', rarity: 'C', group: '기본', note: '', image: x('HT2YxRjasAA7H8z'), source: 'https://x.com/ONEPIECE_tcg/status/2107652136443990285' },
      { code: 'OP18-076', name: '샤크 서브머지 3호', rarity: 'UC', group: '기본', note: '', image: x('HTR74IfbsAAjgml'), source: 'https://x.com/ONEPIECE_tcg/status/2105477805098103054' },
      { code: 'OP18-086', name: '골드버그', rarity: 'C', group: '기본', note: '', image: x('HTDwbz8bIAEl88h'), source: 'https://x.com/ONEPIECE_tcg/status/2103665867338694788' },
      { code: 'OP18-089', name: '도리', rarity: 'C', group: '기본', note: '', image: x('HTR8KAJasAAAexF'), source: 'https://x.com/ONEPIECE_tcg/status/2105840188375335416' },
      { code: 'OP18-106', name: '도베르만', rarity: 'C', group: '기본', note: '', image: x('HTR8dfYawAAarWO'), source: 'https://x.com/ONEPIECE_tcg/status/2106202576328773710' },
      { code: 'OP18-112', name: '야마카지', rarity: 'C', group: '기본', note: '', image: x('HTDxBN-acAAI6pO'), source: 'https://x.com/ONEPIECE_tcg/status/2104028254789345731' },
      // ONE PIECE DAY'26 reveals (stage/stream only); images from the tier-one list, re-encoded under public/card-preview/op18.
      info('OP18-031', '니코 로빈', 'SR-SP', '망가', '', 'op18-031sp'),
      info('OP18-065', '군코', 'SR-SP', '슈퍼 패러렐', '신의 기사단 슈퍼 패러렐', 'op18-065sp'),
      info('OP18-001', '카루', 'L', '리더', '', 'op18-001'),
      info('OP18-021', '프랑키', 'L', '리더', '', 'op18-021'),
      info('OP18-021', '프랑키', 'L-P', '리더', '패러렐', 'op18-021p'),
      info('OP18-022', '몽키 D. 루피', 'L', '리더', '', 'op18-022'),
      info('OP18-041', '미스 올 선데이', 'L', '리더', '', 'op18-041'),
      info('OP18-060', '군코', 'L', '리더', '', 'op18-060'),
      info('OP18-060', '군코', 'L-P', '리더', '패러렐', 'op18-060p'),
      info('OP18-079', '스판담', 'L', '리더', '', 'op18-079'),
      info('OP18-119', '샴록 성', 'SEC', 'SEC'),
      info('OP18-119', '샴록 성', 'SEC-P', '특별 일러스트', '아마노 요시타카 일러스트', 'op18-119p-001'),
      info('OP18-119', '샴록 성', 'SEC-P', '특별 일러스트', '아마노 요시타카 일러스트 · 박 버전', 'op18-119p-002'),
      info('OP17-119', '로키', 'SEC-P', '특별 일러스트', '아마노 요시타카 일러스트', 'op17-119p-001'),
      info('OP17-119', '로키', 'SEC-P', '특별 일러스트', '아마노 요시타카 일러스트 · 박 버전', 'op17-119p-002'),
      info('OP18-011', '네펠타리 비비', 'SR', '기본', '', 'op18-011'),
      info('OP18-034', '프랑키', 'SR', '기본', '', 'op18-034'),
      info('OP18-046', 'Mr.0 & 미스 올 선데이', 'SR', '기본', '', 'op18-046'),
      info('OP18-048', 'Mr.1 & 미스 더블 핑거', 'SR', '기본', '', 'op18-048'),
      info('OP18-061', '아이스버그', 'SR', '기본', '', 'op18-061'),
      info('OP18-065', '군코', 'SR'),
      info('OP18-084', '군코', 'SR', '기본', '', 'op18-084'),
      info('OP18-100', '칼리파', 'SR', '기본', '', 'op18-100'),
      info('OP18-113', '롭 루치', 'SR', '기본', '', 'op18-113'),
      info('OP18-093', 'MMA', 'R', '기본', '', 'op18-093-001'),
      info('OP18-078', '미니 메리호', 'UC', '기본', '', 'op18-078')
    ]
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
const GROUPS = ['망가', '슈퍼 패러렐', '슈퍼 리더 패러렐', 'SP', 'SEC', '리더', '특별 일러스트', '패러렐', '기본'];

// "Nico Robin L-SP (Manga Alt Art) [EB05-010](Extra Booster ...)" -> name, rarity, version group.
export function parsePreviewCard(item) {
  const head = String(item.name || '').split(' [')[0];
  const match = head.match(/^(.*?) (L|C|UC|R|SR|SEC|TR|SP)(-[A-Z]+)?\b(.*)$/) || [];
  const english = (match[1] || head).replace(/\s*\(([^)]*)\)\s*$/, '').trim();
  const artist = (head.match(/\(([^)]*)\)/) || [])[1];
  const rarity = `${match[2] || ''}${match[3] || ''}`;
  const extra = match[4] || '';
  // SNKRDUNK's "Manga Alt Art" is a manga rare, except leader super parallels (L-SP) and Pirate Crew Super Parallels.
  const superParallel = /Super Parallel/i.test(extra);
  const group = /^L-SP/.test(rarity) ? '슈퍼 리더 패러렐'
    : superParallel ? '슈퍼 패러렐'
    : /Manga|Comic/i.test(head) ? '망가'
    : /-SPC\b/.test(rarity) || /Special Card/i.test(extra) ? 'SP'
      : /^SEC/.test(rarity) ? 'SEC'
        : /^L/.test(rarity) ? '리더'
          : (artist && !/Manga|Comic/i.test(artist)) || /Foil Stamped/i.test(extra) ? '특별 일러스트'
            : /-P\b/.test(rarity) ? '패러렐' : '기본';
  const note = [artist && !/Manga|Comic/i.test(artist) ? ARTISTS[artist] || artist : '', /Pirate Crew Super Parallel/i.test(extra) ? '해적단 슈퍼 패러렐' : '', /Foil Stamped/i.test(extra) ? '박 버전' : ''].filter(Boolean).join(' · ');
  return { apparelId: item.apparelId, code: item.code, name: KOREAN_NAMES[english] || english, rarity, group, note, image: item.previewImageUrl || '' };
}

// SNKRDUNK listings first; cards revealed on the official X account fill in what SNKRDUNK has not listed yet.
export function getPreviewCards(preview, market = []) {
  const pattern = preview.setPattern ? new RegExp(preview.setPattern, 'i') : null;
  const codePattern = preview.codePattern ? new RegExp(preview.codePattern) : null;
  const listed = market
    .filter(item => item.locale === 'JP' && !/DON!!/.test(item.name) && ((preview.setName && item.setName === preview.setName) || (pattern && pattern.test(item.setName || '')) || (codePattern && codePattern.test(item.code || ''))))
    .map(parsePreviewCard);
  const keys = new Set(listed.map(card => `${card.code}|${card.group}|${card.note}`));
  const revealed = (preview.revealed || []).filter(card => !keys.has(`${card.code}|${card.group}|${card.note || ''}`)).map(card => ({ apparelId: null, note: '', image: '', ...card }));
  return [...listed, ...revealed]
    .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.code.localeCompare(b.code));
}

export function groupPreviewCards(cards) {
  return GROUPS.map(group => ({ group, cards: cards.filter(card => card.group === group) })).filter(entry => entry.cards.length);
}

export const formatPreviewYen = value => `¥${Math.round(value).toLocaleString('ja-JP')}`;
