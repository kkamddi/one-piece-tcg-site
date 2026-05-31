import React, { useEffect, useMemo, useState } from 'react';
import { fetchAdminStats, trackVisit } from './api/admin';
import { resolveLoginEmail } from './api/auth';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import { fetchMyState } from './api/me';
import { saveMyState } from './api/me';
import { fetchShopRegions, fetchShops } from './api/shops';
import { hasSupabaseAuthConfig, supabase } from './lib/supabase';
import boxMarketItems from './data/box-market-items';
import seriesData from './data/series.json';
import seriesCardCounts from './data/series-card-counts.json';
import './renew.css';

const LOGO_SRC = '/onepiece-logo-main-tight.png';
const DONATION_URL = 'https://acoffee.shop/d/573d0164-c9c5-45e7-84ce-ed432026517c';
const SNKRDUNK_MARKET_URL = 'https://snkrdunk.com/en/invitation/AGJ872';
const THEME_STORAGE_KEY = 'one-piece-tcg-theme';
const UI_LANG_STORAGE_KEY = 'one-piece-tcg-ui-lang';
const VISITOR_TOKEN_KEY = 'one-piece-tcg-visitor-token';
const RENEWAL_NOTICE_KEY = 'one-piece-tcg-renewal-notice-2026-05-29';
const PORTFOLIO_IMAGE_CACHE_KEY = 'one-piece-tcg-portfolio-image-cache-v2';
const RARITY_ORDER = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const DEFERRED_RARITIES = new Set(['C', 'UC']);
const RENEW_HOME_UPDATES = [
  {
    id: '2026-05-30-op16',
    title: '[26.05.30] 업데이트 안내',
    summary: 'OP-16 업데이트 완료',
    details: [
      '일본판 부스터 팩 OP-16 「決戦の刻」 카드도감 추가',
      'OP-16 카드 155장 이미지 및 상세 정보 반영',
      '일본판 카테고리에서 최신 부스터 팩으로 확인 가능'
    ]
  },
  {
    id: '2026-05-29-renewal',
    title: '[26.05.29] 홈페이지 리뉴얼 안내',
    summary: '홈페이지 UI 리뉴얼 및 시세 매핑 개선',
    details: [
      '메인 화면을 리뉴얼 UI로 전환',
      '도감·시세·덱 시뮬레이터·구매처 화면의 디자인 톤 정리',
      '카드도감에서 승인된 시세 상품은 정확한 상품 ID로 바로 이동',
      '시세 후보 선택 화면에 카드 이미지 미리보기 추가'
    ]
  },
  {
    id: '2026-05-25-update',
    title: '[26.05.25] 업데이트 안내',
    summary: '카드 빠른 검색 및 컬렉션 가치 팝업 추가',
    details: [
      '카드도감 검색창 아래 루피·조로·나미·에이스·로·샹크스 빠른 검색 버튼 추가',
      '한글판·일본판·영문판에 맞춘 캐릭터 이름으로 바로 검색 가능',
      '메인 화면 컬렉션 가치에서 A등급·PSA10 보유 카드를 이미지 팝업으로 확인 가능',
      '팝업에서 제거한 카드는 컬렉션 가치와 계정 저장 정보에 즉시 반영'
    ]
  },
  {
    id: '2026-05-21-update',
    title: '[26.05.21] 업데이트 안내',
    summary: '카드 이미지와 계정 저장 안정화',
    details: [
      '카드 이미지 로딩 방식 개선',
      '보유중·위시리스트 계정 저장 안정화',
      '카드도감 전체시리즈 필터 로딩 개선'
    ]
  },
  {
    id: '2026-05-18-update',
    title: '[26.05.18] 업데이트 안내',
    summary: '카드도감 속도 개선',
    details: [
      '초기 접속 병목 감소',
      '시리즈별 카드 로딩 구조 개선',
      '전체시리즈 더보기 흐름 정리'
    ]
  },
  {
    id: '2026-05-05-update',
    title: '[26.05.05] 업데이트 안내',
    summary: '일본판·영문판 카드 도감 추가',
    details: [
      '일본판 카드 도감 추가',
      '일본판 수집표 적용 완료',
      '일본판 덱 시뮬레이터 적용 완료',
      '일본판 카드 이미지 표시 적용 완료',
      '일본판에서 한글 검색 가능',
      '영문판 카드 도감 추가'
    ]
  }
];
const COUPANG_PARTNER_ITEMS = [
  { title: '슬리브', description: '카드 기본 보호용', href: 'https://link.coupang.com/a/eaCOdZmKuO' },
  { title: '탑로더', description: '고가 카드 보관용', href: 'https://link.coupang.com/a/eaCQ3DWFZ6' },
  { title: '바인더', description: '컬렉션 정리용', href: 'https://link.coupang.com/a/eaCTozQr92' },
  { title: '자석케이스', description: '전시·장기 보관용', href: 'https://link.coupang.com/a/eaCV5rRP1U' }
];
const OFFICIAL_LINK_ITEMS = [
  { labelKr: '공식카페', labelEn: 'Official Cafe', href: 'https://cafe.naver.com/onepiecetcg', external: true },
  { labelKr: '공식사이트 KR', labelEn: 'Official KR', href: 'https://onepiece-cardgame.kr/', external: true },
  { labelKr: '공식사이트 JP', labelEn: 'Official JP', href: 'https://www.onepiece-cardgame.com/', external: true },
  { labelKr: 'Instagram', labelEn: 'Instagram', href: 'https://www.instagram.com/onepiece_tcg_kr/', external: true }
];

function getBaseSeriesId(seriesOrId) {
  if (typeof seriesOrId === 'object' && seriesOrId) return seriesOrId.baseSeriesId ?? seriesOrId.id ?? '';
  return String(seriesOrId ?? '').replace(/^(KR|JP|EN)-/, '');
}

function sortDescByCode(items) {
  return [...items].sort((a, b) => getBaseSeriesId(b).localeCompare(getBaseSeriesId(a), 'en', { numeric: true }));
}

function getSeriesIdFromCardId(cardId) {
  const match = String(cardId || '').match(/^(KR|JP)::([A-Z]+)(\d*)-/);
  if (!match) return '';
  const [, locale, prefix, number] = match;
  if (prefix === 'P') return `${locale}-PROMO`;
  return `${locale}-${prefix}${number}`;
}

function buildRenewSeriesSections(seriesList) {
  const regular = sortDescByCode(seriesList.filter((series) => /^OP\d+/.test(getBaseSeriesId(series))));
  const extra = sortDescByCode(seriesList.filter((series) => /^(EB|PRB)\d+/.test(getBaseSeriesId(series))));
  const starter = sortDescByCode(seriesList.filter((series) => /^ST\d+/.test(getBaseSeriesId(series))));
  const promo = seriesList.filter((series) => getBaseSeriesId(series) === 'PROMO');
  return [
    { id: 'all', label: '전체', children: [] },
    { id: 'regular', label: '부스터 팩', children: regular },
    { id: 'extra', label: '엑스트라 / 프리미엄', children: extra },
    { id: 'starter', label: '스타터덱', children: starter },
    { id: 'promo', label: '프로모', children: promo }
  ];
}

function getDefaultRenewSeriesId(locale) {
  const list = seriesData.filter((series) => (series.locale ?? 'KR') === locale);
  const sections = buildRenewSeriesSections(list);
  for (const section of sections) {
    const first = section.children.find((series) => series.id);
    if (first) return first.id;
  }
  return list[0]?.id || '';
}

function getOrderedRarities(cards) {
  const present = [...new Set(cards.map((card) => card.rarity).filter(Boolean))];
  return [...RARITY_ORDER.filter((rarity) => present.includes(rarity)), ...present.filter((rarity) => !RARITY_ORDER.includes(rarity)).sort()];
}

function groupByRarity(cards) {
  return getOrderedRarities(cards).map((rarity) => ({
    rarity,
    cards: cards.filter((card) => card.rarity === rarity)
  })).filter((group) => group.cards.length);
}

function getCardImageSrc(card) {
  const source = card?.imageUrl || card?.image_url || card?.image || '';
  if (!source) return '/card-placeholder.svg';
  if (/^https:\/\/(www\.)?onepiece-cardgame\.(com|kr)\//.test(source)) {
    if (typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)) {
      return source;
    }
    return `/api/card-image?url=${encodeURIComponent(source)}`;
  }
  return source;
}

function placeholderImage(event) {
  event.currentTarget.src = '/card-placeholder.svg';
}

function isPlaceholderImageUrl(value) {
  return !value || String(value).includes('/card-placeholder.svg');
}

function loadPortfolioImageCache() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PORTFOLIO_IMAGE_CACHE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function savePortfolioImageCache(cache) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PORTFOLIO_IMAGE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be unavailable in private mode; image fallback still works for this session.
  }
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/^OPC-/, '');
}

function makeMarketStateKey(item, grade) {
  return `MARKET::${item.code}::${item.apparelId || item.sourceUrl || item.name}::${grade}`;
}

let cardMarketLinksPromise = null;

function loadCardMarketLinks() {
  cardMarketLinksPromise ??= import('./data/card-market-links.js')
    .then((module) => (Array.isArray(module.default) ? module.default : []))
    .catch(() => []);
  return cardMarketLinksPromise;
}

async function findApprovedCardMarketLink(card) {
  if (!card) return null;
  const cardMarketLinks = await loadCardMarketLinks();
  return cardMarketLinks.find((link) => {
    if (link.status !== 'approved') return false;
    if (link.cardId) return link.cardId === (card.id || card.cardId);
    if (normalizeCode(link.cardNo) !== normalizeCode(card.cardNo)) return false;
    if (link.locale && link.locale !== card.locale) return false;
    if (link.variantKey && link.variantKey !== (card.variantKey || '')) return false;
    return true;
  }) || null;
}

async function findApprovedCardMarketLinkByApparelId(apparelId) {
  if (!apparelId) return null;
  const cardMarketLinks = await loadCardMarketLinks();
  return cardMarketLinks.find((link) => (
    link.status === 'approved' &&
    link.cardId &&
    String(link.apparelId) === String(apparelId)
  )) || null;
}

function formatYen(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '¥0';
  return `¥${Math.round(amount).toLocaleString('ko-KR')}`;
}

function formatWonFromYen(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '₩0';
  return `₩${Math.round(amount * 9.4).toLocaleString('ko-KR')}`;
}

function formatPercent(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0%';
  return `${amount.toFixed(amount >= 10 ? 0 : 1)}%`;
}

function formatMarketDate(timestamp) {
  const date = new Date(Number(timestamp || 0));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function getUserDisplayName(user) {
  const metadata = user?.user_metadata || {};
  return metadata.nickname || metadata.username || user?.email?.split('@')[0] || '계정';
}

async function fetchMarketPrice({ code, apparelId, summary = false } = {}) {
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (apparelId) params.set('apparelId', String(apparelId));
  if (summary) params.set('summary', '1');
  const response = await fetch(`/api/market?${params.toString()}`, { cache: 'no-store' });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  return payload;
}

const NAV_ITEMS = [
  { id: 'cards', labelKey: 'navCards' },
  { id: 'prices', labelKey: 'navPrices' },
  { id: 'deck', labelKey: 'navDeck' },
  { id: 'shops', labelKey: 'navShops' }
];
const UI_TEXT = {
  KR: {
    navCards: '도감',
    navPrices: '시세',
    navDeck: '덱 시뮬레이터',
    navShops: '구매처',
    login: '로그인',
    logout: '로그아웃',
    donate: '후원',
    searchKr: '한글판',
    searchJp: '일본판',
    searchPlaceholder: '카드명 또는 품번 검색...',
    category: '카테고리',
    all: '전체',
    owned: '보유중',
    wishlist: '위시리스트',
    search: '검색',
    searchResults: '검색 결과',
    loading: '불러오는 중...',
    noResults: '검색 결과가 없습니다.',
    cardsUnit: '장',
    cardInfo: '카드 정보',
    effect: '효과',
    effectPending: '효과 정보 준비 중',
    cost: '코스트',
    power: '파워',
    openMarket: '바로 카드시세 보기',
    searchSameName: '같은 이름 카드 검색',
    officialInfo: '공식 정보보기',
    loginRequired: '로그인 후 이용해 주세요.',
    backToCatalog: '← 도감으로 돌아가기',
    marketCodePlaceholder: '품번 검색 예: OP05-119',
    marketSearch: '시세 검색',
    marketLoading: '시세 후보를 찾는 중...',
    marketNoCandidates: '매핑된 시세 후보가 없습니다.',
    marketFallback: '정확한 시세 매핑을 찾지 못해 품번 검색으로 표시합니다.',
    marketDetailError: '시세 상세 정보를 불러오지 못했습니다.',
    variantSelect: '등급 / 버전 선택',
    sourceMarket: '스니덩 원문 보기',
    snkrShortcut: '바로가기',
    addAGrade: 'A등급 추가',
    addPsa10: 'PSA10등급 추가',
    aGrade: 'A등급',
    addedToPortfolio: '컬렉션 가치에 추가했습니다.',
    noChart: '그래프 데이터가 없습니다.',
    recentSales: '최근 거래',
    noRecentSales: '최근 거래 데이터가 없습니다.',
    boxMarketTitle: '박스 시세',
    boxMarketHelp: 'SNKRDUNK 기준 박스 가격을 인기순으로 확인합니다.',
    boxSortLatest: '인기순',
    boxSortHigh: '가격 높은순',
    boxSortLow: '가격 낮은순',
    checkPrice: '가격 확인',
    deckSearchPlaceholder: '덱에 넣을 카드 검색',
    currentDeck: '현재 덱',
    deckComingSoonTitle: '덱 시뮬레이터 준비중',
    deckComingSoonBody: '덱 저장과 공유 흐름을 안정화한 뒤 다시 열겠습니다.',
    close: '닫기',
    allShops: '전체 매장',
    officialShop: '공식 취급점',
    searchShop: '검색 매장',
    allRegions: '전체 지역',
    allDistricts: '전체 시군구',
    shopSearchPlaceholder: '매장명 또는 주소 검색',
    progress: '수집 진행도',
    updateNotice: '업데이트 공지',
    updateTitle: 'OP-16 업데이트 완료',
    updateHelp: '클릭하면 이전 공지까지 확인할 수 있습니다.',
    visitorsTotal: '누적 고유 방문자',
    visitorsToday: '오늘 고유 방문자',
    usersTotal: '전체 회원 수',
    signupsToday: '오늘 가입자',
    footerIntro: 'OPTCG Korea는 원피스 카드게임 유저를 위한 비공식 카드 도감·시세·컬렉션 관리 서비스입니다.',
    footerRights: 'ONE PIECE CARD GAME 및 관련 이미지, 명칭, 상표의 권리는 각 권리자에게 있으며,',
    footerNoAffiliation: '본 사이트는 BANDAI 및 공식 유통사와 제휴되어 있지 않습니다.',
    footerPriceNotice: '제공되는 시세 정보는 참고용이며, 실제 거래 가격과 차이가 있을 수 있습니다.',
    footerResponsibility: '구매 및 판매 결정에 대한 책임은 이용자 본인에게 있습니다.',
    terms: '이용약관',
    privacy: '개인정보처리방침',
    contact: '문의하기',
    partnership: '광고/제휴 문의'
  },
  EN: {
    navCards: 'Cards',
    navPrices: 'Prices',
    navDeck: 'Deck Builder',
    navShops: 'Shops',
    login: 'Login',
    logout: 'Logout',
    donate: 'Donation',
    searchKr: 'KR',
    searchJp: 'JP',
    searchPlaceholder: 'Search card name or code...',
    category: 'Category',
    all: 'All',
    owned: 'Owned',
    wishlist: 'Wishlist',
    search: 'Search',
    searchResults: 'Search Results',
    loading: 'Loading...',
    noResults: 'No results found.',
    cardsUnit: 'cards',
    cardInfo: 'Card Info',
    effect: 'Effect',
    effectPending: 'Effect details are being prepared.',
    cost: 'Cost',
    power: 'Power',
    openMarket: 'View Market Price',
    searchSameName: 'Search Same Name',
    officialInfo: 'Official Info',
    loginRequired: 'Please log in first.',
    backToCatalog: '← Back to Cards',
    marketCodePlaceholder: 'Card code e.g. OP05-119',
    marketSearch: 'Search Price',
    marketLoading: 'Finding market candidates...',
    marketNoCandidates: 'No mapped market candidates found.',
    marketFallback: 'Exact market mapping was not found. Showing code search results.',
    marketDetailError: 'Failed to load market price details.',
    variantSelect: 'Grade / Version',
    sourceMarket: 'View SNKRDUNK',
    snkrShortcut: 'Open',
    addAGrade: 'Add A Grade',
    addPsa10: 'Add PSA10 Grade',
    aGrade: 'A Grade',
    addedToPortfolio: 'added to Portfolio.',
    noChart: 'No chart data.',
    recentSales: 'Recent Sales',
    noRecentSales: 'No recent sales data.',
    boxMarketTitle: 'Booster Box Prices',
    boxMarketHelp: 'Browse SNKRDUNK booster box prices by popular order.',
    boxSortLatest: 'Popular',
    boxSortHigh: 'High Price',
    boxSortLow: 'Low Price',
    checkPrice: 'Check Price',
    deckSearchPlaceholder: 'Search cards for deck',
    currentDeck: 'Current Deck',
    deckComingSoonTitle: 'Deck Builder Coming Soon',
    deckComingSoonBody: 'This section will reopen after the deck save and sharing flow is stabilized.',
    close: 'Close',
    allShops: 'All Shops',
    officialShop: 'Official Shops',
    searchShop: 'Search Shops',
    allRegions: 'All Regions',
    allDistricts: 'All Districts',
    shopSearchPlaceholder: 'Search shop name or address',
    progress: 'Collection Progress',
    updateNotice: 'Updates',
    updateTitle: 'OP-16 update completed',
    updateHelp: 'Click to view previous updates.',
    visitorsTotal: 'Total unique visitors',
    visitorsToday: 'Unique visitors today',
    usersTotal: 'Total users',
    signupsToday: 'New users today',
    footerIntro: 'OPTCG Korea is an unofficial card database, market price, and collection management service for ONE PIECE CARD GAME players.',
    footerRights: 'ONE PIECE CARD GAME images, names, and trademarks belong to their respective rights holders.',
    footerNoAffiliation: 'This site is not affiliated with BANDAI or official distributors.',
    footerPriceNotice: 'Market price information is provided for reference only and may differ from actual transaction prices.',
    footerResponsibility: 'Users are responsible for their own purchase and sale decisions.',
    terms: 'Terms',
    privacy: 'Privacy Policy',
    contact: 'Contact',
    partnership: 'Ads / Partnerships'
  }
};

function getUiText(lang, key) {
  return UI_TEXT[lang]?.[key] || UI_TEXT.KR[key] || key;
}
const PAGE_PATHS = {
  home: '/',
  cards: '/cards',
  prices: '/prices',
  deck: '/deck',
  shops: '/shops',
  statsPrototype: '/stats-prototype'
};
const PATH_PAGES = Object.fromEntries(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]));

function getPageFromPath(pathname = '/') {
  return PATH_PAGES[pathname] || 'home';
}

const TERMS_SECTIONS = [
  ['제1조 목적', '본 약관은 OPTCG Korea가 제공하는 카드 도감, 시세 확인, 컬렉션 관리 및 관련 서비스의 이용 조건과 절차를 정함을 목적으로 합니다.'],
  ['제2조 서비스의 성격', '본 사이트는 원피스 카드게임 유저를 위한 비공식 정보 제공 서비스입니다.\n본 사이트는 BANDAI, ONE PIECE CARD GAME 공식 유통사 및 관련 권리자와 제휴되어 있지 않습니다.'],
  ['제3조 제공 서비스', '본 사이트는 카드 정보, 카드 시세, 컬렉션 관리, 위시리스트, 덱 시뮬레이터, 공지사항 등의 기능을 제공할 수 있습니다.'],
  ['제4조 시세 정보의 이용', '본 사이트에서 제공하는 시세 정보는 외부 거래 플랫폼, 공개 정보 또는 자체 수집 데이터를 기반으로 한 참고용 정보입니다.\n실제 거래 가격과 차이가 있을 수 있으며, 카드 구매·판매·투자 판단의 책임은 이용자 본인에게 있습니다.'],
  ['제5조 회원 및 계정', '이용자는 카카오 로그인 등 소셜 로그인 기능을 통해 서비스를 이용할 수 있습니다.\n이용자는 본인의 계정 정보를 안전하게 관리해야 하며, 계정 사용으로 발생하는 책임은 이용자에게 있습니다.'],
  ['제6조 금지행위', '이용자는 다음 행위를 해서는 안 됩니다.\n- 사이트의 정상적인 운영을 방해하는 행위\n- 허위 정보 입력 또는 타인의 계정 도용\n- 무단 크롤링, 자동화 프로그램을 이용한 과도한 접근\n- 저작권, 상표권 등 제3자의 권리를 침해하는 행위\n- 기타 법령 또는 공서양속에 반하는 행위'],
  ['제7조 광고 및 제휴', '본 사이트에는 Google AdSense 등 제3자 광고 서비스 또는 제휴 링크가 포함될 수 있습니다.\n광고 및 제휴 링크를 통해 발생하는 외부 사이트 이용에 대해서는 해당 외부 사이트의 정책이 적용됩니다.'],
  ['제8조 저작권 및 지식재산권', '본 사이트의 디자인, 데이터 구성, 자체 제작 콘텐츠의 권리는 운영자에게 있습니다.\nONE PIECE CARD GAME 및 관련 이미지, 명칭, 상표의 권리는 각 권리자에게 있습니다.'],
  ['제9조 서비스 변경 및 중단', '운영자는 서비스 개선, 유지보수, 외부 데이터 제공처 변경 등의 사유로 서비스의 일부 또는 전부를 변경하거나 중단할 수 있습니다.'],
  ['제10조 책임의 제한', '운영자는 제공 정보의 정확성, 완전성, 최신성을 보장하지 않습니다.\n이용자가 본 사이트의 정보를 바탕으로 한 거래, 구매, 판매, 투자 판단으로 입은 손해에 대해 운영자는 책임을 지지 않습니다.'],
  ['제11조 문의', '서비스 이용과 관련한 문의는 아래 이메일로 접수할 수 있습니다.\n이메일: optkr26@gmail.com']
];

const PRIVACY_SECTIONS = [
  ['1. 수집하는 개인정보 항목', '본 사이트는 서비스 제공을 위해 다음 정보를 수집할 수 있습니다.\n- 소셜 로그인 정보: 카카오 계정 식별자, 닉네임, 프로필 이미지, 이메일\n- 서비스 이용 정보: 보유 카드, 위시리스트, 컬렉션 정보, 덱 시뮬레이터 저장 정보\n- 자동 수집 정보: 접속 IP, 브라우저 정보, 접속 기록, 쿠키, 기기 정보\n- 문의 시 수집 정보: 이메일 주소, 문의 내용'],
  ['2. 개인정보의 이용 목적', '수집한 개인정보는 다음 목적으로 이용됩니다.\n- 회원 식별 및 로그인 기능 제공\n- 컬렉션 관리, 위시리스트, 보유 카드 저장 기능 제공\n- 서비스 이용 기록 관리 및 부정 이용 방지\n- 문의 응대 및 공지사항 전달\n- 서비스 개선 및 통계 분석\n- 광고 표시 및 광고 성과 분석'],
  ['3. 개인정보의 보유 및 이용 기간', '개인정보는 서비스 제공 목적이 달성될 때까지 보관하며, 회원 탈퇴 또는 삭제 요청 시 지체 없이 삭제합니다.\n다만 관련 법령에 따라 보관이 필요한 정보는 해당 기간 동안 보관할 수 있습니다.'],
  ['4. 쿠키 및 광고 서비스 이용', '본 사이트는 서비스 이용 분석, 사용자 편의 제공 및 광고 표시를 위해 쿠키를 사용할 수 있습니다.\n또한 Google AdSense 등 제3자 광고 서비스를 이용할 수 있으며, 이 과정에서 광고 제공자가 쿠키를 사용하여 이용자의 관심사에 기반한 광고를 표시할 수 있습니다.\n이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.\n단, 쿠키를 차단할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.'],
  ['5. 개인정보의 제3자 제공', '본 사이트는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.\n다만 법령에 따른 요청이 있거나 이용자의 동의가 있는 경우에는 예외로 합니다.'],
  ['6. 개인정보 처리의 위탁', '본 사이트는 서비스 운영을 위해 다음 외부 서비스를 사용할 수 있습니다.\n- Supabase: 회원 정보 및 컬렉션 데이터 저장\n- Kakao Login: 소셜 로그인 제공\n- Google AdSense: 광고 제공\n- Google Analytics 또는 Vercel Analytics: 방문 통계 분석\n사용하는 서비스가 변경될 경우 본 방침을 통해 안내합니다.'],
  ['7. 이용자의 권리', '이용자는 언제든지 본인의 개인정보 조회, 수정, 삭제, 처리 정지를 요청할 수 있습니다.\n요청은 아래 이메일을 통해 접수할 수 있습니다.\n이메일: optkr26@gmail.com'],
  ['8. 개인정보 보호책임자', '개인정보 관련 문의는 아래 연락처로 문의할 수 있습니다.\n운영자: OPTCG Korea\n이메일: optkr26@gmail.com'],
  ['9. 개인정보처리방침 변경', '본 개인정보처리방침은 법령, 서비스 변경 사항에 따라 수정될 수 있으며, 변경 시 사이트 공지사항 또는 본 페이지를 통해 안내합니다.\n시행일: 2026년 5월 28일']
];

function RenewHeader({ activePage, onNavigate, isDark, onToggleTheme, isLoggedIn, displayName, onAuthClick, uiLang, onUiLangChange }) {
  const t = (key) => getUiText(uiLang, key);
  return (
    <header className="renew-header">
      <div className="renew-nav">
        <button type="button" className="renew-logo-button" onClick={() => onNavigate('home')} aria-label="메인으로 이동">
          <img src={LOGO_SRC} alt="ONE PIECE CARD GAME" className="renew-logo" />
        </button>

        <nav className="renew-tabs" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`renew-tab ${activePage === item.id ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="renew-actions">
          <button type="button" className="renew-pill is-filled renew-account-pill" onClick={onAuthClick}>
            {isLoggedIn ? (
              <>
                <span className="renew-account-name">{displayName}</span>
                <span className="renew-account-logout">{t('logout')}</span>
              </>
            ) : t('login')}
          </button>
          <a className="renew-pill" href={DONATION_URL} target="_blank" rel="noreferrer">
            {t('donate')}
          </a>
          <div className="renew-ui-lang" aria-label="UI language">
            {['KR', 'EN'].map((lang) => (
              <button key={lang} type="button" className={uiLang === lang ? 'is-active' : ''} onClick={() => onUiLangChange(lang)}>
                {lang}
              </button>
            ))}
          </div>
          <button type="button" className="renew-mode" onClick={onToggleTheme} aria-label="테마 전환">
            {isDark ? '☀' : '☾'}
          </button>
        </div>
      </div>
    </header>
  );
}

function RenewSearch({ onSubmitSearch, uiLang }) {
  const [locale, setLocale] = useState('KR');
  const [keyword, setKeyword] = useState('');
  const t = (key) => getUiText(uiLang, key);

  function submitSearch(event) {
    event.preventDefault();
    const q = keyword.trim();
    if (!q) return;
    onSubmitSearch?.({ locale, q });
  }

  return (
    <form className="renew-search" onSubmit={submitSearch}>
      <div className="renew-locale-switch" aria-label="검색 언어">
        <button type="button" className={locale === 'KR' ? 'is-active' : ''} onClick={() => setLocale('KR')}>{t('searchKr')}</button>
        <button type="button" className={locale === 'JP' ? 'is-active' : ''} onClick={() => setLocale('JP')}>{t('searchJp')}</button>
      </div>
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label="카드명 또는 품번 검색"
      />
      <button type="submit" className="renew-search-submit" aria-label="검색">↑</button>
    </form>
  );
}

function RenewOfficialLinks({ uiLang }) {
  return (
    <nav className="renew-official-links" aria-label="공식 링크">
      {OFFICIAL_LINK_ITEMS.map((item) => (
        <a
          key={item.labelKr}
          href={item.href}
          target={item.external ? '_blank' : undefined}
          rel={item.external ? 'noreferrer' : undefined}
        >
          {uiLang === 'EN' ? item.labelEn : item.labelKr}
        </a>
      ))}
    </nav>
  );
}

function RenewAuthModal({ onClose, onSignedIn }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    if (!supabase || !hasSupabaseAuthConfig) {
      setMessage('인증 환경변수가 아직 연결되지 않았습니다.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const lookup = await resolveLoginEmail(identifier.trim());
      const email = lookup?.email || identifier.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onSignedIn(data?.user || null);
      onClose();
    } catch (error) {
      setMessage(error?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithKakao() {
    if (!supabase || !hasSupabaseAuthConfig) {
      setMessage('인증 환경변수가 아직 연결되지 않았습니다.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: 'https://www.optcgkorea.com/' }
    });
    if (error) setMessage(error.message);
  }

  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-auth-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>로그인</h2>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <form className="renew-login-form" onSubmit={submitLogin}>
          <button type="button" className="renew-kakao" onClick={loginWithKakao} disabled={!hasSupabaseAuthConfig}>
            카카오톡으로 계속하기
          </button>
          <div className="renew-divider"><span>또는</span></div>
          <label>
            <span>아이디 또는 이메일</span>
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>비밀번호</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {message ? <p className="renew-form-message">{message}</p> : null}
          <button type="submit" className="renew-submit" disabled={loading || !identifier.trim() || !password.trim()}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RenewComingSoonModal({ uiLang, onClose }) {
  const t = (key) => getUiText(uiLang, key);
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{t('deckComingSoonTitle')}</h2>
            <p>{t('deckComingSoonBody')}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label={t('close')}>×</button>
        </div>
      </div>
    </div>
  );
}

function RenewHome({ authUser, userState, setUserState, stateLoading, adminStats, onSubmitSearch, uiLang }) {
  const [marketTotalJpy, setMarketTotalJpy] = useState(null);
  const [marketCards, setMarketCards] = useState([]);
  const [valueModalGrade, setValueModalGrade] = useState(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [renewalNoticeOpen, setRenewalNoticeOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressLocale, setProgressLocale] = useState('KR');
  const [progressData, setProgressData] = useState({ KR: { owned: 0, total: 0, percent: 0, series: [] }, JP: { owned: 0, total: 0, percent: 0, series: [] } });
  const ownedCount = Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds.length : 0;
  const valuationGradeMap = userState?.valuationCardGrades && typeof userState.valuationCardGrades === 'object'
    ? userState.valuationCardGrades
    : {};
  const valuationGrades = userState?.valuationCardGrades && typeof userState.valuationCardGrades === 'object'
    ? Object.values(userState.valuationCardGrades).map((grade) => String(grade || '').toLowerCase())
    : [];
  const valuationEntries = [
    ...(userState?.valuationMarketItems && typeof userState.valuationMarketItems === 'object' ? Object.entries(userState.valuationMarketItems) : []),
    ...(userState?.ownedMarketItems && typeof userState.ownedMarketItems === 'object' ? Object.entries(userState.ownedMarketItems) : [])
  ];
  const storedTotalJpy = valuationEntries.reduce((sum, [, item]) => sum + (Number(item?.minPrice || 0) || 0), 0);
  const totalJpy = marketTotalJpy ?? storedTotalJpy;
  const aCount = valuationGrades.filter((grade) => grade === 'a').length;
  const psa10Count = valuationGrades.filter((grade) => grade === 'psa10').length;

  useEffect(() => {
    let cancelled = false;
    const entries = valuationEntries
      .filter(([, item]) => item?.code && item?.apparelId)
      .slice(0, 40);
    if (!entries.length) {
      setMarketTotalJpy(null);
      setMarketCards([]);
      return () => {
        cancelled = true;
      };
    }

    Promise.all(entries.map(async ([key, item]) => {
      const grade = String(valuationGradeMap[key] || item.grade || 'a').toLowerCase();
      try {
        const summary = await fetchMarketPrice({ code: item.code, apparelId: item.apparelId, summary: true });
        const price = Number(summary?.latestByCondition?.[grade]?.price || item.minPrice || 0) || 0;
        return {
          key,
          grade,
          price,
          code: item.code,
          apparelId: item.apparelId,
          name: item.name || summary?.item?.name || item.code,
          setName: item.setName || summary?.item?.setName || '',
          sourceUrl: item.sourceUrl || summary?.item?.sourceUrl || '',
          previewImageUrl: item.previewImageUrl || item.imageUrl || summary?.item?.previewImageUrl || '/card-placeholder.svg'
        };
      } catch {
        const price = Number(item.minPrice || 0) || 0;
        return { key, grade, price, code: item.code, apparelId: item.apparelId, name: item.name || item.code, setName: item.setName || '', sourceUrl: item.sourceUrl || '', previewImageUrl: item.previewImageUrl || item.imageUrl || '/card-placeholder.svg' };
      }
    })).then((items) => {
      if (cancelled) return;
      setMarketCards(items);
      setMarketTotalJpy(items.reduce((sum, item) => sum + item.price, 0));
    });

    return () => {
      cancelled = true;
    };
  }, [userState]);

  useEffect(() => {
    const ownedSet = new Set(Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds : []);
    const entries = ['KR', 'JP'].map((locale) => {
      const countData = seriesCardCounts[locale] || { total: 0, series: {} };
      const ownedSeriesCounts = {};
      ownedSet.forEach((cardId) => {
        if (!String(cardId).startsWith(`${locale}::`)) return;
        const seriesId = getSeriesIdFromCardId(cardId);
        if (!seriesId) return;
        ownedSeriesCounts[seriesId] = (ownedSeriesCounts[seriesId] || 0) + 1;
      });
      const seriesRows = sortDescByCode(seriesData.filter((series) => (series.locale ?? 'KR') === locale)).map((series) => {
        const total = Number(countData.series?.[series.id] || 0);
        const owned = Math.min(Number(ownedSeriesCounts[series.id] || 0), total);
        return {
          id: series.id,
          code: getBaseSeriesId(series),
          name: series.koName || series.enName || getBaseSeriesId(series),
          kind: series.kindKo || series.kindEn || '',
          owned,
          total,
          percent: total ? (owned / total) * 100 : 0
        };
      }).filter((series) => series.total > 0);
      const total = Number(countData.total || 0);
      const owned = [...ownedSet].filter((cardId) => String(cardId).startsWith(`${locale}::`)).length;
      return [locale, { owned, total, percent: total ? (owned / total) * 100 : 0, series: seriesRows }];
    });
    setProgressData(Object.fromEntries(entries));
  }, [userState]);

  const modalCards = valueModalGrade
    ? marketCards.filter((item) => item.grade === valueModalGrade)
    : [];
  const t = (key) => getUiText(uiLang, key);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(RENEWAL_NOTICE_KEY)) return;
    window.localStorage.setItem(RENEWAL_NOTICE_KEY, '1');
    setRenewalNoticeOpen(true);
  }, []);

  async function removeValuationCard(key) {
    if (!authUser) {
      window.alert('로그인 후 이용해 주세요.');
      return;
    }
    const nextValuationMarketItems = { ...(userState?.valuationMarketItems || {}) };
    const nextValuationCardGrades = { ...(userState?.valuationCardGrades || {}) };
    const nextOwnedMarketItems = { ...(userState?.ownedMarketItems || {}) };
    delete nextValuationMarketItems[key];
    delete nextValuationCardGrades[key];
    delete nextOwnedMarketItems[key];
    const nextState = {
      ...(userState || {}),
      valuationMarketItems: nextValuationMarketItems,
      valuationCardGrades: nextValuationCardGrades,
      ownedMarketItems: nextOwnedMarketItems
    };
    setMarketCards((items) => items.filter((item) => item.key !== key));
    setMarketTotalJpy((value) => {
      if (value == null) return value;
      const removed = marketCards.find((item) => item.key === key);
      return Math.max(0, value - Number(removed?.price || 0));
    });
    setUserState(nextState);
    await saveMyState({ ...nextState, __changedFields: ['valuationMarketItems', 'valuationCardGrades', 'ownedMarketItems'] });
  }

  return (
    <main className="renew-home">
      <section className="renew-hero" aria-label="메인 검색">
        <RenewSearch onSubmitSearch={onSubmitSearch} uiLang={uiLang} />
        <RenewOfficialLinks uiLang={uiLang} />
      </section>

      <section className="renew-dashboard" aria-label="메인 현황">
        <button type="button" className="renew-float-card renew-progress" onClick={() => setProgressOpen(true)}>
          <div className="renew-card-title">{t('progress')}</div>
          {[
            ['KR', '한글판'],
            ['JP', '일본판']
          ].map(([locale, label]) => (
            <div key={locale} className="renew-progress-category-row">
              <div>
                <strong>{label}</strong>
                <span>{progressData[locale].owned} / {progressData[locale].total}</span>
              </div>
              <div className="renew-progress-track"><i style={{ width: `${progressData[locale].percent}%` }} /></div>
              <b>{stateLoading ? '...' : formatPercent(progressData[locale].percent)}</b>
              <em>+</em>
            </div>
          ))}
        </button>

        <article className="renew-float-card renew-value">
          <div className="renew-card-title">Portfolio</div>
          <div className="renew-value-total">
            <span>{formatYen(totalJpy)}</span>
            <i>/</i>
            <span>{formatWonFromYen(totalJpy)}</span>
          </div>
          <div className="renew-value-grid">
            <button type="button" onClick={() => setValueModalGrade('a')}>
              <span>A</span>
              <strong>{aCount}</strong>
            </button>
            <button type="button" onClick={() => setValueModalGrade('psa10')}>
              <span>PSA10</span>
              <strong>{psa10Count}</strong>
            </button>
          </div>
        </article>

        <button type="button" className="renew-float-card renew-update" onClick={() => setUpdatesOpen(true)}>
          <div className="renew-card-title">{t('updateNotice')}</div>
          <div className="renew-update-date">{RENEW_HOME_UPDATES[0].title.match(/\[[^\]]+\]/)?.[0] ?? ''}</div>
          <h2>{RENEW_HOME_UPDATES[0].summary}</h2>
          <p>{t('updateHelp')}</p>
        </button>
      </section>
      {adminStats ? (
        <section className="renew-admin-stats" aria-label="관리자 통계">
          {[
            [t('visitorsTotal'), adminStats.totalVisits],
            [t('visitorsToday'), adminStats.todayVisits],
            [t('usersTotal'), adminStats.totalUsers],
            [t('signupsToday'), adminStats.todaySignups]
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{Number(value || 0).toLocaleString('ko-KR')}</strong>
            </article>
          ))}
        </section>
      ) : null}
      {valueModalGrade ? (
        <RenewValueModal
          grade={valueModalGrade}
          cards={modalCards}
          onClose={() => setValueModalGrade(null)}
          onRemove={removeValuationCard}
        />
      ) : null}
      {updatesOpen ? <RenewUpdateModal onClose={() => setUpdatesOpen(false)} /> : null}
      {renewalNoticeOpen ? <RenewalNoticeModal onClose={() => setRenewalNoticeOpen(false)} /> : null}
      {progressOpen ? (
        <RenewProgressModal
          progressData={progressData}
          locale={progressLocale}
          onLocaleChange={setProgressLocale}
          onClose={() => setProgressOpen(false)}
        />
      ) : null}
    </main>
  );
}

function RenewalNoticeModal({ onClose }) {
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-announcement-modal" onClick={(event) => event.stopPropagation()}>
        <span>RENEWAL</span>
        <h2>OPTCG Korea가 새롭게 리뉴얼되었습니다.</h2>
        <p>
          메인 화면, 카드 도감, 시세 확인 화면을 더 빠르게 확인할 수 있도록 정리했습니다.
          기존 계정의 보유 카드, 위시리스트, Portfolio 정보는 그대로 유지됩니다.
        </p>
        <button type="button" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

function RenewProgressModal({ progressData, locale, onLocaleChange, onClose }) {
  const current = progressData[locale] || { owned: 0, total: 0, percent: 0, series: [] };
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-progress-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>수집 진행도</h2>
            <p>{current.owned} / {current.total} · {formatPercent(current.percent)}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="renew-progress-detail">
          <div className="renew-progress-locale">
            <button type="button" className={locale === 'KR' ? 'is-active' : ''} onClick={() => onLocaleChange('KR')}>한글판</button>
            <button type="button" className={locale === 'JP' ? 'is-active' : ''} onClick={() => onLocaleChange('JP')}>일본판</button>
          </div>
          <div className="renew-progress-series-list">
            {current.series.map((series) => (
              <article key={series.id}>
                <div>
                  <strong>{series.code}</strong>
                  <span>{series.name}</span>
                </div>
                <small>{series.owned} / {series.total}</small>
                <div className="renew-progress-track"><i style={{ width: `${series.percent}%` }} /></div>
                <b>{formatPercent(series.percent)}</b>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewValueModal({ grade, cards, onClose, onRemove }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => (window.innerWidth <= 560 ? 8 : 12));
  const [imageCache, setImageCache] = useState(loadPortfolioImageCache);
  const total = cards.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  const visibleCards = cards.slice(page * pageSize, page * pageSize + pageSize);
  const getImageCacheKey = (item) => `${item.code || ''}::${item.apparelId || ''}`;
  const getValueImageSrc = (item) => {
    const cachedSource = imageCache[getImageCacheKey(item)];
    if (cachedSource) return getCardImageSrc({ imageUrl: cachedSource });
    if (!isPlaceholderImageUrl(item.previewImageUrl)) return item.previewImageUrl;
    if (!isPlaceholderImageUrl(item.imageUrl)) return item.imageUrl;
    return '/card-placeholder.svg';
  };

  async function resolveValueImage(item, allowSearchFallback = true) {
    try {
      const approvedLink = await findApprovedCardMarketLinkByApparelId(item.apparelId);
      if (approvedLink?.cardId) {
        const linkedCard = await fetchCardById(approvedLink.cardId);
        const linkedSource = linkedCard?.imageUrl || linkedCard?.image_url || linkedCard?.image;
        if (linkedSource) {
          const nextCache = { ...loadPortfolioImageCache(), [getImageCacheKey(item)]: linkedSource };
          setImageCache(nextCache);
          savePortfolioImageCache(nextCache);
          return getCardImageSrc({ imageUrl: linkedSource });
        }
      }
      if (!allowSearchFallback) return '';
      const matches = await searchCards(item.code, 'JP');
      const fallbackCard = matches.find((card) => (
        (card.cardNo === item.code || card.baseCardNo === item.code) &&
        (card.imageUrl || card.image_url || card.image)
      )) || matches.find((card) => card.imageUrl || card.image_url || card.image);
      const fallbackSource = fallbackCard?.imageUrl || fallbackCard?.image_url || fallbackCard?.image;
      if (!fallbackSource) return '';
      const nextCache = { ...loadPortfolioImageCache(), [getImageCacheKey(item)]: fallbackSource };
      setImageCache(nextCache);
      savePortfolioImageCache(nextCache);
      return getCardImageSrc({ imageUrl: fallbackSource });
    } catch {
      return '';
    }
  }

  async function handleValueImageError(item, event) {
    const target = event.currentTarget;
    if (target.dataset.fallbackAttempted === '1') {
        placeholderImage(event);
        return;
      }
    target.dataset.fallbackAttempted = '1';
    const fallbackSrc = await resolveValueImage(item);
    if (fallbackSrc) {
      target.src = fallbackSrc;
    } else {
      placeholderImage(event);
    }
  }

  useEffect(() => {
    const updatePageSize = () => setPageSize(window.innerWidth <= 560 ? 8 : 12);
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [grade, pageSize]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{grade === 'psa10' ? 'PSA10 Collection' : 'A Collection'}</h2>
            <p>{cards.length}장 · {formatYen(total)} / {formatWonFromYen(total)}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="renew-value-card-grid">
          {cards.length ? visibleCards.map((item) => (
            <article key={item.key} className="renew-value-card">
              <button type="button" className="renew-value-remove" onClick={() => onRemove?.(item.key)} aria-label="컬렉션 가치에서 제거">×</button>
              <PortfolioValueImage
                item={item}
                src={getValueImageSrc(item)}
                resolveImage={resolveValueImage}
                onError={handleValueImageError}
              />
              <strong>{item.code}</strong>
              <span>{item.name}</span>
              <b>{formatYen(item.price)}</b>
            </article>
          )) : <p className="renew-empty-note">표시할 카드가 없습니다.</p>}
        </div>
        {cards.length > pageSize ? (
          <div className="renew-update-pager renew-value-pager">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>이전</button>
            <span>{page + 1} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>다음</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PortfolioValueImage({ item, src, resolveImage, onError }) {
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    setImageSrc(src);
    if (!isPlaceholderImageUrl(src)) {
      resolveImage(item, false).then((fallbackSrc) => {
        if (!cancelled && fallbackSrc) setImageSrc(fallbackSrc);
      });
    } else {
      resolveImage(item, true).then((fallbackSrc) => {
        if (!cancelled && fallbackSrc) setImageSrc(fallbackSrc);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [item, src, resolveImage]);

  return (
    <img
      src={imageSrc || '/card-placeholder.svg'}
      alt={item.name}
      onError={(event) => onError(item, event)}
    />
  );
}

function CoupangPartnerBanners() {
  return (
    <section className="renew-partner-banners" aria-label="카드 보관용품 추천">
      <div className="renew-partner-head">
        <strong>카드 보관용품</strong>
      </div>
      <div className="renew-partner-grid">
        {COUPANG_PARTNER_ITEMS.map((item) => (
          <a key={item.title} href={item.href} target="_blank" rel="nofollow sponsored noreferrer">
            <b>{item.title}</b>
            <span>{item.description}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function RenewUpdateModal({ onClose }) {
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const pageCount = Math.ceil(RENEW_HOME_UPDATES.length / pageSize);
  const items = RENEW_HOME_UPDATES.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-update-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>업데이트 공지</h2>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="renew-update-list">
          {items.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <h3>{item.summary}</h3>
              <ul>
                {item.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            </article>
          ))}
          <div className="renew-update-pager">
            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>이전</button>
            <span>{page + 1} / {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1}>다음</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewLegalModal({ type, onClose }) {
  const isPrivacy = type === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-legal-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{isPrivacy ? '개인정보처리방침' : '이용약관'}</h2>
            {isPrivacy ? <p>OPTCG Korea는 이용자의 개인정보를 중요하게 생각하며, 관련 법령에 따라 개인정보를 안전하게 관리합니다.</p> : null}
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="renew-legal-body">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function RenewCatalog({ authUser, userState, setUserState, initialSearch, initialViewState, onViewStateChange, onOpenMarket, uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const hasInitialSearch = Boolean(initialSearch?.q);
  const initialLocale = hasInitialSearch ? (initialSearch?.locale || 'KR') : (initialViewState?.locale || 'KR');
  const [locale, setLocale] = useState(initialLocale);
  const [selectedSeries, setSelectedSeries] = useState(() => hasInitialSearch ? getDefaultRenewSeriesId(initialLocale) : (initialViewState?.selectedSeries || getDefaultRenewSeriesId(initialLocale)));
  const [openSection, setOpenSection] = useState('regular');
  const [searchKeyword, setSearchKeyword] = useState(hasInitialSearch ? initialSearch.q : (initialViewState?.searchKeyword || ''));
  const [activeRarity, setActiveRarity] = useState(hasInitialSearch ? 'ALL' : (initialViewState?.activeRarity || 'ALL'));
  const [collectionFilter, setCollectionFilter] = useState(hasInitialSearch ? 'all' : (initialViewState?.collectionFilter || 'all'));
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [expandedDeferredRarities, setExpandedDeferredRarities] = useState(() => new Set());

  const localeSeries = useMemo(() => seriesData.filter((series) => (series.locale ?? 'KR') === locale), [locale]);
  const sections = useMemo(() => buildRenewSeriesSections(localeSeries), [localeSeries]);
  const currentSeries = useMemo(() => localeSeries.find((series) => series.id === selectedSeries) || localeSeries[0], [localeSeries, selectedSeries]);
  const ownedSet = useMemo(() => new Set(Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds : []), [userState]);
  const wishSet = useMemo(() => new Set(Array.isArray(userState?.wishlistCardIds) ? userState.wishlistCardIds : []), [userState]);

  useEffect(() => {
    const nextSeries = getDefaultRenewSeriesId(locale);
    setSelectedSeries(nextSeries);
    setOpenSection('regular');
    setActiveRarity('ALL');
  }, [locale]);

  useEffect(() => {
    const q = initialSearch?.q?.trim();
    if (!q) return;
    const nextLocale = initialSearch.locale || 'KR';
    setLocale(nextLocale);
    setSearchKeyword(q);
    setSelectedSeries(getDefaultRenewSeriesId(nextLocale));
    setActiveRarity('ALL');
    setCollectionFilter('all');
  }, [initialSearch?.id, initialSearch?.locale, initialSearch?.q]);

  useEffect(() => {
    setExpandedDeferredRarities(new Set());
  }, [locale, selectedSeries, searchKeyword, activeRarity, collectionFilter]);

  useEffect(() => {
    onViewStateChange?.({
      locale,
      selectedSeries,
      searchKeyword,
      activeRarity,
      collectionFilter
    });
  }, [locale, selectedSeries, searchKeyword, activeRarity, collectionFilter, onViewStateChange]);

  useEffect(() => {
    let cancelled = false;
    async function loadCards() {
      setLoading(true);
      try {
        const keyword = searchKeyword.trim();
        const collectionIds = collectionFilter === 'owned'
          ? (Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds : [])
          : collectionFilter === 'wish'
            ? (Array.isArray(userState?.wishlistCardIds) ? userState.wishlistCardIds : [])
            : [];
        const result = keyword
          ? await searchCards(keyword, locale)
          : collectionFilter === 'all'
            ? await fetchCards({ locale, series: selectedSeries })
            : collectionIds.length
              ? await fetchCards({ locale })
              : [];
        if (!cancelled) setCards(Array.isArray(result) ? result : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCards();
    return () => {
      cancelled = true;
    };
  }, [locale, selectedSeries, searchKeyword, collectionFilter, userState]);

  const visibleCards = useMemo(() => {
    return cards.filter((card) => {
      const rarityOk = activeRarity === 'ALL' || card.rarity === activeRarity;
      const collectionOk = collectionFilter === 'owned'
        ? ownedSet.has(card.id)
        : collectionFilter === 'wish'
          ? wishSet.has(card.id)
          : true;
      return rarityOk && collectionOk;
    });
  }, [cards, activeRarity, collectionFilter, ownedSet, wishSet]);

  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cards)], [cards]);
  const groupedCards = useMemo(() => groupByRarity(visibleCards), [visibleCards]);

  async function persistState(nextState, changedFields = []) {
    setUserState(nextState);
    if (!authUser) return;
    await saveMyState({ ...nextState, __changedFields: changedFields });
  }

  async function toggleListValue(field, cardId) {
    if (!authUser) {
      window.alert(t('loginRequired'));
      return;
    }
    const current = Array.isArray(userState?.[field]) ? userState[field] : [];
    const nextList = current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId];
    await persistState({ ...(userState || {}), [field]: nextList }, [field]);
  }

  async function openCard(cardId) {
    const detail = await fetchCardById(cardId).catch(() => null);
    setSelectedCard(detail || cards.find((card) => card.id === cardId) || null);
  }

  return (
    <main className="renew-catalog">
      <aside className="renew-catalog-side">
        <div className="renew-catalog-headline">
          <span>{t('category')}</span>
          <div className="renew-catalog-locale">
            <button type="button" className={locale === 'KR' ? 'is-active' : ''} onClick={() => setLocale('KR')}>{t('searchKr')}</button>
            <button type="button" className={locale === 'JP' ? 'is-active' : ''} onClick={() => setLocale('JP')}>{t('searchJp')}</button>
          </div>
        </div>
        <button type="button" className="renew-category-row" onClick={() => { setSearchKeyword(''); setCollectionFilter('all'); }}>
          {t('all')} <strong>+</strong>
        </button>
        {sections.filter((section) => section.id !== 'all').map((section) => (
          <div key={section.id} className="renew-category-block">
            <button type="button" className={`renew-category-row ${openSection === section.id ? 'is-open' : ''}`} onClick={() => setOpenSection(openSection === section.id ? '' : section.id)}>
              {section.label} <strong>{openSection === section.id ? '-' : '+'}</strong>
            </button>
            {openSection === section.id ? (
              <div className="renew-series-list">
                {section.children.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    className={`renew-series-item ${selectedSeries === series.id && !searchKeyword.trim() ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedSeries(series.id);
                      setSearchKeyword('');
                      setActiveRarity('ALL');
                    }}
                  >
                    <b>{getBaseSeriesId(series)}</b>
                    <span>{series.koName}</span>
                    <small>{series.kindEn || series.enName}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </aside>

      <section className="renew-catalog-main">
        <div className="renew-catalog-toolbar">
          <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder={t('searchPlaceholder')} />
          <button type="button" onClick={() => setSearchKeyword(searchKeyword.trim())}>{t('search')}</button>
        </div>

        <div className="renew-filter-line">
          <div className="renew-chip-group">
            <button type="button" className={collectionFilter === 'all' ? 'is-active' : ''} onClick={() => setCollectionFilter('all')}>{t('all')}</button>
            <button type="button" className={collectionFilter === 'owned' ? 'is-active' : ''} onClick={() => setCollectionFilter('owned')}>{t('owned')}</button>
            <button type="button" className={collectionFilter === 'wish' ? 'is-active' : ''} onClick={() => setCollectionFilter('wish')}>{t('wishlist')}</button>
          </div>
          <div className="renew-chip-group">
            {rarityOptions.map((rarity) => (
              <button key={rarity} type="button" className={activeRarity === rarity ? 'is-active' : ''} onClick={() => setActiveRarity(rarity)}>{rarity}</button>
            ))}
          </div>
        </div>

        <div className="renew-catalog-title">
          <div>
            <h1>{searchKeyword.trim() ? t('searchResults') : currentSeries?.koName}</h1>
            <p>{locale}-{searchKeyword.trim() ? 'SEARCH' : getBaseSeriesId(currentSeries)} {visibleCards.length}{t('cardsUnit')}</p>
          </div>
        </div>

        {loading ? <div className="renew-empty">{t('loading')}</div> : null}
        {!loading && !visibleCards.length ? <div className="renew-empty">{t('noResults')}</div> : null}
        {!loading ? groupedCards.map((group) => (
          <section key={group.rarity} className="renew-grade-section">
            <header>
              <h2>{group.rarity}</h2>
              <span>{group.cards.length}{t('cardsUnit')}</span>
            </header>
            {DEFERRED_RARITIES.has(group.rarity) && activeRarity === 'ALL' && collectionFilter === 'all' && !expandedDeferredRarities.has(group.rarity) ? (
              <button
                type="button"
                className="renew-deferred-rarity-button"
                onClick={() => setExpandedDeferredRarities((current) => new Set([...current, group.rarity]))}
              >
                {group.rarity} {group.cards.length}{t('cardsUnit')} 더보기 +
              </button>
            ) : (
            <div className="renew-card-grid">
              {group.cards.map((card, index) => {
                const owned = ownedSet.has(card.id);
                const wished = wishSet.has(card.id);
                return (
                  <article key={card.id} className={`renew-card-tile ${owned ? 'is-owned' : ''} ${wished ? 'is-wished' : ''}`} onClick={() => openCard(card.id)}>
                    <div className="renew-card-image">
                      <img
                        src={getCardImageSrc(card)}
                        alt={card.name}
                        onError={placeholderImage}
                        loading={index < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={index < 6 ? 'high' : 'auto'}
                      />
                      {owned ? <span className="renew-owned-badge">{t('owned')}</span> : null}
                    </div>
                    <div className="renew-card-body">
                      <b>{card.cardNo}</b>
                      <strong>{card.name}</strong>
                      <small>{card.seriesName}</small>
                      <div className="renew-card-actions" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className={owned ? 'is-owned' : ''} onClick={() => toggleListValue('ownedCardIds', card.id)}>{owned ? 'O' : 'X'}</button>
                        <button type="button" className={wished ? 'is-wished' : ''} onClick={() => toggleListValue('wishlistCardIds', card.id)}>♥</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            )}
          </section>
        )) : null}
      </section>

      {selectedCard ? (
        <RenewCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onOpenMarket={async (card) => {
            const marketLink = await findApprovedCardMarketLink(card);
            setSelectedCard(null);
            onOpenMarket?.({
              code: card?.marketCode || card?.cardNo || '',
              apparelId: marketLink?.apparelId || null
            });
          }}
          onSearchSameName={(name) => {
            setSearchKeyword(name || '');
            setSelectedCard(null);
          }}
          uiLang={uiLang}
        />
      ) : null}
    </main>
  );
}

function RenewCardModal({ card, onClose, onOpenMarket, onSearchSameName, uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-card-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="renew-modal-close renew-card-modal-close" onClick={onClose}>×</button>
        <div className="renew-card-modal-image">
          <img src={getCardImageSrc(card)} alt={card.name} onError={placeholderImage} />
        </div>
        <div className="renew-card-modal-info">
          <div className="renew-modal-code">{card.cardNo} · {card.rarity}</div>
          <h2>{card.name}</h2>
          <p>{card.seriesName}</p>
          <details>
            <summary>{t('cardInfo')}</summary>
            <div>{card.categoryKo} · {card.colorKo} · {t('cost')} {card.cost} · {t('power')} {card.power}</div>
          </details>
          <details>
            <summary>{t('effect')}</summary>
            <div>{card.effect || t('effectPending')}</div>
          </details>
          <div className="renew-modal-actions">
            <button type="button" onClick={() => onOpenMarket?.(card)}>{t('openMarket')}</button>
            <button type="button" onClick={() => onSearchSameName?.(card.name)}>{t('searchSameName')}</button>
            {card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer">{t('officialInfo')}</a> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <main className="renew-page">
      <section className="renew-placeholder">
        <h1>{title}</h1>
        <p>이 영역은 다음 단계에서 기존 기능을 그대로 연결하고 UI만 정리합니다.</p>
      </section>
    </main>
  );
}

function RenewMarketChart({ points = [], uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [hoverIndex, setHoverIndex] = useState(null);
  if (!points.length) {
    return <div className="renew-chart-placeholder"><span>{t('noChart')}</span></div>;
  }
  const width = 920;
  const height = 340;
  const padX = 54;
  const padTop = 26;
  const padBottom = 42;
  const prices = points.map((point) => Number(point.price || 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 1);
  const plotted = points.map((point, index) => {
    const x = padX + ((width - padX * 2) * index / Math.max(points.length - 1, 1));
    const y = padTop + ((max - Number(point.price || 0)) / range) * (height - padTop - padBottom);
    return { ...point, x, y };
  });
  const path = plotted.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${plotted[plotted.length - 1].x} ${height - padBottom} L ${plotted[0].x} ${height - padBottom} Z`;
  const active = plotted[hoverIndex ?? plotted.length - 1];
  const tipX = active ? Math.min(active.x + 12, width - 150) : 0;
  const tipY = active ? Math.max(active.y - 58, 8) : 0;

  return (
    <div className="renew-market-chart-box">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="시세 그래프">
        {[0, 1, 2, 3].map((step) => {
          const y = padTop + ((height - padTop - padBottom) * step / 3);
          const value = max - (range * step / 3);
          return (
            <g key={step}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} />
              <text x={padX - 12} y={y + 4}>{formatYen(value)}</text>
            </g>
          );
        })}
        <path d={area} className="renew-chart-area" />
        <path d={path} className="renew-chart-line" />
        {plotted.map((point, index) => (
          <circle key={`${point.timestamp}-${index}`} cx={point.x} cy={point.y} r={index === hoverIndex || (hoverIndex == null && index === plotted.length - 1) ? 5 : 3} />
        ))}
        {plotted.map((point, index) => (
          <circle
            key={`hit-${point.timestamp}-${index}`}
            className="renew-chart-hit"
            cx={point.x}
            cy={point.y}
            r="14"
            tabIndex="0"
            onMouseEnter={() => setHoverIndex(index)}
            onFocus={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            onBlur={() => setHoverIndex(null)}
          />
        ))}
        {active ? (
          <g>
            <line className="renew-chart-cursor" x1={active.x} y1={padTop} x2={active.x} y2={height - padBottom} />
            <rect x={tipX} y={tipY} width="134" height="48" rx="10" />
            <text className="renew-chart-tip-date" x={tipX + 14} y={tipY + 24}>{formatMarketDate(active.timestamp)}</text>
            <text className="renew-chart-tip-price" x={tipX + 14} y={tipY + 44}>{formatYen(active.price)}</text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function RenewBoxMarket({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [sortMode, setSortMode] = useState('latest');
  const [boxes, setBoxes] = useState(boxMarketItems);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/box-market', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.items)) setBoxes(payload.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const sortedBoxes = useMemo(() => {
    const withIndex = boxes.map((item, index) => ({ ...item, index }));
    if (sortMode === 'high') {
      return withIndex.sort((a, b) => (Number(b.minPrice) || -1) - (Number(a.minPrice) || -1));
    }
    if (sortMode === 'low') {
      return withIndex.sort((a, b) => {
        const priceA = Number(a.minPrice) || Number.POSITIVE_INFINITY;
        const priceB = Number(b.minPrice) || Number.POSITIVE_INFINITY;
        return priceA - priceB;
      });
    }
    return withIndex.sort((a, b) => {
      const countDiff = (Number(b.listingCount) || 0) - (Number(a.listingCount) || 0);
      return countDiff || a.index - b.index;
    });
  }, [boxes, sortMode]);

  return (
    <section className="renew-box-market">
      <div className="renew-box-market-head">
        <div>
          <h2>{t('boxMarketTitle')}</h2>
          <p>{t('boxMarketHelp')}</p>
        </div>
        <div className="renew-chip-group">
          <button type="button" className={sortMode === 'latest' ? 'is-active' : ''} onClick={() => setSortMode('latest')}>{t('boxSortLatest')}</button>
          <button type="button" className={sortMode === 'high' ? 'is-active' : ''} onClick={() => setSortMode('high')}>{t('boxSortHigh')}</button>
          <button type="button" className={sortMode === 'low' ? 'is-active' : ''} onClick={() => setSortMode('low')}>{t('boxSortLow')}</button>
        </div>
      </div>
      <div className="renew-box-market-grid">
        {sortedBoxes.map((box) => (
          <a key={box.apparelId} className="renew-box-market-card" href={box.sourceUrl} target="_blank" rel="noreferrer">
            <div className="renew-box-thumb">
              {box.previewImageUrl ? <img src={box.previewImageUrl} alt={box.name} onError={placeholderImage} /> : <span>{box.code}</span>}
            </div>
            <div>
              <strong>{box.name}</strong>
              <small>SNKRDUNK #{box.apparelId}</small>
              <b>{box.minPrice ? (box.minPriceFormat || formatYen(box.minPrice)) : t('checkPrice')}</b>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function RenewMarket({ authUser, userState, setUserState, initialCode, initialApparelId, onBackToCatalog, uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [code, setCode] = useState(initialCode || '');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [marketDetail, setMarketDetail] = useState(null);
  const [condition, setCondition] = useState('a');
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      searchMarket(initialCode, initialApparelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, initialApparelId]);

  async function loadMarketCards() {
    const mod = await import('./data/market-cards.js');
    return Array.isArray(mod.default) ? mod.default : [];
  }

  async function searchMarket(nextCode = code, targetApparelId = null) {
    const normalized = normalizeCode(nextCode);
    if (!normalized) return;
    setLoading(true);
    setMessage('');
    setCandidates([]);
    setSelected(null);
    setMarketDetail(null);
    try {
      const items = await loadMarketCards();
      const result = items
        .filter((item) => normalizeCode(item.code) === normalized)
        .filter((item) => item.locale === 'JP')
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));
      const directItem = targetApparelId
        ? result.find((item) => String(item.apparelId) === String(targetApparelId))
        : null;
      setCandidates(directItem ? [] : result);
      setSelected(directItem || (result.length === 1 ? result[0] : null));
      setMarketDetail(null);
      if (!result.length) setMessage(t('marketNoCandidates'));
      if (targetApparelId && result.length && !directItem) setMessage(t('marketFallback'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setMarketDetail(null);
      return undefined;
    }
    setLoading(true);
    setMessage('');
    fetchMarketPrice({ code: selected.code, apparelId: selected.apparelId })
      .then((detail) => {
        if (cancelled) return;
        setMarketDetail(detail || null);
        setCondition(detail?.defaultCondition || detail?.conditions?.[0]?.key || 'a');
        setRange(detail?.ranges?.[0]?.key || '7d');
      })
      .catch((error) => {
        if (!cancelled) setMessage(error?.message || t('marketDetailError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function addValuation(grade) {
    if (!authUser || !selected) {
      window.alert(t('loginRequired'));
      return;
    }
    const key = makeMarketStateKey(selected, grade);
    const approvedLink = await findApprovedCardMarketLinkByApparelId(selected.apparelId);
    const linkedCard = approvedLink?.cardId ? await fetchCardById(approvedLink.cardId) : null;
    const linkedImageUrl = linkedCard?.imageUrl || linkedCard?.image_url || linkedCard?.image || selected.previewImageUrl;
    const nextState = {
      ...(userState || {}),
      valuationMarketItems: {
        ...(userState?.valuationMarketItems || {}),
        [key]: {
          code: selected.code,
          apparelId: selected.apparelId,
          cardId: approvedLink?.cardId || '',
          name: selected.name,
          imageUrl: linkedImageUrl,
          previewImageUrl: linkedImageUrl,
          sourceUrl: selected.sourceUrl,
          minPrice: Number(marketDetail?.latestByCondition?.[grade]?.price || selected.minPrice || 0)
        }
      },
      valuationCardGrades: {
        ...(userState?.valuationCardGrades || {}),
        [key]: grade
      }
    };
    setUserState(nextState);
    await saveMyState({ ...nextState, __changedFields: ['valuationMarketItems', 'valuationCardGrades'] });
    window.alert(`${grade.toUpperCase()} ${t('addedToPortfolio')}`);
  }

  const selectedLatest = marketDetail?.latestByCondition?.[condition];
  const chartPoints = marketDetail?.series?.[condition]?.[range] || [];
  const recentSales = marketDetail?.recentSalesByCondition?.[condition] || [];
  const currentPrice = selectedLatest?.price ? formatYen(selectedLatest.price) : selected?.minPriceFormat || '가격 정보 없음';

  return (
    <main className="renew-subpage">
      <section className="renew-panel renew-market">
        {onBackToCatalog ? (
          <button type="button" className="renew-back-button" onClick={onBackToCatalog}>
            {t('backToCatalog')}
          </button>
        ) : null}
        <form className="renew-market-search" onSubmit={(event) => { event.preventDefault(); searchMarket(code); }}>
          <a className="renew-market-snkr-link" href={SNKRDUNK_MARKET_URL} target="_blank" rel="noreferrer" aria-label="SNKRDUNK 바로가기">
            <span>SNKR</span>
            <span>{t('snkrShortcut')}</span>
          </a>
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('marketCodePlaceholder')} />
          <button type="submit">{t('marketSearch')}</button>
        </form>

        {loading ? <div className="renew-empty">{t('marketLoading')}</div> : null}
        {message ? <div className="renew-empty">{message}</div> : null}

        {!code.trim() && !selected && !candidates.length ? <RenewBoxMarket uiLang={uiLang} /> : null}

        {candidates.length > 1 ? (
          <div className="renew-market-candidates">
            <b>{t('variantSelect')}</b>
            <div>
              {candidates.map((item) => (
                <button key={`${item.apparelId}-${item.locale}`} type="button" className={selected?.apparelId === item.apparelId ? 'is-active' : ''} onClick={() => setSelected(item)}>
                  <img src={item.previewImageUrl || '/card-placeholder.svg'} alt={item.name} onError={placeholderImage} />
                  <span>{item.name}</span>
                  <small>{item.locale} · {item.minPriceFormat}</small>
                  <small>{item.code} · #{item.apparelId}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="renew-market-detail">
            <div className="renew-market-card">
              <img src={selected.previewImageUrl || '/card-placeholder.svg'} alt={selected.name} onError={placeholderImage} />
              <div>
                <b>{selected.code}</b>
                <h2>{selected.name}</h2>
                <p>{selected.setName}</p>
                <div className="renew-market-actions">
                  <a href={selected.sourceUrl} target="_blank" rel="noreferrer">{t('sourceMarket')}</a>
                  <button type="button" onClick={() => addValuation('a')}>{t('addAGrade')}</button>
                  <button type="button" onClick={() => addValuation('psa10')}>{t('addPsa10')}</button>
                </div>
              </div>
              <strong className="renew-market-price">{currentPrice}</strong>
            </div>

            <div className="renew-market-chart">
              <div className="renew-market-controls">
                <div className="renew-chip-group">
                  {(marketDetail?.conditions || [{ key: 'a', label: t('aGrade') }, { key: 'psa10', label: 'PSA10' }]).map((item) => (
                    <button key={item.key} type="button" className={condition === item.key ? 'is-active' : ''} onClick={() => setCondition(item.key)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="renew-chip-group">
                  {(marketDetail?.ranges || [{ key: '7d', label: '7D' }, { key: '1m', label: '1M' }, { key: 'all', label: 'ALL' }]).map((item) => (
                    <button key={item.key} type="button" className={range === item.key ? 'is-active' : ''} onClick={() => setRange(item.key)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <RenewMarketChart points={chartPoints} uiLang={uiLang} />
              <div className="renew-market-recent">
                <h3>{t('recentSales')}</h3>
                {recentSales.slice(0, 8).map((sale, index) => (
                  <div key={`${sale.date}-${sale.price}-${index}`} className="renew-market-sale">
                    <span>{sale.condition || condition.toUpperCase()}</span>
                    <small>{sale.date}</small>
                    <strong>{formatYen(sale.price)}</strong>
                  </div>
                ))}
                {!recentSales.length ? <div className="renew-empty">{t('noRecentSales')}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function RenewDeck({ authUser, userState, setUserState, uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const deckEntries = userState?.deckEntries && typeof userState.deckEntries === 'object' ? userState.deckEntries : {};

  async function runSearch() {
    const q = keyword.trim();
    if (!q) return;
    const found = await searchCards(q, 'KR');
    setResults(Array.isArray(found) ? found.slice(0, 12) : []);
  }

  async function updateDeck(card, delta) {
    if (!authUser) {
      window.alert(t('loginRequired'));
      return;
    }
    const current = Number(deckEntries[card.id] || 0);
    const nextCount = Math.max(0, Math.min(4, current + delta));
    const nextEntries = { ...deckEntries, [card.id]: nextCount };
    if (nextCount === 0) delete nextEntries[card.id];
    const nextState = { ...(userState || {}), deckEntries: nextEntries };
    setUserState(nextState);
    await saveMyState({ ...nextState, __changedFields: ['deckEntries'] });
  }

  return (
    <main className="renew-subpage">
      <section className="renew-panel">
        <div className="renew-market-search">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t('deckSearchPlaceholder')} />
          <button type="button" onClick={runSearch}>{t('search')}</button>
        </div>
        <div className="renew-deck-summary">
          <strong>{t('currentDeck')}</strong>
          <span>{Object.values(deckEntries).reduce((sum, count) => sum + Number(count || 0), 0)} / 50</span>
        </div>
        <div className="renew-deck-results">
          {results.map((card) => (
            <article key={card.id}>
              <img src={getCardImageSrc(card)} alt={card.name} onError={placeholderImage} />
              <div>
                <b>{card.cardNo}</b>
                <strong>{card.name}</strong>
                <small>{card.seriesName}</small>
              </div>
              <div className="renew-stepper">
                <button type="button" onClick={() => updateDeck(card, -1)}>-</button>
                <span>{deckEntries[card.id] || 0}</span>
                <button type="button" onClick={() => updateDeck(card, 1)}>+</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const STATS_TOP_OWNED = [
  { code: 'OP05-119', name: 'Monkey D. Luffy', meta: 'SEC · JP', count: 42, rate: 86 },
  { code: 'OP01-121', name: 'Yamato', meta: 'SEC-SPC · JP', count: 36, rate: 74 },
  { code: 'P-046', name: 'Yamato', meta: 'P · JP', count: 31, rate: 64 },
  { code: 'OP04-112', name: 'Yamato SR-P', meta: 'SR · JP', count: 27, rate: 58 }
];

const STATS_TOP_WISH = [
  { code: 'OP09-004', name: 'Shanks', meta: 'SP · JP', count: 58, delta: '+12' },
  { code: 'OP05-119', name: 'Monkey D. Luffy', meta: 'SEC-SP · JP', count: 54, delta: '+9' },
  { code: 'OP06-118', name: 'Roronoa Zoro', meta: 'SEC · JP', count: 39, delta: '+7' },
  { code: 'OP07-119', name: 'Portgas.D.Ace', meta: 'SEC · JP', count: 32, delta: '+5' }
];

const STATS_SERIES = [
  { label: 'OP-16', owned: 18, wish: 31, percent: 84 },
  { label: 'OP-15', owned: 46, wish: 22, percent: 72 },
  { label: 'OP-05', owned: 63, wish: 48, percent: 68 },
  { label: 'PROMO', owned: 24, wish: 41, percent: 55 }
];

function RenewStatsPrototype() {
  return (
    <main className="renew-subpage renew-stats-prototype">
      <section className="renew-stats-hero">
        <div>
          <span>COMMUNITY STATS</span>
          <h1>유저 컬렉션 통계</h1>
          <p>개별 계정 정보는 숨기고, 전체 보유·위시리스트 흐름만 집계해서 보여주는 구조입니다.</p>
        </div>
        <div className="renew-stats-privacy">개인별 목록 비공개 · 최소 집계 기준 적용</div>
      </section>

      <section className="renew-stats-metrics">
        {[
          ['보유 표시 카드', '1,284', '전체 유저 기준'],
          ['위시리스트 카드', '642', '중복 제외 집계'],
          ['이번 주 관심 카드', '68', '위시 증가 기준'],
          ['활성 컬렉터', '91', '최근 로그인 기준']
        ].map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </section>

      <section className="renew-stats-grid">
        <StatsRankPanel title="많이 보유한 카드" subtitle="전체 유저 보유중 표시 기준" items={STATS_TOP_OWNED} mode="owned" />
        <StatsRankPanel title="많이 찾는 위시리스트" subtitle="최근 위시 추가가 많은 카드" items={STATS_TOP_WISH} mode="wish" />
      </section>

      <section className="renew-stats-panel">
        <div className="renew-stats-panel-head">
          <div>
            <span>SERIES VIEW</span>
            <h2>시리즈별 관심도</h2>
          </div>
          <button type="button">JP 기준</button>
        </div>
        <div className="renew-series-stat-list">
          {STATS_SERIES.map((item) => (
            <article key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>보유 {item.owned} · 위시 {item.wish}</span>
              </div>
              <div className="renew-stat-bar"><i style={{ width: `${item.percent}%` }} /></div>
              <b>{item.percent}%</b>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatsRankPanel({ title, subtitle, items, mode }) {
  return (
    <section className="renew-stats-panel">
      <div className="renew-stats-panel-head">
        <div>
          <span>{mode === 'owned' ? 'OWNED TOP' : 'WISH TOP'}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="renew-stat-rank-list">
        {items.map((item, index) => (
          <article key={`${mode}-${item.code}-${index}`}>
            <div className="renew-stat-rank-no">{index + 1}</div>
            <div className="renew-stat-card-thumb">{item.code.slice(0, 2)}</div>
            <div>
              <strong>{item.code}</strong>
              <b>{item.name}</b>
              <span>{item.meta}</span>
            </div>
            <em>{mode === 'owned' ? `${item.count}명` : `${item.count}개`}</em>
            {mode === 'wish' ? <small>{item.delta}</small> : <div className="renew-stat-mini-bar"><i style={{ width: `${item.rate}%` }} /></div>}
          </article>
        ))}
      </div>
    </section>
  );
}

function RenewShops({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [type, setType] = useState('');
  const [sido, setSido] = useState('전체');
  const [gungu, setGungu] = useState('전체');
  const [query, setQuery] = useState('');
  const [regions, setRegions] = useState({ sidos: [], gungus: [] });
  const [shops, setShops] = useState([]);

  useEffect(() => {
    fetchShopRegions(type, sido).then(setRegions).catch(() => setRegions({ sidos: [], gungus: [] }));
  }, [type, sido]);

  useEffect(() => {
    fetchShops({ type, sido, gungu, q: query }).then((items) => setShops(Array.isArray(items) ? items : []));
  }, [type, sido, gungu, query]);

  return (
    <main className="renew-subpage">
      <section className="renew-panel">
        <div className="renew-shop-filters">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">{t('allShops')}</option>
            <option value="official">{t('officialShop')}</option>
            <option value="naver">{t('searchShop')}</option>
          </select>
          <select value={sido} onChange={(event) => { setSido(event.target.value); setGungu('전체'); }}>
            <option value="전체">{t('allRegions')}</option>
            {regions.sidos?.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={gungu} onChange={(event) => setGungu(event.target.value)}>
            <option value="전체">{t('allDistricts')}</option>
            {regions.gungus?.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('shopSearchPlaceholder')} />
        </div>
        <div className="renew-shop-grid">
          {shops.map((shop) => (
            <article key={`${shop.name}-${shop.address}`}>
              <b>{shop.name}</b>
              <p>{shop.address}</p>
              <small>{shop.sido} {shop.gungu} · {shop.sourceLabel || shop.sourceType}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function RenewApp() {
  const initialPage = getPageFromPath(window.location.pathname);
  const [activePage, setActivePage] = useState(() => initialPage === 'deck' ? 'home' : initialPage);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  });
  const [uiLang, setUiLang] = useState(() => {
    if (typeof window === 'undefined') return 'KR';
    return window.localStorage.getItem(UI_LANG_STORAGE_KEY) === 'EN' ? 'EN' : 'KR';
  });
  const [authUser, setAuthUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [userState, setUserState] = useState(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [visitorToken, setVisitorToken] = useState('');
  const [legalOpen, setLegalOpen] = useState(() => {
    if (typeof window === 'undefined') return null;
    if (window.location.pathname === '/privacy') return 'privacy';
    if (window.location.pathname === '/terms') return 'terms';
    return null;
  });
  const [catalogInitialSearch, setCatalogInitialSearch] = useState(null);
  const [catalogViewState, setCatalogViewState] = useState(null);
  const [canReturnToCatalog, setCanReturnToCatalog] = useState(false);
  const [marketInitialCode, setMarketInitialCode] = useState('');
  const [marketInitialApparelId, setMarketInitialApparelId] = useState(null);
  const [deckComingSoonOpen, setDeckComingSoonOpen] = useState(() => initialPage === 'deck');

  const pageTitle = useMemo(() => getUiText(uiLang, NAV_ITEMS.find((item) => item.id === activePage)?.labelKey), [activePage, uiLang]);
  const displayName = useMemo(() => getUserDisplayName(authUser), [authUser]);
  const t = (key) => getUiText(uiLang, key);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, uiLang);
  }, [uiLang]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activePage === 'prices') {
      setMarketInitialCode(params.get('code') || '');
      setMarketInitialApparelId(params.get('apparelId') || null);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextPage = getPageFromPath(window.location.pathname);
      if (nextPage === 'home') {
        setCatalogInitialSearch(null);
        setCatalogViewState(null);
      }
      if (nextPage === 'deck') {
        setDeckComingSoonOpen(true);
        setActivePage('home');
        return;
      }
      setActivePage(nextPage);
      if (nextPage === 'prices') {
        const params = new URLSearchParams(window.location.search);
        setMarketInitialCode(params.get('code') || '');
        setMarketInitialApparelId(params.get('apparelId') || null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const savedVisitorToken = window.localStorage.getItem(VISITOR_TOKEN_KEY);
    if (savedVisitorToken) {
      setVisitorToken(savedVisitorToken);
      return;
    }
    const nextVisitorToken = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_TOKEN_KEY, nextVisitorToken);
    setVisitorToken(nextVisitorToken);
  }, []);

  useEffect(() => {
    if (!visitorToken) return undefined;
    const reportVisit = () => {
      trackVisit(visitorToken, window.location.pathname).catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(reportVisit, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(reportVisit, 1500);
    return () => window.clearTimeout(timer);
  }, [visitorToken]);

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthUser(data.session?.user || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!authUser) {
      setUserState(null);
      setStateLoading(false);
      return undefined;
    }
    setStateLoading(true);
    fetchMyState()
      .then((state) => {
        if (!cancelled) setUserState(state || null);
      })
      .catch(() => {
        if (!cancelled) setUserState(null);
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    let cancelled = false;
    const username = authUser?.user_metadata?.username;
    if (username !== 'admin') {
      setAdminStats(null);
      return undefined;
    }
    fetchAdminStats(username)
      .then((stats) => {
        if (!cancelled) setAdminStats(stats || null);
      })
      .catch(() => {
        if (!cancelled) setAdminStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  async function handleAuthClick() {
    if (authUser && supabase) {
      await supabase.auth.signOut();
      setAuthUser(null);
      return;
    }
    setAuthOpen(true);
  }

  function navigatePage(page, options = {}) {
    if (page === 'deck') {
      setDeckComingSoonOpen(true);
      return;
    }
    if (page === 'home') {
      setCatalogInitialSearch(null);
      setCatalogViewState(null);
    }
    setActivePage(page);
    if (page === 'prices' && !options.query) {
      setMarketInitialCode('');
      setMarketInitialApparelId(null);
      setCanReturnToCatalog(false);
    }
    const path = PAGE_PATHS[page] || '/';
    const query = options.query ? `?${options.query}` : '';
    const nextUrl = `${path}${query}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
  }

  function openLegal(type) {
    setLegalOpen(type);
    window.history.pushState(null, '', `/${type}`);
  }

  function closeLegal() {
    setLegalOpen(null);
    if (window.location.pathname === '/privacy' || window.location.pathname === '/terms') {
      window.history.pushState(null, '', PAGE_PATHS[activePage] || '/');
    }
  }

  return (
    <div className={`renew-app ${isDark ? 'is-dark' : ''}`}>
      <RenewHeader
        activePage={activePage}
        onNavigate={navigatePage}
        isDark={isDark}
        onToggleTheme={() => setIsDark((value) => !value)}
        isLoggedIn={Boolean(authUser)}
        displayName={displayName}
        onAuthClick={handleAuthClick}
        uiLang={uiLang}
        onUiLangChange={setUiLang}
      />
      {activePage === 'home' ? (
        <RenewHome
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          stateLoading={stateLoading}
          adminStats={adminStats}
          uiLang={uiLang}
          onSubmitSearch={(search) => {
            setCatalogViewState(null);
            setCatalogInitialSearch({
              locale: search.locale || 'KR',
              q: String(search.q || '').trim(),
              id: Date.now()
            });
            navigatePage('cards');
          }}
        />
      ) : activePage === 'cards' ? (
        <RenewCatalog
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          initialSearch={catalogInitialSearch}
          initialViewState={catalogViewState}
          onViewStateChange={setCatalogViewState}
          onOpenMarket={(marketTarget) => {
            const nextCode = typeof marketTarget === 'object' ? marketTarget?.code : marketTarget;
            const nextApparelId = typeof marketTarget === 'object' ? marketTarget?.apparelId : null;
            setMarketInitialCode(nextCode || '');
            setMarketInitialApparelId(nextApparelId || null);
            setCanReturnToCatalog(true);
            const query = new URLSearchParams();
            if (nextCode) query.set('code', nextCode);
            if (nextApparelId) query.set('apparelId', String(nextApparelId));
            navigatePage('prices', { query: query.toString() });
          }}
          uiLang={uiLang}
        />
      ) : activePage === 'prices' ? (
        <RenewMarket
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          initialCode={marketInitialCode}
          initialApparelId={marketInitialApparelId}
          onBackToCatalog={canReturnToCatalog ? () => navigatePage('cards') : null}
          uiLang={uiLang}
        />
      ) : activePage === 'deck' ? (
        <RenewDeck authUser={authUser} userState={userState} setUserState={setUserState} uiLang={uiLang} />
      ) : activePage === 'shops' ? (
        <RenewShops uiLang={uiLang} />
      ) : activePage === 'statsPrototype' ? (
        <RenewStatsPrototype />
      ) : (
        <PlaceholderPage title={pageTitle} />
      )}
      {authOpen ? <RenewAuthModal onClose={() => setAuthOpen(false)} onSignedIn={setAuthUser} /> : null}
      {deckComingSoonOpen ? <RenewComingSoonModal uiLang={uiLang} onClose={() => setDeckComingSoonOpen(false)} /> : null}
      {activePage === 'home' ? <CoupangPartnerBanners /> : null}
      <footer className="renew-footer">
        <strong>© 2026 OPTCG Korea. All rights reserved.</strong>
        <p>
          {t('footerIntro')}<br />
          {t('footerRights')}<br />
          {t('footerNoAffiliation')}
        </p>
        <p>
          {t('footerPriceNotice')}<br />
          {t('footerResponsibility')}
        </p>
        <div className="renew-footer-links">
          <a href="/terms" onClick={(event) => { event.preventDefault(); openLegal('terms'); }}>{t('terms')}</a>
          <span>·</span>
          <a href="/privacy" onClick={(event) => { event.preventDefault(); openLegal('privacy'); }}>{t('privacy')}</a>
          <span>·</span>
          <span>{t('contact')}: optkr26@gmail.com</span>
          <span>·</span>
          <span>{t('partnership')}: optkr26@gmail.com</span>
        </div>
      </footer>
      {legalOpen ? <RenewLegalModal type={legalOpen} onClose={closeLegal} /> : null}
    </div>
  );
}
