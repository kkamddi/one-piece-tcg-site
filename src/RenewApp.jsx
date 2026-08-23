import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { fetchAdminStats, fetchPopularSearches, trackPopularSearch, trackVisit } from './api/admin';
import { checkAuthAvailability, deleteMyAccount, signInWithIdentifier } from './api/auth';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import { checkInCommunityAttendance, fetchCommunityPointOverview } from './api/community';
import {
  deleteLeaderReview,
  fetchDeckLabReference,
  fetchDeckTemplateVersion,
  fetchLeaderOverview,
  fetchPopularDeckLeaders,
  recordLeaderSelection,
  saveLeaderReview
} from './api/deck-lab';
import { fetchMyState } from './api/me';
import { saveMyState } from './api/me';
import { createMarketplaceListing, deleteMarketplaceListing, deleteMarketplaceVerification, fetchMarketplaceConversations, fetchMarketplaceListings, fetchMarketplaceMessages, fetchMarketplaceMyVerification, fetchMarketplaceNotifications, fetchMarketplaceVerifications, incrementMarketplaceListingView, markAllMarketplaceNotificationsRead, markMarketplaceNotificationRead, sendMarketplaceMessage, startMarketplaceConversation, submitMarketplaceVerification, updateMarketplaceListing, updateMarketplaceListingInterest, updateMarketplaceVerification, uploadMarketplaceImage } from './api/marketplace';
import { deletePriceAlertRule, fetchPriceAlertRules, savePriceAlertRule } from './api/price-alerts';
import { deletePortfolioHolding, deletePortfolioPurchase, fetchPortfolio, savePortfolioPurchase } from './api/portfolio';
import { enablePushNotifications, fetchPushNotificationStatus, getPushCapability, sendTestPushNotification, syncNativePushRegistration } from './api/push-notifications';
import { fetchShopRegions, fetchShops } from './api/shops';
import { resolveApiUrl } from './lib/native-runtime';
import { NATIVE_AUTH_EVENT, signInWithSocialProvider } from './lib/native-auth';
import { hasSupabaseAuthConfig, supabase } from './lib/supabase';
import boxMarketItems from './data/box-market-items';
import boxMarketPrices from './data/box-market-prices.json';
import snkrdunkPopularApparelIds from './data/snkrdunk-popular-cards';
import seriesData from './data/series.json';
import seriesCardCounts from './data/series-card-counts.json';
import topicsData from './data/topics.json';
import CenteringLab from './CenteringLab';
import PortfolioCalculator, { getPortfolioCalculatorFaq, PortfolioCalculatorGuide } from './PortfolioCalculator';
import ProfitCalculator, { getProfitCalculatorFaq, ProfitCalculatorGuide } from './ProfitCalculator';
import { getCommunityGrade } from '../lib/community-grades.js';
import './renew.css';

const LOGO_SRC = '/optcg-logo-light.png';
const APP_BUILD_REVISION = '2026-08-22-market-currency-v2';
const CARD_THUMBNAIL_BASE_URL = (import.meta.env.VITE_CARD_THUMBNAIL_BASE_URL || 'https://cards.optcgkorea.com').replace(/\/+$/, '');
const SNKRDUNK_MARKET_URL = 'https://snkrdunk.com/en/invitation/AGJ872';
const resolvedBoxMarketItems = boxMarketItems.map((item) => {
  const snapshot = boxMarketPrices.items?.[String(item.apparelId)];
  if (!snapshot) return item;
  return {
    ...item,
    ...snapshot,
    previewImageUrl: snapshot.previewImageUrl || item.previewImageUrl,
    releaseDate: snapshot.releaseDate || item.releaseDate
  };
});
const AUTH_CONSENT_VERSION = '2026-07-14';
const PENDING_SOCIAL_CONSENT_KEY = 'card-pone-pending-social-consent';
const ALL_SERIES_ID = '__ALL_SERIES__';
const BOX_SHORT_TITLES = {
  'OP-01': 'Romance Dawn',
  'OP-02': 'Paramount War',
  'OP-03': 'Pillars of Strength',
  'OP-04': 'Kingdoms of Intrigue',
  'OP-05': 'Awakening of the New Era',
  'OP-06': 'Wings of the Captain',
  'OP-07': '500 Years in the Future',
  'OP-08': 'Two Legends',
  'OP-09': 'Emperors in the New World',
  'OP-10': 'Royal Blood',
  'OP-11': 'A Fist of Divine Speed',
  'OP-12': 'Legacy of the Master',
  'OP-13': 'Carrying on His Will',
  'OP-14': "The Azure Sea's Seven",
  'OP-15': "Adventure on KAMI's Island",
  'OP-16': 'The Time of Battle',
  'EB-02': 'Anime 25th Collection',
  'EB-03': 'ONE PIECE Heroines',
  'EB-03-SP': 'Heroines Special Set',
  'EB-04': 'EGGHEAD CRISIS',
  'PRB-01': 'THE BEST',
  'PRB-02': 'THE BEST vol.2',
  'PCC-1': 'BASE SHOP vol.1',
  'PCC-6A-1': '6 assort vol.1',
  'PCC-BS4': 'Best Selection vol.4',
  'PCC-KUMAMOTO': 'Kumamoto Special',
  'OPDAY-2024': "ONE PIECE DAY'24",
  'OPDAY-2025': "ONE PIECE DAY'25",
  'OPC-001': '25th Anniversary',
  'OPC-018': '1st ANNIVERSARY SET',
  'OPC-033': 'Promotion Card Set 1',
  'OPC-035': 'Promotion Card Set 3',
  'OPC-046': 'English 2nd Anniversary JP',
  'OJP-3': 'Official Judge Pack Vol.3',
  'OPC-TCG-R1-PP': 'ROUND1 Promotion Pack',
  'P-2022': 'Promotional Pack 2022',
  'TPP-NFE': 'New Four Emperors Pack'
};
const BOX_MARKET_PAGE_SIZE = 20;
const THEME_STORAGE_KEY = 'one-piece-tcg-theme';
const UI_LANG_STORAGE_KEY = 'one-piece-tcg-ui-lang';
const VISITOR_TOKEN_KEY = 'one-piece-tcg-visitor-token';
const MARKET_INTEREST_STORAGE_PREFIX = 'one-piece-tcg-market-interest-';
const RENEWAL_NOTICE_KEY = 'one-piece-tcg-news-notice-2026-07-25-lab-tools';
const PORTFOLIO_IMAGE_CACHE_KEY = 'one-piece-tcg-portfolio-image-cache-v2';
const MARKET_USD_TO_JPY = 155;
const MARKET_USD_TO_KRW = MARKET_USD_TO_JPY * 9.4;
const RECENT_SALES_VISIBLE_MS = 1000 * 60 * 60 * 24 * 365;
const MARKETPLACE_TAB_VISIBLE = false;
const MARKETPLACE_ENABLED = false;
const MARKET_INDEX_PUBLIC_ENABLED = true;
const RENEWAL_NOTICE_POPUP_ENABLED = false;
const PARTNER_NEWS_POPUP_ENABLED = false;
const RARITY_ORDER = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const DEFERRED_RARITIES = new Set(['C', 'UC']);
const PACK_SIMULATOR_DEFAULT_RULE = Object.freeze({
  cardsPerPack: 6,
  packsPerBox: 24,
  boxesPerCarton: 12,
  cartonBoxHits: [
    { group: 'SP', count: 1 },
    { group: 'LEADER_PARALLEL', count: 2 },
    { group: 'SEC', count: 4 },
    { group: 'PARALLEL', count: 5 }
  ],
  boxBaseHits: [
    { group: 'L', count: 1 },
    { group: 'SR', count: 4 }
  ],
  mangaRate: 0.001,
  godPackRate: 0.001
});
const PACK_SIMULATOR_RULES_BY_SERIES = Object.freeze({
  'JP-PRB01': { cardsPerPack: 10, packsPerBox: 10 },
  'JP-PRB02': { cardsPerPack: 10, packsPerBox: 10 }
});
const PACK_SIMULATOR_PRB01_GOD_MANGA_CARD_IDS = Object.freeze([
  'JP::OP01-120_r1',
  'JP::OP02-013_r1',
  'JP::OP03-122_r1',
  'JP::OP04-083_r1',
  'JP::OP05-069_r1',
  'JP::OP05-074_r1',
  'JP::OP05-119_r1',
  'JP::OP06-118_r1',
  'JP::P-053_r1'
]);
const PACK_SIMULATOR_MANGA_CARD_IDS_BY_SERIES = Object.freeze({
  'JP-OP01': ['JP::OP01-120_p2'],
  'JP-OP02': ['JP::OP02-013_p2'],
  'JP-OP03': ['JP::OP03-122_p2'],
  'JP-OP04': ['JP::OP04-083_p2'],
  'JP-OP05': ['JP::OP05-069_p2', 'JP::OP05-074_p2', 'JP::OP05-119_p2'],
  'JP-OP06': ['JP::OP06-118_p2'],
  'JP-EB01': ['JP::EB01-006_p2'],
  'JP-OP07': ['JP::OP07-051_p2'],
  'JP-OP08': ['JP::OP08-118_p2'],
  'JP-OP09': ['JP::OP09-004_p2', 'JP::OP09-051_p2', 'JP::OP09-093_p2', 'JP::OP09-118_p2', 'JP::OP09-119_p2'],
  'JP-OP10': ['JP::OP10-119_p2'],
  'JP-EB02': ['JP::EB02-061_p2'],
  'JP-OP11': ['JP::OP11-118_p2'],
  'JP-OP12': ['JP::OP12-118_p2'],
  'JP-OP13': [
    'JP::OP13-118_p2',
    'JP::OP13-118_p3',
    'JP::OP13-119_p2',
    'JP::OP13-119_p3',
    'JP::OP13-120_p2',
    'JP::OP13-120_p3'
  ],
  'JP-OP14': ['JP::OP14-119_p2'],
  'JP-EB03': ['JP::EB03-061_p2'],
  'JP-OP15': ['JP::OP15-118_p2'],
  'JP-OP16': ['JP::OP16-063_p2', 'JP::OP16-065_p2', 'JP::OP16-073_p2'],
  'JP-PRB01': ['JP::P-053_r1'],
  'JP-PRB02': ['JP::OP06-119_r1']
});
const PACK_SIMULATOR_MANGA_CARD_IDS = new Set([
  ...Object.values(PACK_SIMULATOR_MANGA_CARD_IDS_BY_SERIES).flat(),
  ...PACK_SIMULATOR_PRB01_GOD_MANGA_CARD_IDS
]);
const PACK_SIMULATOR_VIRTUAL_CARDS_BY_SERIES = Object.freeze({
  'JP-PRB01': [
    {
      id: 'SIM::JP-PRB01-GOLD-DON-ACE',
      locale: 'JP',
      cardNo: 'DON!!',
      name: 'ゴールド ドン!!カード',
      rarity: 'GOLD DON',
      category: 'DON',
      imageUrl: 'https://www.onepiece-cardgame.com/images/products/boosters/prb01/PRB01_DON_SP_Ace.png',
      isSimulatorOnly: true
    },
    {
      id: 'SIM::JP-PRB01-GOLD-DON-LUFFY',
      locale: 'JP',
      cardNo: 'DON!!',
      name: 'ゴールド ドン!!カード',
      rarity: 'GOLD DON',
      category: 'DON',
      imageUrl: 'https://www.onepiece-cardgame.com/images/products/boosters/prb01/PRB01_DON_SP_luffy.png',
      isSimulatorOnly: true
    },
    {
      id: 'SIM::JP-PRB01-GOLD-DON-SABO',
      locale: 'JP',
      cardNo: 'DON!!',
      name: 'ゴールド ドン!!カード',
      rarity: 'GOLD DON',
      category: 'DON',
      imageUrl: 'https://www.onepiece-cardgame.com/images/products/boosters/prb01/PRB01_DON_SP_sabo.png',
      isSimulatorOnly: true
    }
  ],
  'JP-PRB02': Array.from({ length: 30 }, (_, index) => ({
    id: `SIM::JP-PRB02-GOLD-DON-${String(index + 1).padStart(2, '0')}`,
    locale: 'JP',
    cardNo: 'DON!!',
    name: 'ゴールド ドン!!カード',
    rarity: 'GOLD DON',
    category: 'DON',
    imageUrl: 'https://www.onepiece-cardgame.com/renewal/images/products/boosters/prb02/don_sp.webp',
    isSimulatorOnly: true
  }))
});
const PACK_SIMULATOR_GOD_PACKS_BY_SERIES = Object.freeze({
  'JP-PRB01': {
    label: 'MANGA GOD PACK',
    cardIds: PACK_SIMULATOR_PRB01_GOD_MANGA_CARD_IDS,
    appendGroups: ['GOLD_DON'],
    appendCount: 1
  },
  'JP-PRB02': {
    variants: [
      {
        label: 'GOLD DON!! GOD PACK',
        groups: ['GOLD_DON'],
        count: 10
      },
      {
        label: 'PARALLEL GOD PACK',
        groups: ['SP', 'LEADER_PARALLEL', 'PARALLEL'],
        count: 10
      }
    ]
  },
  'JP-EB03': {
    label: 'HEROINES SP GOD PACK',
    cardIds: [
      'JP::EB03-003_p2',
      'JP::EB03-018_p2',
      'JP::EB03-024_p2',
      'JP::EB03-026_p2',
      'JP::EB03-031_p2',
      'JP::EB03-042_p2',
      'JP::EB03-045_p2',
      'JP::EB03-053_p2',
      'JP::EB03-055_p2'
    ],
    count: 6
  },
  'JP-OP13': {
    label: 'DEMON GOD PACK',
    cardIds: [
      'JP::OP13-079_p1',
      'JP::OP13-080_p2',
      'JP::OP13-083_p2',
      'JP::OP13-084_p2',
      'JP::OP13-089_p2',
      'JP::OP13-091_p2'
    ]
  }
});

function getBoxReleaseSortValue(item) {
  const rawDate = item?.releaseDate || item?.release_date || item?.releasedAt || item?.released_at;
  const normalizedDate = typeof rawDate === 'string' ? rawDate.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1') : rawDate;
  const releaseTime = normalizedDate ? Date.parse(normalizedDate) : NaN;
  if (Number.isFinite(releaseTime)) return releaseTime;
  return 0;
}

const CALENDAR_WEEKDAYS = {
  KR: ['일', '월', '화', '수', '목', '금', '토'],
  EN: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  JP: ['日', '月', '火', '水', '木', '金', '土']
};

function toCalendarDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function getCalendarTodayKey() {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
}

function getCalendarTopicKind(topic) {
  if (['release', 'event', 'notice'].includes(topic?.calendarKind)) return topic.calendarKind;
  const category = String(topic?.category || '').toUpperCase();
  if (category.includes('이벤트') || category.includes('イベント') || category.includes('EVENT')) return 'event';
  if (category.includes('상품') || category.includes('商品') || category.includes('PRODUCT')) return 'notice';
  return '';
}

function getCalendarProductCode(value) {
  const match = String(value || '').toUpperCase().match(/(?:OP|EB|ST|PRB|DP|EX|TS|DF|AC)-?\d{2}(?:-EB\d{2})?/);
  return match ? match[0].replaceAll('-', '') : '';
}

const CALENDAR_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getCalendarEventPriority(item) {
  if (CALENDAR_PRIORITY_ORDER[item?.calendarPriority] !== undefined) return item.calendarPriority;
  if (item?.kind === 'event' || item?.calendarKind === 'event') return 'low';
  const text = String(item?.title || '').toUpperCase();
  if (/(BOOSTER|ブースター|부스터|BOX|ボックス|프로모|PROMO|プロモ|CARD COLLECTION|カードコレクション|카드 컬렉션|CARD SET|カードセット|카드 세트)/.test(text)) return 'high';
  return item?.kind === 'release' || item?.calendarKind === 'release' ? 'medium' : 'low';
}

function getCalendarDisplayTitle(event, uiLang) {
  if (uiLang === 'JP') return event?.title || event?.titleKo;
  return uiLang !== 'EN' && event?.titleKo ? event.titleKo : event?.title;
}

function buildCalendarEvents(boxes = []) {
  const releases = boxes
    .map((item) => ({ item, date: toCalendarDateKey(item?.releaseDate) }))
    .filter(({ date }) => date)
    .map(({ item, date }) => ({
      id: `release-${item.code}-${date}`,
      date,
      kind: 'release',
      locale: 'JP',
      category: 'RELEASE',
      title: `${item.code} · ${BOX_SHORT_TITLES[item.code] || item.name}`,
      sourceLabel: 'SNKRDUNK',
      url: item.sourceUrl || `/prices/box/${encodeURIComponent(item.code)}`,
      imageUrl: item.previewImageUrl || '',
      productCode: getCalendarProductCode(item.code),
      priority: 'high'
    }));
  const notices = topicsData
    .map((item) => ({ ...item, kind: getCalendarTopicKind(item), date: toCalendarDateKey(item.scheduleDate || item.date) }))
    .filter((item) => item.kind && item.date)
    .map((item) => ({
      id: `topic-${item.id}`,
      date: item.date,
      kind: item.kind,
      locale: String(item.locale || '').toUpperCase() === 'JP' ? 'JP' : 'KR',
      category: item.category || 'NOTICE',
      title: item.title,
      titleKo: item.titleKo || '',
      sourceLabel: item.source === 'JP_OFFICIAL' ? 'JP OFFICIAL' : 'KR OFFICIAL',
      url: item.url || '',
      imageUrl: item.imageUrl || '',
      endDate: toCalendarDateKey(item.endDate),
      isSchedule: Boolean(item.calendarOnly),
      productCode: item.calendarKind === 'release' ? getCalendarProductCode(item.title) : '',
      priority: getCalendarEventPriority(item)
    }));
  const officialReleaseCodes = new Set(notices.filter((item) => item.kind === 'release' && item.locale === 'JP' && item.productCode).map((item) => item.productCode));
  const fallbackReleases = releases.filter((item) => !item.productCode || !officialReleaseCodes.has(item.productCode));
  return [...fallbackReleases, ...notices]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => a.date.localeCompare(b.date) || CALENDAR_PRIORITY_ORDER[a.priority] - CALENDAR_PRIORITY_ORDER[b.priority] || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

function getCalendarMonthCells(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const gridStart = new Date(year, month - 1, 1 - firstDate.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    return { key, day: date.getDate(), weekday: date.getDay(), inMonth: date.getMonth() === month - 1 };
  });
}

function getCalendarWeekCells(dateKey) {
  const selected = new Date(`${dateKey}T00:00:00`);
  const weekStart = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - selected.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    return { key, day: date.getDate(), weekday: date.getDay() };
  });
}

function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return undefined;
    const body = document.body;
    const doc = document.documentElement;
    const lockCount = Number(body.dataset.renewModalLockCount || 0);
    const scrollY = lockCount ? Number(body.dataset.renewModalScrollY || 0) : (window.scrollY || doc.scrollTop || 0);
    if (!lockCount) {
      body.dataset.renewModalScrollY = String(scrollY);
      body.dataset.renewModalPrevPosition = body.style.position || '';
      body.dataset.renewModalPrevTop = body.style.top || '';
      body.dataset.renewModalPrevWidth = body.style.width || '';
      body.dataset.renewModalPrevOverflow = body.style.overflow || '';
      body.dataset.renewModalPrevHtmlOverflow = doc.style.overflow || '';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      doc.style.overflow = 'hidden';
    }
    body.dataset.renewModalLockCount = String(lockCount + 1);
    return () => {
      const nextCount = Math.max(0, Number(body.dataset.renewModalLockCount || 1) - 1);
      body.dataset.renewModalLockCount = String(nextCount);
      if (nextCount) return;
      const restoreY = Number(body.dataset.renewModalScrollY || 0);
      body.style.position = body.dataset.renewModalPrevPosition || '';
      body.style.top = body.dataset.renewModalPrevTop || '';
      body.style.width = body.dataset.renewModalPrevWidth || '';
      body.style.overflow = body.dataset.renewModalPrevOverflow || '';
      doc.style.overflow = body.dataset.renewModalPrevHtmlOverflow || '';
      delete body.dataset.renewModalLockCount;
      delete body.dataset.renewModalScrollY;
      delete body.dataset.renewModalPrevPosition;
      delete body.dataset.renewModalPrevTop;
      delete body.dataset.renewModalPrevWidth;
      delete body.dataset.renewModalPrevOverflow;
      delete body.dataset.renewModalPrevHtmlOverflow;
      window.scrollTo(0, restoreY);
    };
  }, [active]);
}

const RENEW_HOME_UPDATES = [
  {
    id: '2026-07-25-lab-tools',
    title: '[26.07.25] 업데이트 안내',
    summary: '실험실 Tool 추가',
    details: [
      '센터링 측정기',
      '카드깡 시뮬레이터',
      '포트폴리오 수익률 계산기',
      '덱 빌더'
    ]
  },
  {
    id: '2026-07-22-centering-lab',
    title: '[26.07.22] 업데이트 안내',
    summary: '카드 센터링 측정기 추가',
    details: [
      '카메라 가이드에 카드를 맞춰 앞면 좌우·상하 센터링 비율 측정',
      '측정 신뢰도와 PSA 앞면 센터링 참고 구간 제공',
      '자동 인식이 어려운 카드의 인쇄 경계 수동 조정 지원',
      '촬영 이미지는 서버로 전송하거나 저장하지 않고 기기 안에서만 분석'
    ]
  },
  {
    id: '2026-07-15-portfolio-return',
    title: '[26.07.15] 업데이트 안내',
    summary: '포트폴리오 수익률 기능 추가',
    details: [
      '카드별 매입일, 매입가와 수량 기록 가능',
      '현재 시세를 기준으로 평가손익과 수익률 자동 계산',
      'Single과 PSA10을 구분하여 포트폴리오 관리',
      '매입 기록 추가·수정·삭제 지원',
      '로그인 계정에 포트폴리오와 매입 기록 저장'
    ]
  },
  {
    id: '2026-07-13-calendar',
    title: '[26.07.13] 업데이트 안내',
    summary: '원피스카드 일정 캘린더 추가',
    details: [
      '한글판·일본판 신규 상품, 프로모 카드와 공식 일정을 캘린더에서 확인 가능',
      '일본판 공식 일정의 한글 요약과 미리보기 이미지 제공'
    ]
  },
  {
    id: '2026-07-11-price-alerts',
    title: '[26.07.11] 업데이트 안내',
    summary: '카드 시세 알림 기능 추가',
    details: [
      '카드도감과 시세 상세 화면에서 원하는 카드의 시세 알림 등록 가능',
      'Single·PSA10을 선택하고 목표 가격 또는 상승·하락률 조건 설정 가능',
      '조건 충족 시 브라우저 푸시와 상단 알림센터에서 확인 가능',
      '알림 기능 사용을 위해 로그인과 브라우저 알림 권한 허용 필요'
    ]
  },
  {
    id: '2026-06-30-kr-op13',
    title: '[26.06.30] 업데이트 안내',
    summary: '한글판 OP-13 업데이트 완료',
    details: [
      '한글판 부스터 팩 OP-13 계승되는 의지 카드 데이터 추가',
      '한글판 카드 도감 시리즈 목록에 OP-13 반영',
      '카드 검색, 상세보기, 보유 카드, 위시리스트 기능에서 OP-13 확인 가능'
    ]
  },
  {
    id: '2026-06-27-nearby-shops',
    title: '[26.06.27] 업데이트 안내',
    summary: '구매처 내 주변순 기능 추가',
    details: [
      '가까운 구매처 순서로 자동 정렬',
      '매장별 예상 거리 표시',
      '지역·시군구·매장 유형 필터와 함께 사용 가능',
      '위치 정보는 거리 계산에만 사용되며 별도로 저장되지 않음'
    ]
  },
  {
    id: '2026-06-19-marketplace',
    title: '[26.06.19] 업데이트 안내',
    summary: '거래 탭 기능 개선',
    details: [
      '판매자가 올린 게시물 사진이 거래 상세와 목록에 반영되도록 개선',
      '게시물 문의 후 거래방으로 바로 이어지는 흐름 개선',
      '거래완료 게시물은 거래방 추가 메시지 입력 제한'
    ]
  },
  {
    id: '2026-06-11-news',
    title: '[26.06.11] 업데이트 안내',
    summary: 'News 탭 업데이트 완료',
    details: [
      '한글판·일본판 공식 공지사항 영역 추가',
      'OP-17 아마존 사전예약 응모 바로가기 추가',
      '가이드/Q&A 섹션 추가',
      '카드 보관용품 바로가기 및 미리보기 추가'
    ]
  },
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
    title: '[26.05.29] 업데이트 안내',
    summary: '카드 시세 매핑 기능 개선',
    details: [
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

function getMarketInterestStorageKey(userId) {
  return `${MARKET_INTEREST_STORAGE_PREFIX}${userId || 'guest'}`;
}

function readMarketInterestIds(userId) {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(getMarketInterestStorageKey(userId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeMarketInterestIds(userId, ids) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getMarketInterestStorageKey(userId), JSON.stringify([...ids]));
}
const OFFICIAL_TOPIC_ITEMS = Array.isArray(topicsData)
  ? topicsData.filter((item) => !item.calendarOnly)
  : [];
const TOPIC_SOURCE_LABEL = {
  KR_OFFICIAL: '한국 공식',
  JP_OFFICIAL: '일본 공식'
};
const COUPANG_PARTNER_ITEMS = [
  { title: '바실리스크 슬리브 100매', category: 'sleeve', description: '67x94 카드 슬리브', href: 'https://link.coupang.com/a/euUiZAsUNM', embedSrc: 'https://coupa.ng/cnm8Z3' },
  { title: '카드쉘 슬리브 100매', category: 'sleeve', description: '카드 보호용 슬리브', href: 'https://link.coupang.com/a/euUrRXIn1w', embedSrc: 'https://coupa.ng/cnm88y' },
  { title: '파브 슬리브 100매', category: 'sleeve', description: '카드 보관용 슬리브', href: 'https://link.coupang.com/a/euUufMKLOC', embedSrc: 'https://coupa.ng/cnm9aB' },
  { title: '바실리스크 탑로더 25매', category: 'toploader', description: '카드 전시·보관용 탑로더', href: 'https://link.coupang.com/a/euViubhCSq', embedSrc: 'https://coupa.ng/cnm9JS' },
  { title: '카드쉘 탑로더 25매', category: 'toploader', description: '카드 전시·보관용 탑로더', href: 'https://link.coupang.com/a/euVnNCB7My', embedSrc: 'https://coupa.ng/cnm9ND' },
  { title: '카드쉘 자석케이스 1개', category: 'case', description: '전시·장기 보관용 자석케이스', href: 'https://link.coupang.com/a/euVsFhXppA', embedSrc: 'https://coupa.ng/cnm9QH' },
  { title: '바실리스크 카드 세이버 50매', category: 'case', description: '카드 보호용 세이버', href: 'https://link.coupang.com/a/euVvPHYSrs', embedSrc: 'https://coupa.ng/cnm9SP' },
  { title: '바실리스크 카드 바인더', category: 'binder', description: '컬렉션 정리용 바인더', href: 'https://link.coupang.com/a/euVEjjWf92', embedSrc: 'https://coupa.ng/cnm9X5' },
  { title: '카드쉘 바인더', category: 'binder', description: '컬렉션 정리용 바인더', href: 'https://link.coupang.com/a/euVGnYDQfk', embedSrc: 'https://coupa.ng/cnm90v' },
  { title: '바실리스크 카드 보관함', category: 'storage', description: '카드 보관용 케이스', href: 'https://link.coupang.com/a/euVKSm27em', embedSrc: 'https://coupa.ng/cnm94P' },
  { title: '바실리스크 카드 보관함', category: 'storage', description: '카드 보관용 케이스', href: 'https://link.coupang.com/a/euVMADyxlQ', embedSrc: 'https://coupa.ng/cnm96F' },
  { title: '바실리스크 카드 보관함', category: 'storage', description: '카드 보관용 케이스', href: 'https://link.coupang.com/a/euVNR4meGW', embedSrc: 'https://coupa.ng/cnm97I' }
];
const SUPPLY_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'sleeve', label: '슬리브' },
  { id: 'toploader', label: '탑로더' },
  { id: 'case', label: '케이스' },
  { id: 'binder', label: '바인더' },
  { id: 'storage', label: '보관함' }
];
const NEWS_LINK_GROUPS = [
  {
    id: 'preorder',
    title: '아마존 응모',
    description: '',
    status: 'AMAZON',
    links: [
      {
        label: '히로인즈2 응모',
        subLabel: 'Amazon Japan',
        href: 'https://link.amazon/B04fyW76r',
        badge: 'EB-05'
      }
    ]
  }
];
const NEWS_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'notice', label: '공지사항' },
  { id: 'guide', label: '가이드/Q&A' },
  { id: 'preorder', label: '사전예약' },
  { id: 'supplies', label: '카드용품' }
];
const CARD_STORAGE_GUIDE = {
  title: '원피스카드 보관 방법',
  intro: '원피스카드는 습기, 빛, 압력, 마찰에 약합니다. 기본 보관 순서를 정해두면 일반 카드부터 고가 카드까지 상태를 안정적으로 유지할 수 있습니다.',
  sections: [
    {
      title: '카드가 손상되는 주요 원인',
      items: [
        '습기와 온도 변화로 인한 휨',
        '직사광선과 강한 조명으로 인한 색 바램',
        '카드끼리 직접 닿으면서 생기는 표면 스크래치',
        '무거운 물건에 눌리거나 비스듬히 보관되어 생기는 모서리 손상'
      ]
    },
    {
      title: '기본 보관 순서',
      items: [
        '개봉 직후 카드 표면을 손으로 문지르지 않습니다.',
        '먼저 소프트 슬리브에 넣어 표면 마찰을 줄입니다.',
        '자주 꺼내보는 카드는 탑로더나 바인더에 넣습니다.',
        '고가 카드나 그레이딩 후보 카드는 카드세이버 또는 자석케이스로 따로 분리합니다.'
      ]
    },
    {
      title: '슬리브, 탑로더, 카드세이버 차이',
      items: [
        '슬리브는 가장 기본적인 표면 보호용입니다.',
        '탑로더는 카드가 휘거나 눌리는 것을 줄이는 단단한 보관용입니다.',
        '카드세이버는 PSA/BGS 등 그레이딩 제출용으로 자주 사용됩니다.',
        '자석케이스는 전시용이나 고가 카드 단독 보관에 적합합니다.'
      ]
    },
    {
      title: '바인더 보관 시 주의점',
      items: [
        '카드를 슬리브에 넣은 뒤 바인더 포켓에 넣는 것이 안전합니다.',
        '바인더를 과하게 채우면 카드가 눌릴 수 있습니다.',
        '바인더는 세워두기보다 눕혀두는 편이 카드 휨을 줄이기 좋습니다.',
        '습기가 많은 장소와 직사광선이 닿는 책장은 피하는 것이 좋습니다.'
      ]
    },
    {
      title: '고가 카드 보관 팁',
      items: [
        '망가, SP, 프로모, 우승 카드처럼 고가 카드는 일반 보관함과 분리합니다.',
        '슬리브 + 카드세이버 또는 슬리브 + 자석케이스 조합을 사용합니다.',
        '시세 확인용으로 자주 꺼내보는 카드는 별도 케이스에 보관합니다.',
        '장기 보관 시 실리카겔과 함께 밀폐 보관함을 사용하는 것도 방법입니다.'
      ]
    }
  ],
  checklist: [
    '카드는 슬리브 없이 겹쳐두지 않기',
    '습기 많은 방, 창가, 차량 내부에 보관하지 않기',
    '고가 카드는 일반 카드와 분리 보관하기',
    '그레이딩 후보 카드는 표면 접촉을 최소화하기'
  ]
};
const SHOP_BUYING_GUIDE = {
  title: '원피스카드 사는 방법',
  intro: '원피스카드를 처음 구매할 때는 공인점포와 취급점포를 먼저 확인하는 것이 좋습니다. Card Pone 구매처 페이지에서는 공식 홈페이지 기준의 매장 정보를 지역별로 정리하고, 내 위치 기준 가까운 매장부터 확인할 수 있습니다.',
  sections: [
    {
      title: '공인점포와 취급점포 확인',
      items: [
        '공인점포와 취급점포는 공식 홈페이지 기준 매장 정보를 바탕으로 정리합니다.',
        '매장별 취급 여부와 재고는 시점에 따라 달라질 수 있으므로 방문 전 확인이 필요합니다.',
        '대회, 신상품 예약, 프로모션 카드 배포 여부는 매장마다 다를 수 있습니다.'
      ]
    },
    {
      title: '지역별 구매처 찾기',
      items: [
        '서울, 경기, 부산 등 지역 필터로 원하는 지역의 매장을 좁혀 볼 수 있습니다.',
        '지역을 선택하면 해당 지역의 시군구 기준으로 한 번 더 필터링할 수 있습니다.',
        '매장명 검색을 함께 사용하면 특정 매장을 빠르게 찾을 수 있습니다.'
      ]
    },
    {
      title: '내 주변 매장 찾기',
      items: [
        '위치 권한을 허용하면 현재 위치에서 가까운 구매처 순서로 정렬할 수 있습니다.',
        '매장별 예상 거리를 함께 확인할 수 있어 방문 우선순위를 정하기 좋습니다.',
        '위치 정보는 가까운 매장 정렬에만 사용하며, 브라우저 권한 설정에서 언제든 변경할 수 있습니다.'
      ]
    },
    {
      title: '지도 바로가기 활용',
      items: [
        '각 매장 카드에서 네이버지도와 카카오맵 바로가기를 제공합니다.',
        '길찾기, 영업시간, 전화번호 등 세부 정보는 지도 앱에서 최종 확인하는 것이 안전합니다.',
        '좌표가 없는 매장은 매장명 검색 링크로 연결합니다.'
      ]
    },
    {
      title: '구매 전 체크할 점',
      items: [
        '신상품 발매일과 예약 가능 여부를 먼저 확인합니다.',
        '박스, 팩, 싱글카드 취급 범위가 매장마다 다를 수 있습니다.',
        '방문 전 재고와 결제 방식, 이벤트 참여 조건을 확인하면 불필요한 이동을 줄일 수 있습니다.'
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
const CARD_PRICE_GUIDE = {
  title: '원피스카드 시세 보는 방법',
  intro: '원피스카드 시세는 같은 일련번호라도 일반 카드, 패러렐, 프로모, 언어, 그레이딩 상태에 따라 가격이 달라집니다. Card Pone 시세 페이지에서는 카드별 가격, 박스 가격, 최근 거래 기록, 기간별 그래프를 한곳에서 확인할 수 있습니다.',
  sections: [
    {
      title: '시세 검색 기본 구조',
      items: [
        '일련번호를 입력하면 같은 번호를 가진 카드 후보를 확인할 수 있습니다.',
        '같은 일련번호 안에서도 일반, 패러렐, 망가, 수배서, 프로모 버전을 구분해 선택할 수 있습니다.',
        '카드 도감에서 시세 보기로 이동하면 매핑된 상품은 바로 상세 시세로 연결됩니다.'
      ]
    },
    {
      title: 'A등급과 PSA10 구분',
      items: [
        'A등급은 주로 일반 실물 카드 기준의 거래 흐름을 확인하는 용도로 사용합니다.',
        'PSA10은 그레이딩 완료 카드 기준의 가격 흐름을 확인하는 용도로 구분합니다.',
        '같은 카드라도 A등급과 PSA10은 시장 가격과 거래 빈도가 다를 수 있습니다.'
      ]
    },
    {
      title: '최근 거래 기록과 그래프',
      items: [
        '최근 가격 기록은 실제 거래 또는 수집된 시세 기록을 기준으로 표시합니다.',
        '7D, 1M, 1Y 기간을 바꿔 가격 흐름을 비교할 수 있습니다.',
        '거래가 적은 카드는 특정 기간에 그래프가 비어 있거나 변동 폭이 크게 보일 수 있습니다.'
      ]
    },
    {
      title: '박스 가격과 싱글카드 가격',
      items: [
        '박스 탭에서는 부스터 박스와 팩 상품 가격을 확인할 수 있습니다.',
        '카드 탭에서는 싱글카드 주요 상품을 가격 기준으로 확인할 수 있습니다.',
        '시세는 수집 시점과 외부 플랫폼 상태에 따라 변동될 수 있습니다.'
      ]
    },
    {
      title: '시세를 볼 때 주의할 점',
      items: [
        '가격이 높다고 항상 실제 거래가 활발한 것은 아닙니다.',
        '최근 거래 수, 카드 상태, 언어, 버전, 그레이딩 여부를 함께 확인해야 합니다.',
        '구매와 판매 결정은 여러 플랫폼의 가격과 실제 매물 상태를 함께 비교하는 것이 좋습니다.'
      ]
    }
  ],
  checklist: [
    '일련번호와 카드 버전을 함께 확인하기',
    'A등급과 PSA10 가격을 구분해서 보기',
    '최근 거래 기록과 그래프를 같이 확인하기',
    '거래량이 적은 카드는 가격 변동을 보수적으로 판단하기'
  ]
};
const CARD_CATALOG_GUIDE = {
  title: '원피스카드 도감 사용법',
  intro: '원피스카드 도감은 한글판과 일본판 카드 정보를 시리즈, 일련번호, 카드명 기준으로 찾을 수 있는 기능입니다. OP, EB, ST, PR 시리즈를 구분하고, 같은 일련번호 안의 패러렐과 프로모 카드도 확인할 수 있습니다.',
  sections: [
    {
      title: '한글판과 일본판 도감',
      items: [
        '한글판과 일본판 카드를 별도로 선택해 검색할 수 있습니다.',
        '일본판에서는 한글 카드명 검색도 함께 지원해 원하는 캐릭터를 더 쉽게 찾을 수 있습니다.',
        '언어별 발매 시기와 수록 카드가 다를 수 있어 도감 선택 상태를 확인하는 것이 중요합니다.'
      ]
    },
    {
      title: '시리즈 분류',
      items: [
        'OP는 정규 부스터, EB는 엑스트라 부스터, ST는 스타터 덱, PR은 프로모 카드 중심으로 분류합니다.',
        '카테고리를 선택하면 해당 시리즈 목록을 확인할 수 있습니다.',
        'ALL에서는 전체 카드를 등급별로 나눠 볼 수 있습니다.'
      ]
    },
    {
      title: '일련번호 검색',
      items: [
        'OP05-119, ST21-014처럼 카드 일련번호를 입력하면 해당 번호의 카드를 찾을 수 있습니다.',
        '같은 일련번호라도 일반 카드, 패러렐, 재록, 프로모 버전이 함께 존재할 수 있습니다.',
        '정확한 카드 확인을 위해 이미지, 레어도, 시리즈 정보를 함께 비교하는 것이 좋습니다.'
      ]
    },
    {
      title: '카드명 검색',
      items: [
        '루피, 조로, 나미처럼 카드명이나 캐릭터명으로 검색할 수 있습니다.',
        '일본판 카드도 한글 이름 기준으로 검색되도록 매핑을 보강하고 있습니다.',
        '검색 결과가 많을 때는 시리즈와 등급 필터를 함께 사용하면 좋습니다.'
      ]
    },
    {
      title: '보유카드와 위시리스트',
      items: [
        '로그인 후 보유 여부와 위시리스트를 카드별로 관리할 수 있습니다.',
        '포트폴리오에서는 보유 카드와 평가액을 모아 볼 수 있습니다.',
        '수집 진행도는 시리즈별로 확인할 수 있어 목표 수집 범위를 정하기 쉽습니다.'
      ]
    }
  ],
  checklist: [
    '먼저 한글판과 일본판을 정확히 선택하기',
    '시리즈와 등급 필터를 함께 사용하기',
    '같은 일련번호의 다른 버전을 이미지로 비교하기',
    '도감 상세에서 시세 바로가기를 활용하기'
  ]
};
const HOME_NEWS_LINKS = [
  {
    label: '히로인즈2 응모',
    description: 'Amazon Japan 바로가기',
    query: 'section=preorder'
  },
  {
    label: '일본판 공식공지',
    description: '일본 공식 최신 소식',
    query: 'section=notice&locale=JP'
  },
  {
    label: '수집 가이드 업데이트',
    description: '가이드/Q&A 바로가기',
    query: 'section=guide&mode=guide'
  }
];

const HOME_SEO_GUIDE_LINKS = [
  {
    href: '/guide/card-price',
    label: '원피스카드 시세 보는 법',
    description: '카드 가격, 박스 가격, 최근 거래 기록 확인'
  },
  {
    href: '/guide/card-catalog',
    label: '원피스카드 도감 사용법',
    description: '한글판·일본판 카드와 일련번호 검색'
  },
  {
    href: '/guide/shops',
    label: '원피스카드 파는 곳',
    description: '공인점포·취급점포와 내 주변 구매처'
  },
  {
    href: '/guide/card-storage',
    label: '원피스카드 보관 방법',
    description: '슬리브, 탑로더, 바인더 보관 기준'
  }
];

const PARTNER_AD_ITEMS = [
  {
    key: 'shop-news',
    labelKr: 'CARD SHOP',
    labelEn: 'CARD SHOP',
    titleKr: '더 카드룸',
    titleEn: 'The Card Room',
    bodyKr: '서울 마포구 연남로 3길 40, 2층',
    bodyEn: '2F, 40, Yeonnam-ro 3-gil, Mapo-gu, Seoul',
    metaKr: 'Mon-Sun 11:00~22:00',
    metaEn: 'Mon-Sun 11:00~22:00',
    sido: '서울',
    gungu: '마포구',
    lat: 37.5606213,
    lng: 126.9205737,
    imageUrl: '/partners/the-card-room.png',
    actions: [
      { labelKr: '네이버 지도', labelEn: 'Naver Map', href: 'https://map.naver.com/p/entry/place/2096216680' },
      { labelKr: '스마트스토어', labelEn: 'Smart Store', href: 'https://smartstore.naver.com/fogandsunset' },
      { labelKr: '인스타그램', labelEn: 'Instagram', href: 'https://www.instagram.com/tcr_kr/' }
    ]
  },
  {
    key: 'card-sungji',
    labelKr: 'CARD SHOP',
    labelEn: 'CARD SHOP',
    titleKr: '카드성지',
    titleEn: 'Card Sungji',
    bodyKr: '한강대로 95 지하2층 B212호(용산 래미안)',
    bodyEn: 'B2 B212, 95 Hangang-daero, Yongsan',
    metaKr: 'Mon-Sun 14:00~21:00',
    metaEn: 'Mon-Sun 14:00~21:00',
    sido: '서울',
    gungu: '용산구',
    lat: 37.5290927,
    lng: 126.9668857,
    imageUrl: '/partners/card-sungji.png',
    actions: [
      { labelKr: '네이버 지도', labelEn: 'Naver Map', href: 'https://naver.me/xQe4VQum' },
      { labelKr: '인스타그램', labelEn: 'Instagram', href: 'https://www.instagram.com/card_sungji/' }
    ]
  },
  {
    key: 'moa-card-shop',
    labelKr: 'CARD SHOP',
    labelEn: 'CARD SHOP',
    titleKr: '모아카드샵',
    titleEn: 'Moa Card Shop',
    bodyKr: '서울 성동구 마조로5길 3-3 2층',
    bodyEn: '2F, 3-3, Majo-ro 5-gil, Seongdong-gu, Seoul',
    metaKr: '',
    metaEn: '',
    sido: '서울',
    gungu: '성동구',
    lat: 37.559779,
    lng: 127.0406847,
    actions: [
      { labelKr: '네이버지도', labelEn: 'Naver Map', href: 'https://naver.me/GKIpPGQ5' },
      { labelKr: '카카오맵', labelEn: 'Kakao Map', href: 'https://kko.to/gSETTkCWPY' }
    ]
  }
];

const PARTNER_SHOP_NEWS = [
  {
    id: 'card-sungji-op13-restock-2026-07-07',
    shopKey: 'card-sungji',
    type: 'stock',
    titleKr: '카드성지 OP-13 입고 예정',
    titleEn: 'Card Sungji OP-13 Coming Soon',
    bodyKr: '카드성지에 원피스카드 OP-13 관련 매물이 곧 입고될 예정입니다.',
    bodyEn: 'OP-13 products are expected to arrive at Card Sungji soon.',
    imageUrl: '/partners/news/card-sungji-op13.png',
    date: '2026-07-07',
    status: 'active',
    priority: 1
  }
];

function getPartnerShopRows(uiLang = 'KR') {
  return PARTNER_AD_ITEMS.map((item) => ({
    name: uiLang === 'EN' ? item.titleEn : item.titleKr,
    address: uiLang === 'EN' ? item.bodyEn : item.bodyKr,
    sido: item.sido,
    gungu: item.gungu,
    lat: item.lat,
    lng: item.lng,
    sourceType: 'partner',
    sourceLabel: getLocaleText(uiLang, '카드숍', 'Card Shop', 'カードショップ'),
    naverMapUrl: item.actions?.find((action) => /map\.naver\.com|naver\.me/i.test(action.href))?.href || '',
    kakaoMapUrl: item.actions?.find((action) => /map\.kakao\.com|kko\.to/i.test(action.href))?.href || ''
  }));
}

function getPartnerShopByKey(key) {
  return PARTNER_AD_ITEMS.find((item) => item.key === key) || null;
}

function getPartnerShopSlug(itemOrKey) {
  const key = typeof itemOrKey === 'string' ? itemOrKey : itemOrKey?.key;
  if (key === 'shop-news') return 'the-card-room';
  return String(key || '').trim();
}

function getPartnerShopUrl(itemOrKey) {
  const slug = getPartnerShopSlug(itemOrKey);
  return slug ? `/shops/partners/${slug}` : '/shops/partners';
}

function getPartnerShopBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  return PARTNER_AD_ITEMS.find((item) => getPartnerShopSlug(item) === normalized) || null;
}

function getPartnerShopRoute(pathname = typeof window !== 'undefined' ? window.location.pathname : '/shops/partners') {
  const path = normalizeSitePath(pathname);
  if (!path.startsWith('/shops/partners/')) return { shop: null, slug: '' };
  const slug = decodeURIComponent(path.slice('/shops/partners/'.length)).toLowerCase();
  return { shop: getPartnerShopBySlug(slug), slug };
}

function getActivePartnerShopNews() {
  return PARTNER_SHOP_NEWS
    .filter((item) => item.status !== 'hidden')
    .sort((a, b) => {
      const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
      if (priorityDiff) return priorityDiff;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
}

function getHomeNewsLinks() {
  const krTopic = OFFICIAL_TOPIC_ITEMS.find((item) => (item.locale || '').toUpperCase() === 'KR');
  const jpTopic = OFFICIAL_TOPIC_ITEMS.find((item) => (item.locale || '').toUpperCase() === 'JP');
  const preorderLink = NEWS_LINK_GROUPS.find((item) => item.id === 'preorder')?.links?.[0];
  return HOME_NEWS_LINKS.map((item) => {
    if (item.query === 'section=preorder' && preorderLink?.label) {
      return { ...item, label: preorderLink.label, description: 'Amazon Japan 응모 바로가기' };
    }
    if (item.query === 'section=notice&locale=JP' && krTopic?.title) {
      return {
        ...item,
        label: '한글판 새소식',
        description: krTopic.title,
        query: 'section=notice&locale=KR'
      };
    }
    if (item.query === 'section=notice&locale=JP' && jpTopic?.title) {
      return { ...item, description: jpTopic.title };
    }
    return item;
  });
}
const GUIDE_QA_GROUPS = [
  {
    id: 'start',
    kind: 'guide',
    title: '처음 이용 가이드',
    items: [
      {
        question: 'Card Pone는 어떤 사이트인가요?',
        answer: 'Card Pone는 원피스 카드게임 유저를 위한 비공식 카드 도감, 시세 확인, 구매처 검색, 컬렉션 관리 서비스입니다. 한글판과 일본판 카드를 검색하고 보유 카드, 위시리스트, Portfolio를 한 곳에서 관리할 수 있습니다.'
      },
      {
        question: '일련번호 검색과 카드명 검색은 어떻게 다른가요?',
        answer: '일련번호 검색은 OP05-119, ST21-014처럼 카드 번호를 기준으로 찾는 방식이고, 카드명 검색은 캐릭터명이나 카드명으로 관련 카드를 찾는 방식입니다. 자세한 도감 사용법은 /guide/card-catalog에서 확인할 수 있습니다.'
      }
    ]
  },
  {
    id: 'catalog',
    kind: 'guide',
    title: '카드 도감 가이드',
    items: [
      {
        question: 'OP, EB, ST, PR은 무엇인가요?',
        answer: 'OP는 정규 부스터, EB는 엑스트라 부스터, ST는 스타터덱, PR은 프로모 계열입니다. 시리즈와 도감 검색 구조는 /guide/card-catalog에서 더 자세히 정리했습니다.'
      },
      {
        question: '보유중과 위시리스트는 어떻게 사용하나요?',
        answer: '카드 도감에서 카드 하단의 X/O 버튼을 누르면 보유 상태를 바꿀 수 있고, 하트 버튼을 누르면 위시리스트에 추가하거나 해제할 수 있습니다. 로그인한 계정 기준으로 저장되며, 필터에서 보유중 또는 위시리스트만 따로 볼 수 있습니다.'
      }
    ]
  },
  {
    id: 'market',
    kind: 'guide',
    title: '시세 가이드',
    items: [
      {
        question: '시세 탭은 어떻게 사용하나요?',
        answer: '시세 탭에서는 일련번호나 카드명을 검색해 후보를 선택하고 상세 시세를 확인합니다. A등급, PSA10, 거래 기록, 그래프 설명은 /guide/card-price에서 확인할 수 있습니다.'
      },
      {
        question: '시세 정보는 어떻게 봐야 하나요?',
        answer: '시세 정보는 외부 거래 데이터와 현재 매물 정보를 바탕으로 한 참고 지표입니다. 실제 구매 전에는 원문 페이지, 배송비, 관세, 카드 상태를 함께 확인해야 하며 자세한 내용은 /guide/card-price에 정리했습니다.'
      }
    ]
  },
  {
    id: 'portfolio',
    kind: 'guide',
    title: 'Portfolio 가이드',
    items: [
      {
        question: 'Portfolio 금액은 어떻게 계산되나요?',
        answer: 'Portfolio는 사용자가 시세 페이지에서 A등급 또는 PSA10으로 추가한 카드의 가격을 기준으로 합산됩니다. 시세 데이터가 없는 카드는 금액 계산에서 제외될 수 있으며, 가격은 참고용입니다.'
      },
      {
        question: 'Portfolio에 추가한 카드는 어디서 확인하나요?',
        answer: '메인 화면의 Portfolio 카드에서 A 또는 PSA10을 누르면 해당 등급으로 추가한 카드 목록을 확인할 수 있습니다. 목록 안의 X 버튼으로 Portfolio에서 제거할 수 있습니다.'
      }
    ]
  },
  {
    id: 'buying',
    kind: 'guide',
    title: '구매/예약 가이드',
    items: [
      {
        question: '공인점포와 취급점포는 무엇이 다른가요?',
        answer: '공인점포와 취급점포는 공식 홈페이지 기준의 매장 구분입니다. 지역별 검색, 내 주변순 정렬, 지도 바로가기는 /guide/shops에서 확인할 수 있습니다.'
      }
    ]
  },
  {
    id: 'collecting-direction',
    kind: 'guide',
    title: '수집 방향 - 언어판',
    items: [
      {
        question: '일본판, 한글판, 영문판은 어떤 기준으로 고르면 좋나요?',
        answer: '일본판은 발매와 거래 흐름이 빠르고 원피스 카드게임 시장의 기준점처럼 보는 유저가 많습니다. 한글판은 국내 접근성이 좋고 상대적으로 부담이 낮아 입문과 플레이 병행에 적합합니다. 영문판은 글로벌 수요가 강하고 가격대가 높은 카드가 많지만 국내 구매 접근성은 낮을 수 있습니다.'
      },
      {
        question: '가치와 가격 흐름을 보고 싶다면 어떤 언어판이 좋나요?',
        answer: '시세 흐름을 적극적으로 보고 싶다면 거래량과 정보가 많은 일본판을 먼저 확인하는 것이 좋습니다. 영문판은 글로벌 수요가 강한 카드에서 가격이 크게 형성될 수 있고, 한글판은 국내에서 구하기 쉬워 가성비와 실사용 접근성이 좋습니다.'
      },
      {
        question: '한글판의 장점은 무엇인가요?',
        answer: '한글판은 국내 매장과 커뮤니티에서 접근하기 쉽고, 일본판이나 영문판보다 부담 없는 가격으로 시작할 수 있는 경우가 많습니다. 일본판 발매 흐름을 참고해 앞으로 관심받을 카드나 캐릭터를 미리 살펴볼 수 있다는 점도 장점입니다.'
      }
    ]
  },
  {
    id: 'collecting-style',
    kind: 'guide',
    title: '수집 방향 - 테마',
    items: [
      {
        question: '처음 수집할 때 어떤 방향을 잡으면 좋나요?',
        answer: '처음에는 최애 캐릭터 중심, 좋아하는 해적단 중심, 특정 시리즈 완성, 패러렐·프로모 중심처럼 기준을 하나 정하는 것이 좋습니다. 기준 없이 고가 카드만 따라가면 예산이 빠르게 커지고 컬렉션 방향이 흐려질 수 있습니다.'
      },
      {
        question: '캐릭터 중심 수집은 어떤 방식인가요?',
        answer: '루피, 조로, 나미, 야마토처럼 좋아하는 캐릭터를 정하고 해당 캐릭터의 일반판, 패러렐, 프로모, 스페셜 카드를 모으는 방식입니다. 카드 수가 늘어도 기준이 명확해 컬렉션을 정리하기 쉽습니다.'
      },
      {
        question: '레어도 중심 수집은 어떤 방식인가요?',
        answer: '패러렐, 리더 패러렐, 코믹 패러렐, SP, 프로모, 대회 배포 카드처럼 희소성이 높은 카드 위주로 모으는 방식입니다. 만족도와 가치 변동 폭이 크지만, 예산과 카드 상태 확인이 중요합니다.'
      }
    ]
  },
  {
    id: 'box-purchase-guide',
    kind: 'guide',
    title: '구매 가이드 - 박스/카톤',
    items: [
      {
        question: '박스, 팩, 카톤은 어떤 단위인가요?',
        answer: '일반적인 부스터 기준으로 1카톤은 12박스, 1박스는 24팩, 1팩은 카드 6장 구성으로 보는 경우가 많습니다. 상품과 국가별 구성은 달라질 수 있으므로 구매 전 판매 페이지의 구성 정보를 확인하는 것이 안전합니다.'
      },
      {
        question: '개인 거래 박스를 살 때 무엇을 조심해야 하나요?',
        answer: '개인 거래에서는 미개봉 여부, 박스 상태, 판매 이력, 가격이 지나치게 낮은 이유를 확인해야 합니다. 특히 카톤에서 고레어 카드를 이미 뽑은 뒤 남은 박스를 판매하는 경우가 있을 수 있어 출처가 불명확한 박스는 신중하게 접근하는 것이 좋습니다.'
      }
    ]
  },
  {
    id: 'grading-guide',
    kind: 'guide',
    title: '보관/그레이딩 가이드',
    items: [
      {
        question: '그레이딩 완료 카드는 어떤 장점이 있나요?',
        answer: 'PSA, BGS 같은 감정사를 거친 카드는 등급이 명확해 상태 확인과 거래가 비교적 쉽습니다. 다만 같은 카드라도 감정 등급, 케이스 상태, 감정사 선호도에 따라 가격 차이가 생길 수 있습니다.'
      },
      {
        question: 'raw 카드를 직접 감정 보내는 방식은 어떤가요?',
        answer: '상태 좋은 카드를 골라 직접 감정 보내는 방식은 수집의 재미가 크지만 난이도도 높습니다. 표면 흠집, 모서리, 센터링, 인쇄 상태를 직접 판단해야 하고, 감정 비용과 대기 기간, 기대 등급보다 낮게 나올 리스크도 고려해야 합니다.'
      },
      {
        question: '가볍게 수집하려면 어떤 보관 방식이 좋나요?',
        answer: '순수 취미 목적이라면 슬리브와 바인더 중심으로 시작하는 방식이 부담이 적습니다. 고가 카드만 별도로 탑로더나 자석케이스에 보관하고, 일반 카드는 바인더에 테마별로 정리하면 관리가 쉽습니다.'
      }
    ]
  },
  {
    id: 'intro-qa',
    kind: 'qa',
    title: '입문 Q&A',
    items: [
      {
        question: '원피스 카드게임은 어떤 카드게임인가요?',
        answer: '원피스 카드게임은 ONE PIECE 작품의 캐릭터와 세계관을 바탕으로 한 1대1 대전형 트레이딩 카드게임입니다. 리더 카드 1장, 메인 덱, DON!! 카드를 사용해 상대 리더의 라이프를 줄이고 승리하는 방식으로 진행됩니다.'
      },
      {
        question: '처음 시작하려면 무엇을 사면 좋나요?',
        answer: '처음 플레이 목적이라면 스타터덱이 가장 접근하기 쉽습니다. 스타터덱은 바로 게임을 시작할 수 있는 구성으로 판매되며, 부스터팩은 덱 강화나 수집을 위해 추가 카드가 필요할 때 구매하는 상품입니다.'
      },
      {
        question: '부스터팩과 스타터덱은 무엇이 다른가요?',
        answer: '스타터덱은 정해진 카드 구성으로 시작용 덱을 제공하는 상품이고, 부스터팩은 무작위 카드가 들어 있는 확장팩입니다. 부스터팩은 원하는 카드를 확정으로 얻는 상품이 아니므로 수집과 덱 강화 목적에 맞춰 구매하는 것이 좋습니다.'
      }
    ]
  },
  {
    id: 'rarity-qa',
    kind: 'qa',
    title: '카드 등급 Q&A',
    items: [
      {
        question: 'C, UC, R, SR, SEC는 무엇인가요?',
        answer: 'C는 커먼, UC는 언커먼, R은 레어, SR은 슈퍼 레어, SEC는 시크릿 레어를 의미합니다. 일반적으로 오른쪽으로 갈수록 부스터팩에서 보기 어려운 등급으로 취급됩니다.'
      },
      {
        question: 'L 카드는 무엇인가요?',
        answer: 'L은 리더 카드를 의미합니다. 리더 카드는 게임 시작 시 별도로 놓고 사용하는 카드이며, 리더의 색상과 특성이 덱 구성과 플레이 방식에 영향을 줍니다.'
      },
      {
        question: 'SP 카드는 무엇인가요?',
        answer: 'SP는 일반적인 기본 등급이라기보다 특별 일러스트나 특별 사양으로 구분되는 카드에 붙는 표기입니다. 같은 캐릭터라도 일반 카드와 SP 카드는 수집 가치와 거래 가격이 다를 수 있습니다.'
      }
    ]
  },
  {
    id: 'series-qa',
    kind: 'qa',
    title: '시리즈 Q&A',
    items: [
      {
        question: 'OP, EB, ST, PR은 무엇을 뜻하나요?',
        answer: 'OP는 정규 부스터팩, EB는 엑스트라 부스터, ST는 스타터덱, PR은 프로모 계열입니다. 일련번호와 시리즈 구분은 /guide/card-catalog에서 확인할 수 있습니다.'
      },
      {
        question: 'OP05-119 같은 일련번호는 어떻게 읽나요?',
        answer: 'OP05-119는 OP-05 계열의 119번 카드를 뜻합니다. 같은 일련번호에도 여러 버전이 있을 수 있으므로 자세한 구조는 /guide/card-catalog에서 확인할 수 있습니다.'
      },
      {
        question: '프로모 카드는 어디서 얻나요?',
        answer: '프로모 카드는 이벤트, 캠페인, 대회, 잡지 부록, 상품 동봉 등 일반 부스터팩과 다른 경로로 배포되는 카드입니다. 배포 방식과 기간에 따라 입수 난이도와 가격 차이가 커질 수 있습니다.'
      }
    ]
  },
  {
    id: 'language-qa',
    kind: 'qa',
    title: '언어판 Q&A',
    items: [
      {
        question: '한글판과 일본판은 무엇이 다른가요?',
        answer: '한글판과 일본판은 카드 텍스트 언어, 발매 일정, 상품 구성, 유통 환경이 다를 수 있습니다. 같은 캐릭터와 일러스트라도 언어판에 따라 수집 수요와 거래 가격이 달라질 수 있습니다.'
      },
      {
        question: '일본판 카드와 한글판 카드를 같은 카드로 봐도 되나요?',
        answer: '수집 관점에서는 같은 카드명과 일러스트라도 언어판을 별도 버전으로 구분하는 경우가 많습니다. 거래나 컬렉션 관리에서는 언어판, 일련번호, 이미지, 등급을 함께 확인하는 것이 좋습니다.'
      },
      {
        question: '일본판 카드 검색은 일본어만 가능한가요?',
        answer: '공식 카드명은 일본어 기준이지만, Card Pone에서는 가능한 범위에서 한글 카드명 검색도 함께 지원합니다. 다만 번역명과 표기 차이가 있을 수 있어 일련번호 검색이 가장 정확합니다.'
      }
    ]
  },
  {
    id: 'parallel-qa',
    kind: 'qa',
    title: '패러렐·프로모 Q&A',
    items: [
      {
        question: '패러렐 카드는 무엇인가요?',
        answer: '패러렐 카드는 같은 기본 카드와 별도의 일러스트나 사양으로 나온 변형 카드입니다. 효과나 카드명은 같거나 유사해도 일러스트와 희소성 때문에 수집 가치가 다르게 형성될 수 있습니다.'
      },
      {
        question: '리더 패러렐은 무엇인가요?',
        answer: '리더 패러렐은 리더 카드의 특별 일러스트 버전입니다. 리더 카드는 게임에서 항상 공개되는 핵심 카드라 수집 수요가 높고, 인기 캐릭터의 리더 패러렐은 가격 변동이 큰 편입니다.'
      },
      {
        question: '코믹 패러렐은 무엇인가요?',
        answer: '코믹 패러렐은 만화 원작 느낌을 강하게 살린 특별 일러스트 계열 카드로 불리는 수집용 명칭입니다. 모든 세트에 존재하는 것은 아니며, 일반 패러렐보다 더 높은 관심을 받는 경우가 많습니다.'
      }
    ]
  },
  {
    id: 'storage-qa',
    kind: 'qa',
    title: '보관·상태 Q&A',
    items: [
      {
        question: '카드 상태 A등급은 어떤 의미인가요?',
        answer: 'A등급은 일반적으로 눈에 띄는 큰 하자가 적은 양호한 상태를 뜻하는 거래상 표현입니다. 다만 플랫폼이나 판매자마다 기준이 다를 수 있으므로 모서리, 표면, 찍힘, 휘어짐, 인쇄 상태를 직접 확인해야 합니다.'
      },
      {
        question: '슬리브, 탑로더, 자석케이스는 언제 쓰나요?',
        answer: '슬리브는 기본 보호, 탑로더는 배송과 단기 보관, 자석케이스는 고가 카드 전시와 장기 보관에 많이 사용합니다. 자세한 보관 기준은 /guide/card-storage에 정리했습니다.'
      },
      {
        question: '카드 휘어짐을 줄이려면 어떻게 해야 하나요?',
        answer: '습도와 온도 변화, 직사광선, 압력을 피하는 것이 기본입니다. 장기 보관 방법과 용품별 차이는 /guide/card-storage에서 확인할 수 있습니다.'
      }
    ]
  },
  {
    id: 'price-qa',
    kind: 'qa',
    title: '시세·PSA Q&A',
    items: [
      {
        question: '카드 시세는 왜 계속 변하나요?',
        answer: '카드 시세는 캐릭터 인기, 대회 환경, 재록 여부, 신상품 발매, 매물 수, 카드 상태, 언어판 수요에 따라 변합니다. 특히 고가 카드와 한정 프로모 카드는 적은 거래량만으로도 가격이 크게 움직일 수 있습니다.'
      },
      {
        question: 'PSA10은 무엇인가요?',
        answer: 'PSA10은 PSA 감정에서 Gem Mint 10을 받은 최고 등급 상태를 뜻합니다. PSA10 시세와 일반 A등급 시세의 차이는 /guide/card-price에서 확인할 수 있습니다.'
      },
      {
        question: '시세 정보는 실제 거래가와 같나요?',
        answer: '시세 정보는 거래 판단을 돕는 참고 자료입니다. 실제 거래 가격은 판매처, 배송비, 관세, 환율, 카드 상태에 따라 달라질 수 있으며 자세한 확인 방법은 /guide/card-price에 정리했습니다.'
      }
    ]
  },
  {
    id: 'collector-qa',
    kind: 'qa',
    title: '수집 Q&A',
    items: [
      {
        question: '일본판, 한글판, 영문판 중 무엇을 모아야 하나요?',
        answer: '정답은 예산과 목적에 따라 다릅니다. 빠른 시세 흐름과 원조 시장을 보고 싶다면 일본판, 국내 접근성과 가성비를 중시하면 한글판, 글로벌 수요와 고가 카드를 보고 싶다면 영문판을 검토하는 방식이 좋습니다.'
      },
      {
        question: '처음 수집하면 박스보다 싱글 카드가 나은가요?',
        answer: '원하는 카드가 명확하다면 싱글 카드 구매가 예산 관리에 유리합니다. 박스 개봉은 재미가 크지만 원하는 카드를 확정으로 얻는 방식은 아니므로, 수집 목적과 개봉 재미 중 무엇을 우선할지 먼저 정하는 것이 좋습니다.'
      },
      {
        question: '카톤 구매가 항상 좋은 선택인가요?',
        answer: '카톤 구매는 개봉 경험과 봉입 기대치를 한 번에 가져갈 수 있지만 비용 부담이 큽니다. 수집 초반에는 필요한 싱글 카드와 소량 박스 구매로 방향을 잡은 뒤, 예산과 목적이 명확해졌을 때 카톤 구매를 검토하는 것이 안전합니다.'
      }
    ]
  },
  {
    id: 'box-qa',
    kind: 'qa',
    title: '박스·봉입률 Q&A',
    items: [
      {
        question: '1카톤, 1박스, 1팩은 각각 몇 개인가요?',
        answer: '일반적인 부스터 기준으로 1카톤은 12박스, 1박스는 24팩, 1팩은 카드 6장 구성으로 보는 경우가 많습니다. 다만 상품별 구성은 다를 수 있으므로 판매 페이지의 구성 정보를 함께 확인해야 합니다.'
      },
      {
        question: '봉입률은 어떻게 참고하면 되나요?',
        answer: '커뮤니티에서는 1카톤 기준 SP 계열, 리더 패러렐 계열, 시크릿 계열의 봉입 경향을 참고하는 경우가 많습니다. 하지만 망가 카드나 갓팩 같은 특수 요소는 확정이 아니며, 봉입률은 구매 판단의 참고 자료로만 보는 것이 좋습니다.'
      },
      {
        question: '서치 박스가 왜 위험한가요?',
        answer: '서치 박스는 이미 고레어 카드가 나온 뒤 남은 박스일 가능성이 있는 상품을 뜻하는 커뮤니티 표현입니다. 이런 박스는 기대값이 낮을 수 있어, 출처가 불명확하거나 가격이 과하게 저렴한 미개봉 박스는 신중하게 확인해야 합니다.'
      }
    ]
  }
];
const NEWS_GUIDE_CONTENT = {
  preorder: {
    title: '아마존 히로인즈2 응모 안내',
    description: '',
    sections: [
      {
        title: '이용 방법',
        type: 'steps',
        items: [
          '일본 아마존 계정으로 로그인합니다.',
          '히로인즈2 상품 페이지에 접속합니다.',
          '상품 페이지에서 Request Invite 버튼을 누릅니다.',
          '신청이 완료되면 등록된 이메일로 결과를 기다립니다.',
          '구매 초대에 선정되면 이메일로 안내가 도착합니다.',
          '이메일 안의 링크를 통해 제한 시간 안에 결제하면 됩니다.'
        ]
      },
      {
        title: '꼭 알아둘 점',
        highlight: 'Request Invite는 구매 확정이 아닙니다.',
        items: [
          '버튼을 눌렀다고 바로 결제되거나 주문이 완료되는 것은 아닙니다.',
          '아마존에서 구매 초대 이메일을 받아야 실제 구매가 가능합니다.',
          '구매 초대 이메일은 일정 시간 안에 사용해야 할 수 있으므로 이메일함과 스팸함을 함께 확인하는 것이 좋습니다.',
          '상품 가격, 배송 가능 여부, 배송비, 관세는 시점에 따라 달라질 수 있으니 결제 전 최종 화면을 확인해야 합니다.'
        ]
      }
    ]
  }
};
const COUPANG_DISCLOSURE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
const OFFICIAL_LINK_ITEMS = [
  { labelKr: '공식카페', labelEn: 'Official Cafe', href: 'https://cafe.naver.com/onepiecetcg', external: true, locales: ['KR', 'EN'] },
  { labelKr: '공식사이트 KR', labelEn: 'Official KR', href: 'https://onepiece-cardgame.kr/', external: true, locales: ['KR', 'EN'] },
  { labelKr: '공식사이트 JP', labelEn: 'Official JP', href: 'https://www.onepiece-cardgame.com/', external: true, locales: ['KR', 'EN'] },
  { labelKr: 'Instagram', labelEn: 'Instagram', href: 'https://www.instagram.com/onepiece_tcg_kr/', external: true, locales: ['KR', 'EN'] },
  { labelJp: '公式サイト', href: 'https://www.onepiece-cardgame.com/', external: true, locales: ['JP'] },
  { labelJp: '公式ショップ', href: 'https://bandainamco-am.co.jp/official_shop/onepiece-cardgame/index.html', external: true, locales: ['JP'] },
  { labelJp: '公認店を探す', href: 'https://www.carddass.com/onepiece-tcg/shoplist/', external: true, locales: ['JP'] }
];

const JP_OFFICIAL_SHOP_SOURCE_URL = 'https://bandainamco-am.co.jp/official_shop/onepiece-cardgame/index.html';
const JP_CERTIFIED_SHOP_SOURCE_URL = 'https://www.carddass.com/onepiece-tcg/shoplist/';
const JP_EVENT_SOURCE_URL = 'https://www.onepiece-cardgame.com/events/index.php';
const JP_OFFICIAL_SHOPS = [
  ['北海道', '札幌店', '北海道札幌市中央区北4条西2-1 東急百貨店札幌店 9階', '10:00〜20:00'],
  ['宮城県', '宮城名取店', '宮城県名取市杜せきのした5-3-1 イオンモール名取 3階', '10:00〜21:00'],
  ['宮城県', '仙台店', '宮城県仙台市青葉区中央1-2-3 仙台PARCO1 7F', '10:00〜20:00'],
  ['埼玉県', '埼玉越谷店', '埼玉県越谷市レイクタウン3-1-1 イオンレイクタウンmori 3F', '10:00〜21:00'],
  ['東京都', '東京池袋店', '東京都豊島区東池袋3-1-3 サンシャインシティ ワールドインポートマートビル3F', '10:00〜21:00'],
  ['東京都', '東京新宿店', '東京都新宿区歌舞伎町1-29-1 東急歌舞伎町タワー3F', '月〜木 11:00〜23:00 / 金〜日 11:00〜25:00'],
  ['東京都', '東京渋谷店', '東京都渋谷区神南1-23-10 MAGNET by SHIBUYA109 B1F', '10:00〜21:00'],
  ['神奈川県', '横浜店', '神奈川県横浜市中区新港2-2-1 横浜ワールドポーターズ2階', '10:30〜21:00'],
  ['富山県', '富山高岡店', '富山県高岡市下伏間江383番地 イオンモール高岡 西館2F', '10:00〜21:00'],
  ['愛知県', '愛知名古屋店', '愛知県名古屋市西区二方町40番 mozo ワンダーシティ 4F', '10:00〜21:00'],
  ['愛知県', '愛知大高店', '愛知県名古屋市緑区南大高2-450 イオンモール大高3F', '10:00〜21:00'],
  ['岐阜県', '岐阜店', '岐阜県各務原市那加萱場町3-8 イオンモール各務原インター店 2F', '9:00〜21:00'],
  ['京都府', '京都店', '京都府京都市南区西九条鳥居口町1 イオンモールKYOTO 4F', '10:00〜21:00'],
  ['大阪府', '大阪梅田店', '大阪府大阪市北区角田町5-15 HEP FIVE 8階', '11:00〜21:00'],
  ['大阪府', '大阪心斎橋店', '大阪府大阪市中央区心斎橋筋1-8-3 心斎橋PARCO 5F', '10:00〜20:00'],
  ['広島県', '広島店', '広島県安芸郡府中町大須2-1-1 イオンモール広島府中 3F', '10:00〜21:00'],
  ['愛媛県', '愛媛店', '愛媛県伊予郡松前町筒井850 エミフルMASAKI 別棟 2F', '10:00〜21:00'],
  ['福岡県', '博多店', '福岡県福岡市博多区住吉1-2-74 キャナルシティ博多 サウスビルB1', '10:00〜21:00'],
  ['熊本県', '熊本店', '熊本県菊池郡菊陽町光の森7-39-1 ゆめタウン光の森 南館3F', '10:00〜20:30'],
  ['沖縄県', '沖縄店', '沖縄県那覇市おもろまち4-4-9 サンエー那覇メインプレイス 2F', '9:00〜22:00']
].map(([prefecture, name, address, hours]) => ({
  prefecture,
  name: `ONE PIECEカードゲーム 公式ショップ ${name}`,
  address,
  hours
}));

function getBaseSeriesId(seriesOrId) {
  if (typeof seriesOrId === 'object' && seriesOrId) return seriesOrId.baseSeriesId ?? seriesOrId.id ?? '';
  return String(seriesOrId ?? '').replace(/^(KR|JP|EN)-/, '');
}

function normalizeSeriesSlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getSeriesSlug(series) {
  return normalizeSeriesSlug(getBaseSeriesId(series) || series?.officialSeriesKeyword || series?.id);
}

function getSeriesRoutePath(series) {
  const slug = getSeriesSlug(series);
  if (!slug) return '/cards';
  const hasLocaleCollision = seriesData.filter((item) => getSeriesSlug(item) === slug).length > 1;
  return hasLocaleCollision
    ? `/cards/series/${normalizeSeriesSlug(series?.id)}`
    : `/cards/${slug}`;
}

function getSeriesGuideRoutePath(series) {
  const slug = normalizeSeriesSlug(series?.id || getBaseSeriesId(series));
  return slug ? `/guides/series/${slug}` : '/cards';
}

function findSeriesByRouteSlug(slug, preferredLocale = 'JP') {
  const normalized = normalizeSeriesSlug(slug);
  if (!normalized) return null;
  const matches = seriesData.filter((item) => {
    const id = normalizeSeriesSlug(item.id);
    const baseId = normalizeSeriesSlug(item.baseSeriesId);
    const official = normalizeSeriesSlug(item.officialSeriesKeyword);
    return id === normalized || baseId === normalized || official === normalized;
  });
  return matches.find((item) => (item.locale || 'JP') === preferredLocale) || matches[0] || null;
}

function getProgressSeriesGroup(series) {
  const baseId = String(series?.code || getBaseSeriesId(series)).replace(/^(KR|JP|EN)-/, '');
  if (/^OP\d+/.test(baseId)) return 'OP';
  if (/^(EB|PRB)\d+/.test(baseId)) return 'EB';
  if (/^ST\d+/.test(baseId)) return 'ST';
  if (baseId === 'PROMO' || /^P-?/.test(baseId)) return 'PR';
  return 'OP';
}

function getSeriesSectionId(series) {
  const group = getProgressSeriesGroup(series);
  if (group === 'EB') return 'extra';
  if (group === 'ST') return 'starter';
  if (group === 'PR') return 'promo';
  return 'regular';
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
  const present = [...new Set(cards.map((card) => getRarityBucket(card.rarity)).filter(Boolean))];
  return [...RARITY_ORDER.filter((rarity) => present.includes(rarity)), ...present.filter((rarity) => !RARITY_ORDER.includes(rarity)).sort()];
}

function groupByRarity(cards) {
  return getOrderedRarities(cards).map((rarity) => ({
    rarity,
    cards: cards.filter((card) => getRarityBucket(card.rarity) === rarity)
  })).filter((group) => group.cards.length);
}

function getRarityBucket(rarity = '') {
  const value = String(rarity || '').trim().toUpperCase();
  if (value === 'SPカード' || value === 'SP P' || value === 'SP-P') return 'SP';
  return value;
}

function getCardImageSrc(card) {
  const source = card?.imageUrl || card?.image_url || card?.image || '';
  if (!source) return '/card-placeholder.svg';
  return source;
}

function getCardThumbnailKey(card) {
  if (!card?.id || !card?.locale) return '';
  return `cards/${card.locale}/${String(card.id).replace(/^[A-Z]+::/, '')}.webp`;
}

function getCardThumbnailSrc(card) {
  if (card?.isSimulatorOnly) return getCardImageSrc(card);
  const key = getCardThumbnailKey(card);
  if (CARD_THUMBNAIL_BASE_URL === '/api/card-thumb' && key) {
    return resolveApiUrl(`/api/card-thumb?key=${encodeURIComponent(key)}`);
  }
  return CARD_THUMBNAIL_BASE_URL && key
    ? `${CARD_THUMBNAIL_BASE_URL}/${key}`
    : getCardImageSrc(card);
}

function getCardThumbnailProxySrc(card) {
  return '';
}

function placeholderImage(event) {
  const image = event.currentTarget;
  if (image.dataset.placeholderApplied === '1') return;
  image.dataset.placeholderApplied = '1';
  image.src = '/card-placeholder.svg';
}

function getSeriesBoxCode(series) {
  const baseId = getBaseSeriesId(series);
  const match = String(baseId || '').match(/^([A-Z]+)(\d+)$/);
  return match ? `${match[1]}-${match[2]}` : baseId;
}

function getSeriesBoxPreviewUrl(series, boxImageByCode) {
  const boxCode = getSeriesBoxCode(series);
  if (!boxCode || boxCode === 'PROMO') return '';
  return boxImageByCode?.get(boxCode)
    || boxImageByCode?.get(`OPC-TCG-${boxCode}`)
    || boxMarketItems.find((item) => item.code === boxCode)?.previewImageUrl
    || '';
}

function RenewSeriesOptionContent({ series, boxImageByCode }) {
  const previewUrl = getSeriesBoxPreviewUrl(series, boxImageByCode);
  return (
    <>
      <span className="renew-series-thumb" aria-hidden="true">
        {previewUrl ? (
          <img src={previewUrl} alt="" loading="lazy" onError={placeholderImage} />
        ) : (
          <span className="renew-series-thumb-label">{getBaseSeriesId(series).slice(0, 2) || 'PR'}</span>
        )}
      </span>
      <b>{getBaseSeriesId(series)}</b>
      <span>{series.koName}</span>
      <small>{series.kindEn || series.enName}</small>
    </>
  );
}

function fallbackToOriginalCardImage(event) {
  const image = event.currentTarget;
  const proxyFallbackSrc = image.dataset.proxyFallbackSrc;
  if (proxyFallbackSrc && image.dataset.proxyFallbackAttempted !== '1') {
    image.dataset.proxyFallbackAttempted = '1';
    image.src = proxyFallbackSrc;
    return;
  }
  const fallbackSrc = image.dataset.fallbackSrc;
  if (fallbackSrc && image.dataset.originalFallbackAttempted !== '1') {
    image.dataset.originalFallbackAttempted = '1';
    image.src = fallbackSrc;
    return;
  }
  placeholderImage(event);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressMarketplaceImage(file) {
  const source = await readFileAsDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source;
  });
  const maxSide = 1200;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve({ data: source.replace(/^data:[^;]+;base64,/, ''), mimeType: file.type || 'image/jpeg' });
        return;
      }
      const dataUrl = await readFileAsDataUrl(blob);
      resolve({ data: dataUrl.replace(/^data:[^;]+;base64,/, ''), mimeType: blob.type || 'image/webp' });
    }, 'image/webp', 0.82);
  });
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

let cardMarketLinksPromise = null;

async function fetchCardMarketLinkOverrides() {
  const response = await fetch('/api/card-market-link-overrides', { cache: 'no-store' });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.items) ? payload.items : [];
}

function mergeCardMarketLinks(baseLinks, overrideLinks) {
  const merged = new Map();
  const looseLinks = [];
  (baseLinks || []).forEach((link) => {
    if (link?.cardId) {
      const existing = merged.get(link.cardId);
      if (existing?.status === 'approved' && link.status !== 'approved') return;
      merged.set(link.cardId, link);
    }
    else if (link) looseLinks.push(link);
  });
  (overrideLinks || []).forEach((link) => {
    if (!link?.cardId) return;
    if (link.status === 'blocked') {
      merged.set(link.cardId, {
        ...merged.get(link.cardId),
        cardId: link.cardId,
        apparelId: 0,
        status: 'blocked',
        note: link.note || 'admin blocked mapping'
      });
      return;
    }
    if (!link?.apparelId) return;
    merged.set(link.cardId, {
      ...merged.get(link.cardId),
      cardId: link.cardId,
      apparelId: Number(link.apparelId),
      status: link.status || 'approved',
      note: link.note || 'admin override'
    });
  });
  return [...merged.values(), ...looseLinks];
}

function loadCardMarketLinks() {
  cardMarketLinksPromise ??= Promise.all([
    import('./data/card-market-links.js').then((module) => (Array.isArray(module.default) ? module.default : [])),
    fetchCardMarketLinkOverrides().catch(() => [])
  ])
    .then(([baseLinks, overrideLinks]) => mergeCardMarketLinks(baseLinks, overrideLinks))
    .catch(() => []);
  return cardMarketLinksPromise;
}

function invalidateCardMarketLinks() {
  cardMarketLinksPromise = null;
}

async function saveCardMarketLinkOverride({ cardId, apparelId, note }) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token || '';
  const response = await fetch('/api/card-market-link-overrides', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ cardId, apparelId, note })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  invalidateCardMarketLinks();
  return payload?.item || null;
}

async function blockCardMarketLinkOverride(cardId) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token || '';
  const response = await fetch('/api/card-market-link-overrides', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ cardId, apparelId: 0, status: 'blocked', note: 'admin blocked mapping' })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  invalidateCardMarketLinks();
  return payload;
}

async function findApprovedCardMarketLink(card) {
  if (!card) return null;
  const cardMarketLinks = await loadCardMarketLinks();
  const targetCardId = card.id || card.cardId;
  if (targetCardId && cardMarketLinks.some((link) => link.status === 'blocked' && link.cardId === targetCardId)) {
    return null;
  }
  return cardMarketLinks.find((link) => {
    if (link.status !== 'approved') return false;
    if (link.cardId) return link.cardId === targetCardId;
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

function formatYenWon(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '가격 정보 없음';
  return `${formatYen(amount)} / ${formatWonFromYen(amount)}`;
}

function formatUsd(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'US $ -';
  return `US $${Math.round(amount).toLocaleString('ko-KR')}`;
}

function formatWonFromUsd(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '₩0';
  return `₩${Math.round(amount * MARKET_USD_TO_KRW).toLocaleString('ko-KR')}`;
}

function formatCatalogWonFromUsd(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '-';
  const won = Math.round(amount * MARKET_USD_TO_KRW);
  if (won >= 100000000) {
    const eok = Math.floor(won / 100000000);
    const man = Math.floor((won % 100000000) / 10000);
    return man > 0 ? `₩${eok}억 ${man.toLocaleString('ko-KR')}만` : `₩${eok}억`;
  }
  if (won >= 10000) {
    const man = won / 10000;
    return `₩${man >= 100 ? Math.round(man).toLocaleString('ko-KR') : man.toFixed(1)}만`;
  }
  return `₩${won.toLocaleString('ko-KR')}`;
}

function formatUsdWonFromUsd(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '가격 정보 없음';
  return `${formatUsd(amount)} / ${formatWonFromUsd(amount)}`;
}

function formatUsdWonFromYen(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '가격 정보 없음';
  return formatUsdWonFromUsd(amount / MARKET_USD_TO_JPY);
}

function normalizePortfolioPriceJpy(item) {
  const raw = Number(item?.minPrice || item?.price || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const currency = String(item?.priceCurrency || item?.currency || '').toUpperCase();
  if (currency === 'USD') return Math.round(raw * MARKET_USD_TO_JPY);
  return raw;
}

function findPortfolioHolding(holdings, item, grade) {
  const apparelId = Number(item?.apparelId || 0);
  const condition = normalizeMarketConditionKey(grade);
  return (Array.isArray(holdings) ? holdings : []).find((holding) => (
    Number(holding?.apparelId || 0) === apparelId
    && normalizeMarketConditionKey(holding?.grade) === condition
  )) || null;
}

function getPortfolioQuantity(lots = []) {
  if (!lots.length) return 1;
  return lots.reduce((sum, lot) => sum + Math.max(1, Number(lot?.quantity || 1) || 1), 0);
}

function getPortfolioCostJpy(lots = []) {
  return lots.reduce((sum, lot) => {
    const unitPrice = Math.max(0, Number(lot?.unitPriceJpy || 0) || 0);
    const quantity = Math.max(1, Number(lot?.quantity || 1) || 1);
    return sum + unitPrice * quantity;
  }, 0);
}

function getPortfolioPricedQuantity(lots = []) {
  return lots.reduce((sum, lot) => {
    if (Number(lot?.unitPriceJpy || 0) <= 0) return sum;
    return sum + Math.max(1, Number(lot?.quantity || 1) || 1);
  }, 0);
}

function convertPortfolioUnitPriceToJpy(value, currency = 'KRW') {
  const amount = Math.max(0, Number(value || 0) || 0);
  if (!amount) return 0;
  if (currency === 'USD') return Math.round(amount * MARKET_USD_TO_JPY);
  if (currency === 'JPY') return Math.round(amount);
  return Math.round(amount / (MARKET_USD_TO_KRW / MARKET_USD_TO_JPY));
}

function formatSignedWonFromYen(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) return '₩0';
  const sign = amount > 0 ? '+' : '-';
  return `${sign}₩${Math.round(Math.abs(amount) * (MARKET_USD_TO_KRW / MARKET_USD_TO_JPY)).toLocaleString('ko-KR')}`;
}

function formatSignedYen(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) return '¥0';
  return `${amount > 0 ? '+' : '-'}¥${Math.round(Math.abs(amount)).toLocaleString('ja-JP')}`;
}

function formatSignedPortfolioPercent(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) return '0.00%';
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)}%`;
}

function getKstDateKey(value) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function findPortfolioEstimatePoint(detail, grade, purchaseDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(purchaseDate || ''))) return null;
  const targetTimestamp = Date.parse(`${purchaseDate}T00:00:00+09:00`);
  const conditionKey = normalizeMarketConditionKey(grade);
  const sources = [
    { bucket: getMarketConditionBucket(detail?.listingSeriesByCondition, conditionKey), source: 'listing' },
    { bucket: getMarketConditionBucket(detail?.series, conditionKey), source: 'trade' }
  ];
  for (const source of sources) {
    const points = [
      ...(Array.isArray(source.bucket?.['1y']) ? source.bucket['1y'] : []),
      ...(Array.isArray(source.bucket?.all) ? source.bucket.all : [])
    ];
    const candidates = aggregateMarketDailyChartPoints(points)
      .map((point) => ({ ...point, dateKey: getKstDateKey(Number(point?.timestamp || 0)) }))
      .filter((point) => point.dateKey && point.dateKey <= purchaseDate && Number(point.price || 0) > 0)
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    const match = candidates.find((point) => targetTimestamp - Date.parse(`${point.dateKey}T00:00:00+09:00`) <= 7 * 24 * 60 * 60 * 1000);
    if (match) return { ...match, referenceSource: source.source };
  }
  return null;
}

function formatPercent(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0%';
  return `${amount.toFixed(amount >= 10 ? 0 : 1)}%`;
}

function formatShortDateValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMarketDate(timestamp) {
  return formatShortDateValue(Number(timestamp || 0));
}

function formatMarketSaleDate(sale) {
  return formatShortDateValue(Number(sale?.timestamp || 0)) || formatShortDateValue(sale?.date || sale?.soldAt || '');
}

function normalizeMarketConditionKey(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!key || key === 'a' || key === 'single' || key === 'singlegrade' || key === 'raw') return 'a';
  if (key === 'psa10' || (key.includes('psa') && key.includes('10'))) return 'psa10';
  return key;
}

function resolvePortfolioGrade(key, item, gradeMap = {}) {
  const keyGrade = String(key || '').split('::').at(-1);
  return normalizeMarketConditionKey(gradeMap[key] || item?.grade || keyGrade || 'a');
}

function getMarketConditionBucket(source, conditionKey) {
  if (!source || typeof source !== 'object') return undefined;
  const normalizedKey = normalizeMarketConditionKey(conditionKey);
  if (source[normalizedKey]) return source[normalizedKey];
  for (const [key, value] of Object.entries(source)) {
    if (normalizeMarketConditionKey(key) === normalizedKey) return value;
  }
  return undefined;
}

function getMarketConditionOptions(conditions = [], t = (key) => key) {
  const source = Array.isArray(conditions) && conditions.length
    ? conditions
    : [{ key: 'a', label: t('aGrade') }, { key: 'psa10', label: 'PSA10' }];
  const seen = new Set();
  return source.reduce((items, item) => {
    const key = normalizeMarketConditionKey(item?.key || item?.label);
    if (!key || seen.has(key)) return items;
    seen.add(key);
    items.push({
      ...item,
      key,
      label: key === 'a' ? t('aGrade') : item?.label || key.toUpperCase()
    });
    return items;
  }, []);
}

const MARKET_DETAIL_RANGES = [
  { key: '7d', label: '7D' },
  { key: '1m', label: '1M' },
  { key: '1y', label: '1Y' }
];
const MARKET_DETAIL_RANGE_KEYS = new Set(MARKET_DETAIL_RANGES.map((item) => item.key));

function getMarketRangeChartPoints(conditionSeries = {}, range = '7d') {
  return conditionSeries?.[range] || (range === '1y' ? conditionSeries?.all : []) || [];
}

function medianMarketNumber(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function aggregateMarketDailyChartPoints(points = []) {
  const dayMs = 24 * 60 * 60 * 1000;
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const groups = new Map();
  for (const point of points || []) {
    if (point?.synthetic) continue;
    const timestamp = Number(point?.timestamp || 0);
    const price = Number(point?.price || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(price) || price <= 0) continue;
    const dayKey = Math.floor((timestamp + kstOffsetMs) / dayMs);
    const group = groups.get(dayKey) || [];
    group.push({ ...point, timestamp, price });
    groups.set(dayKey, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayKey, group]) => {
      const prices = group.map((point) => point.price);
      const dayStartUtc = dayKey * dayMs - kstOffsetMs;
      const sourceText = group.map((point) => point.source || '').join(' ').toLowerCase();
      return {
        ...group[group.length - 1],
        timestamp: dayStartUtc + 12 * 60 * 60 * 1000,
        price: medianMarketNumber(prices),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        count: group.length,
        source: sourceText.includes('snkrdunk') ? 'snkrdunk_daily_median' : group.length > 1 ? 'daily_median' : group[0].source
      };
    });
}

function compressMarketAllChartPoints(points = [], maxPoints = 96) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const sorted = points
    .filter((point) => Number(point?.timestamp || 0) > 0 && Number(point?.price || 0) > 0)
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  if (sorted.length <= maxPoints) return sorted;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const minTime = Number(first.timestamp || 0);
  const maxTime = Number(last.timestamp || 0);
  const timeRange = Math.max(maxTime - minTime, 1);
  const bucketCount = Math.max(1, maxPoints - 2);
  const buckets = Array.from({ length: bucketCount }, () => []);

  for (const point of sorted.slice(1, -1)) {
    const ratio = Math.min(0.999999, Math.max(0, (Number(point.timestamp || 0) - minTime) / timeRange));
    buckets[Math.floor(ratio * bucketCount)].push(point);
  }

  const compressed = [first];
  for (const bucket of buckets) {
    if (!bucket.length) continue;
    const prices = bucket.map((point) => Number(point.price || 0)).filter((price) => price > 0);
    if (!prices.length) continue;
    const timestamps = bucket.map((point) => Number(point.timestamp || 0)).filter((timestamp) => timestamp > 0).sort((a, b) => a - b);
    const middleTimestamp = timestamps[Math.floor(timestamps.length / 2)] || Number(bucket[bucket.length - 1]?.timestamp || 0);
    compressed.push({
      ...bucket[bucket.length - 1],
      timestamp: middleTimestamp,
      price: medianMarketNumber(prices),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      count: bucket.reduce((sum, point) => sum + Number(point.count || 1), 0),
      source: 'all_range_bucket_median'
    });
  }
  if (compressed[compressed.length - 1]?.timestamp !== last.timestamp) compressed.push(last);
  return compressed.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

function formatChartAxisDate(timestamp) {
  const date = new Date(Number(timestamp || 0));
  if (Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
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
  if (!summary && apparelId) params.set('cacheMinute', String(Math.floor(Date.now() / 60000)));
  const response = await fetch(`/api/market?${params.toString()}`);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  return payload;
}

async function fetchPsa10MarketPrice(cardId) {
  if (!cardId) return null;
  const params = new URLSearchParams({ cardId });
  const response = await fetch(`/api/psa10-market?${params.toString()}`);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) return null;
  return payload;
}

function mergePsa10MarketDetail(detail, psaDetail) {
  if (!detail || !psaDetail) return detail;
  const baseConditions = Array.isArray(detail.conditions) && detail.conditions.length
    ? detail.conditions
    : [{ key: 'a', label: 'Single' }, { key: 'psa10', label: 'PSA10' }];
  const conditions = baseConditions.some((item) => item.key === 'psa10')
    ? baseConditions
    : [...baseConditions, { key: 'psa10', label: 'PSA10' }];
  const getTime = (record) => Number(record?.timestamp || 0) || Date.parse(record?.date || record?.soldAt || '') || 0;
  const pickLatest = (base, extra) => {
    if (!base) return extra || null;
    if (!extra) return base;
    return getTime(extra) > getTime(base) ? extra : base;
  };
  const hasPsaSupplement = Boolean(psaDetail.latestByCondition?.psa10);
  if (!hasPsaSupplement) return detail;
  return {
    ...detail,
    conditions,
    latestByCondition: {
      ...(detail.latestByCondition || {}),
      psa10: pickLatest(detail.latestByCondition?.psa10, psaDetail.latestByCondition?.psa10)
    }
  };
}

async function searchPortfolioCalculatorCards(query) {
  const cards = await searchCards(query, 'JP');
  return (Array.isArray(cards) ? cards : []).map((card) => ({
    ...card,
    thumbnailUrl: getCardThumbnailSrc(card),
    thumbnailProxyUrl: getCardThumbnailProxySrc(card),
    thumbnailOriginalUrl: getCardImageSrc(card)
  }));
}

async function loadPortfolioCalculatorQuote(card) {
  const link = await findApprovedCardMarketLink(card);
  if (!link?.apparelId) return null;
  const detail = await fetchMarketPrice({
    code: card.marketCode || card.cardNo,
    apparelId: link.apparelId
  });
  const psaDetail = await fetchPsa10MarketPrice(card.id).catch(() => null);
  const merged = mergePsa10MarketDetail(detail, psaDetail);
  return {
    apparelId: Number(link.apparelId),
    detail: merged,
    prices: {
      a: Number(getMarketConditionBucket(merged?.latestByCondition, 'a')?.price || 0),
      psa10: Number(getMarketConditionBucket(merged?.latestByCondition, 'psa10')?.price || 0)
    },
    sourceUrl: detail?.sourceUrl || ''
  };
}

function getMarketSaleSourceLabel(sale, fallback = '') {
  const sourceText = String(`${sale?.platform || ''} ${sale?.source || ''} ${sale?.sourceUrl || ''}`).toLowerCase();
  if (sourceText.includes('snkrdunk')) return 'SNKR';
  if (sourceText.includes('fanatics')) return 'Fanatics';
  if (sourceText.includes('ebay')) return 'eBay';
  if (sourceText.includes('psa')) return 'PSA';
  return sale?.platform || fallback || sale?.condition || '';
}

const NAV_ITEMS = [
  { id: 'cards', labelKey: 'navCards' },
  { id: 'prices', labelKey: 'navPrices' },
  ...(MARKETPLACE_TAB_VISIBLE ? [{ id: 'marketplace', labelKey: 'navMarketplace' }] : []),
  { id: 'news', labelKey: 'navNews' },
  { id: 'lab', labelKey: 'navLab' },
  { id: 'shops', labelKey: 'navShops' }
];
const VISIBLE_RENEW_HOME_UPDATES = RENEW_HOME_UPDATES.filter((item) => MARKETPLACE_ENABLED || item.id !== '2026-06-19-marketplace');
const UI_TEXT = {
  KR: {
    navCards: '도감',
    navPrices: '시세',
    navMarketplace: '거래',
    navCommunity: '커뮤니티',
    navLab: '실험실',
    navCalendar: '일정',
    navNews: '정보',
    navShops: '구매처',
    login: '로그인',
    logout: '로그아웃',
    cardSupplies: '카드용품',
    searchKr: '한글판',
    searchJp: '일본판',
    searchPlaceholder: '카드명 또는 일련번호 검색',
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
    openSnkrdunk: '스니덩크 바로가기',
    loginRequired: '로그인 후 이용해 주세요.',
    marketCodePlaceholder: '일련번호 검색 예: OP05-119',
    marketSearch: '시세 검색',
    marketLoading: '시세 후보를 찾는 중...',
    marketNoCandidates: '매핑된 시세 후보가 없습니다.',
    marketFallback: '정확한 시세 매핑을 찾지 못해 일련번호 검색으로 표시합니다.',
    marketDetailError: '시세 상세 정보를 불러오지 못했습니다.',
    variantSelect: '등급 / 버전 선택',
    sourceMarket: '스니덩 원문 보기',
    sourceMarketShort: '스니덩 보기',
    sourcePsa: 'PSA 원문 보기',
    sourcePsaShort: 'PSA 보기',
    snkrShortcut: '바로가기',
    addAGrade: 'Single등급 추가',
    addAGradeShort: 'Single등급 추가',
    addPsa10: 'PSA10등급 추가',
    addPsa10Short: 'PSA10 추가',
    aGrade: 'Single',
    addedToPortfolio: '컬렉션 가치에 추가했습니다.',
    noChart: '그래프 데이터가 없습니다.',
    recentSales: '최근 가격 기록',
    noRecentSales: '가격 기록이 아직 없습니다.',
    boxMarketTitle: '박스 시세',
    boxMarketHelp: 'SNKRDUNK 기준 인기 박스 가격',
    boxSortLatest: '최신순',
    boxSortHigh: '가격 높은순',
    boxSortLow: '가격 낮은순',
    marketHomeBoxTab: '박스',
    marketHomeCardTab: '카드',
    marketCardTitle: '카드 시세',
    marketCardHelp: 'SNKRDUNK 기준 주목 카드 가격',
    marketCardSortFocus: '인기순',
    marketCardSortHigh: '가격 높은순',
    marketCandidateSelect: '선택하기',
    selectedVariant: '선택한 버전',
    reselectVariant: '다시 선택',
    snkrLowestPrice: 'SNKRDUNK 최근 시세',
    psa10IntegratedPrice: 'PSA10 통합 시세',
    checkPrice: '가격 확인',
    deckSearchPlaceholder: '덱에 넣을 카드 검색',
    currentDeck: '현재 덱',
    deckComingSoonTitle: '덱 시뮬레이터 준비중',
    deckComingSoonBody: '덱 저장과 공유 흐름을 안정화한 뒤 다시 열겠습니다.',
    newsComingSoonTitle: '뉴스 준비중',
    newsComingSoonBody: '공식 소식과 업데이트를 보기 좋게 정리한 뒤 열겠습니다.',
    close: '닫기',
    allShops: '전체 매장',
    officialShop: '공인점포',
    searchShop: '취급점포',
    partnerShop: '카드숍',
    allRegions: '전체 지역',
    allDistricts: '전체 시군구',
    shopSearchPlaceholder: '매장명 또는 주소 검색',
    naverMap: '네이버지도',
    kakaoMap: '카카오맵',
    progress: '수집 진행도',
    updateNotice: '업데이트 공지',
    updateTitle: 'OP-16 업데이트 완료',
    updateHelp: '클릭하면 이전 공지까지 확인할 수 있습니다.',
    visitorsTotal: '누적 고유 방문자',
    visitorsToday: '오늘 고유 방문자',
    visitorsOnline: '현재 접속 중',
    usersTotal: '전체 회원 수',
    signupsToday: '오늘 가입자',
    footerIntro: 'Card Pone는 원피스 카드게임 유저를 위한 비공식 카드 도감·시세·컬렉션 관리 서비스입니다.',
    footerDisclaimer: 'BANDAI 및 공식 유통사와 제휴되어 있지 않으며, 시세 정보는 참고용입니다.',
    footerRights: 'ONE PIECE CARD GAME 및 관련 이미지, 명칭, 상표의 권리는 각 권리자에게 있으며,',
    footerNoAffiliation: '본 사이트는 BANDAI 및 공식 유통사와 제휴되어 있지 않습니다.',
    footerPriceNotice: '제공되는 시세 정보는 참고용이며, 실제 거래 가격과 차이가 있을 수 있습니다.',
    footerResponsibility: '구매 및 판매 결정에 대한 책임은 이용자 본인에게 있습니다.',
    portfolioLoginRequired: '로그인 후 사용 가능합니다.',
    portfolioEmptyHelp: '시세탭에서 추가할 수 있습니다.',
    goToPrices: '시세 바로 가기',
    catalogSortRarity: '등급순',
    catalogSortPrice: '가격순',
    cardOwned: '보유',
    cardNotOwned: '미보유',
    about: '서비스 안내',
    dataPolicy: '데이터 운영 원칙',
    terms: '이용약관',
    privacy: '개인정보처리방침',
    contact: '문의하기',
    partnership: '광고/제휴 문의'
  },
  EN: {
    navCards: 'Cards',
    navPrices: 'Prices',
    navMarketplace: 'Trade',
    navCommunity: 'Community',
    navLab: 'Lab',
    navCalendar: 'Calendar',
    navNews: 'Info',
    navShops: 'Shops',
    login: 'Login',
    logout: 'Logout',
    cardSupplies: 'Supplies',
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
    openSnkrdunk: 'Open SNKRDUNK',
    loginRequired: 'Please log in first.',
    marketCodePlaceholder: 'Card code e.g. OP05-119',
    marketSearch: 'Search Price',
    marketLoading: 'Finding market candidates...',
    marketNoCandidates: 'No mapped market candidates found.',
    marketFallback: 'Exact market mapping was not found. Showing code search results.',
    marketDetailError: 'Failed to load market price details.',
    variantSelect: 'Grade / Version',
    sourceMarket: 'View SNKRDUNK',
    sourceMarketShort: 'SNKRDUNK',
    sourcePsa: 'View PSA',
    sourcePsaShort: 'PSA',
    snkrShortcut: 'Open',
    addAGrade: 'Add Single Grade',
    addAGradeShort: 'Single Grade',
    addPsa10: 'Add PSA10 Grade',
    addPsa10Short: 'Add PSA10',
    aGrade: 'Single',
    addedToPortfolio: 'added to Portfolio.',
    noChart: 'No chart data.',
    recentSales: 'Recent Price Records',
    noRecentSales: 'No price records yet.',
    boxMarketTitle: 'Booster Box Prices',
    boxMarketHelp: 'Browse SNKRDUNK booster box prices by popular order.',
    boxSortLatest: 'Latest',
    boxSortHigh: 'High Price',
    boxSortLow: 'Low Price',
    marketHomeBoxTab: 'Boxes',
    marketHomeCardTab: 'Cards',
    marketCardTitle: 'Card Prices',
    marketCardHelp: 'Featured SNKRDUNK card prices',
    marketCardSortFocus: 'Popular',
    marketCardSortHigh: 'High Price',
    marketCandidateSelect: 'Select',
    selectedVariant: 'Selected Version',
    reselectVariant: 'Reselect',
    snkrLowestPrice: 'SNKRDUNK Recent Price',
    psa10IntegratedPrice: 'PSA10 Integrated Price',
    checkPrice: 'Check Price',
    deckSearchPlaceholder: 'Search cards for deck',
    currentDeck: 'Current Deck',
    deckComingSoonTitle: 'Deck Builder Coming Soon',
    deckComingSoonBody: 'This section will reopen after the deck save and sharing flow is stabilized.',
    newsComingSoonTitle: 'News Coming Soon',
    newsComingSoonBody: 'Official news and updates will open after the layout is ready.',
    close: 'Close',
    allShops: 'All Shops',
    officialShop: 'Certified',
    searchShop: 'Retailers',
    partnerShop: 'Card Shops',
    allRegions: 'All Regions',
    allDistricts: 'All Districts',
    shopSearchPlaceholder: 'Search shop name or address',
    naverMap: 'Naver Map',
    kakaoMap: 'Kakao Map',
    progress: 'Collection Progress',
    updateNotice: 'Updates',
    updateTitle: 'OP-16 update completed',
    updateHelp: 'Click to view previous updates.',
    visitorsTotal: 'Total unique visitors',
    visitorsToday: 'Unique visitors today',
    visitorsOnline: 'Online now',
    usersTotal: 'Total users',
    signupsToday: 'New users today',
    footerIntro: 'Card Pone is an unofficial card database, market price, and collection management service for ONE PIECE CARD GAME players.',
    footerDisclaimer: 'Not affiliated with BANDAI or official distributors. Market prices are for reference only.',
    footerRights: 'ONE PIECE CARD GAME images, names, and trademarks belong to their respective rights holders.',
    footerNoAffiliation: 'This site is not affiliated with BANDAI or official distributors.',
    footerPriceNotice: 'Market price information is provided for reference only and may differ from actual transaction prices.',
    footerResponsibility: 'Users are responsible for their own purchase and sale decisions.',
    portfolioLoginRequired: 'Available after login.',
    portfolioEmptyHelp: 'You can add cards from the Prices tab.',
    goToPrices: 'Go to Prices',
    catalogSortRarity: 'By Rarity',
    catalogSortPrice: 'By Price',
    cardOwned: 'Owned',
    cardNotOwned: 'Not Owned',
    about: 'About',
    dataPolicy: 'Data Policy',
    terms: 'Terms',
    privacy: 'Privacy Policy',
    contact: 'Contact',
    partnership: 'Ads / Partnerships'
  },
  JP: {
    navCards: 'カード図鑑',
    navPrices: '相場',
    navMarketplace: '取引',
    navCommunity: 'コミュニティ',
    navLab: 'ラボ',
    navCalendar: 'カレンダー',
    navNews: '情報',
    navShops: 'ショップ',
    login: 'ログイン',
    logout: 'ログアウト',
    cardSupplies: 'カード用品',
    searchKr: '韓国版',
    searchJp: '日本版',
    searchPlaceholder: 'カード名またはカード番号を検索',
    category: 'カテゴリー',
    all: 'すべて',
    owned: '所持中',
    wishlist: 'ウィッシュリスト',
    search: '検索',
    searchResults: '検索結果',
    loading: '読み込み中...',
    noResults: '検索結果はありません。',
    cardsUnit: '枚',
    cardInfo: 'カード情報',
    effect: '効果',
    effectPending: '効果情報を準備中です。',
    cost: 'コスト',
    power: 'パワー',
    openMarket: 'カード相場を見る',
    searchSameName: '同じ名前のカードを検索',
    officialInfo: '公式情報を見る',
    openSnkrdunk: 'SNKRDUNKを開く',
    loginRequired: 'ログイン後にご利用いただけます。',
    marketCodePlaceholder: 'カード番号 例: OP05-119',
    marketSearch: '相場を検索',
    marketLoading: '相場候補を検索中...',
    marketNoCandidates: '対応する相場候補がありません。',
    marketFallback: '正確な相場マッピングが見つからないため、カード番号検索で表示しています。',
    marketDetailError: '相場詳細を読み込めませんでした。',
    variantSelect: 'グレード / バージョンを選択',
    sourceMarket: 'SNKRDUNKで見る',
    sourceMarketShort: 'SNKRDUNK',
    sourcePsa: 'PSAで見る',
    sourcePsaShort: 'PSA',
    snkrShortcut: '開く',
    addAGrade: 'Singleを追加',
    addAGradeShort: 'Singleを追加',
    addPsa10: 'PSA10を追加',
    addPsa10Short: 'PSA10を追加',
    aGrade: 'Single',
    addedToPortfolio: 'ポートフォリオに追加しました。',
    noChart: 'グラフデータがありません。',
    recentSales: '最近の価格記録',
    noRecentSales: '価格記録はまだありません。',
    boxMarketTitle: 'ボックス相場',
    boxMarketHelp: 'SNKRDUNK基準の人気ボックス価格',
    boxSortLatest: '新着順',
    boxSortHigh: '価格が高い順',
    boxSortLow: '価格が低い順',
    marketHomeBoxTab: 'ボックス',
    marketHomeCardTab: 'カード',
    marketCardTitle: 'カード相場',
    marketCardHelp: 'SNKRDUNK基準の注目カード相場',
    marketCardSortFocus: '人気順',
    marketCardSortHigh: '価格が高い順',
    marketCandidateSelect: '選択',
    selectedVariant: '選択中のバージョン',
    reselectVariant: '選び直す',
    snkrLowestPrice: 'SNKRDUNK 最近の相場',
    psa10IntegratedPrice: 'PSA10 統合相場',
    checkPrice: '価格を確認',
    deckSearchPlaceholder: 'デッキに入れるカードを検索',
    currentDeck: '現在のデッキ',
    deckComingSoonTitle: 'デッキシミュレーター準備中',
    deckComingSoonBody: 'デッキ保存と共有機能を整備後に公開します。',
    newsComingSoonTitle: 'ニュース準備中',
    newsComingSoonBody: '公式ニュースと更新情報を見やすく整理して公開します。',
    close: '閉じる',
    allShops: '全店舗',
    officialShop: '公認店',
    searchShop: '取扱店',
    partnerShop: 'カードショップ',
    allRegions: 'すべての地域',
    allDistricts: 'すべての市区町村',
    shopSearchPlaceholder: '店舗名または住所で検索',
    naverMap: 'Naver Map',
    kakaoMap: 'Kakao Map',
    progress: 'コレクション進捗',
    updateNotice: '更新のお知らせ',
    updateTitle: 'OP-16 アップデート完了',
    updateHelp: 'クリックして過去のお知らせを確認できます。',
    visitorsTotal: '累計ユニーク訪問者',
    visitorsToday: '本日のユニーク訪問者',
    visitorsOnline: '現在オンライン',
    usersTotal: '総会員数',
    signupsToday: '本日の登録者',
    footerIntro: 'Card Poneは、ONE PIECE CARD GAMEユーザーのための非公式カード図鑑・相場・コレクション管理サービスです。',
    footerDisclaimer: '本サイトはBANDAIおよび公式流通事業者と提携しておらず、相場情報は参考情報です。',
    footerRights: 'ONE PIECE CARD GAMEおよび関連する画像、名称、商標の権利は各権利者に帰属します。',
    footerNoAffiliation: '本サイトはBANDAIおよび公式流通事業者と提携していません。',
    footerPriceNotice: '相場情報は参考情報であり、実際の取引価格と異なる場合があります。',
    footerResponsibility: '購入・販売の判断は利用者ご自身の責任で行ってください。',
    portfolioLoginRequired: 'ログイン後に利用できます。',
    portfolioEmptyHelp: '相場タブからカードを追加できます。',
    goToPrices: '相場を見る',
    catalogSortRarity: 'レアリティ順',
    catalogSortPrice: '価格順',
    cardOwned: '所持',
    cardNotOwned: '未所持',
    about: '運営情報',
    dataPolicy: 'データポリシー',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    contact: 'お問い合わせ',
    partnership: '広告・提携のお問い合わせ'
  }
};

function getUiText(lang, key) {
  return UI_TEXT[lang]?.[key] || UI_TEXT.KR[key] || key;
}

function getLocaleText(uiLang, kr, en, jp) {
  if (uiLang === 'JP') return jp ?? en ?? kr;
  if (uiLang === 'EN') return en ?? kr;
  return kr;
}

function isJapaneseUi(uiLang) {
  return uiLang === 'JP';
}

function getGoogleMapsSearchUrl({ name = '', address = '' } = {}) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(' '))}`;
}

function getLocalizedCurrencyText(value, uiLang) {
  return isJapaneseUi(uiLang) ? formatYen(value) : formatUsdWonFromYen(value);
}
const PAGE_PATHS = {
  home: '/',
  adminAnalytics: '/admin/analytics',
  cards: '/cards',
  prices: '/prices',
  ...(MARKETPLACE_TAB_VISIBLE ? { marketplace: '/market' } : {}),
  lab: '/lab',
  centering: '/lab/centering',
  packSimulator: '/lab/pack-simulator',
  deckLab: '/lab/decks',
  deckBuilder: '/lab/decks/builder',
  deckGuide: '/guides/deck-builder',
  seriesGuide: '/guides/series/ebk-03',
  centeringGuide: '/guides/centering',
  packSimulatorGuide: '/guides/pack-simulator',
  profitCalculator: '/tools/profit-calculator',
  profitGuide: '/guides/profit-calculator',
  portfolioCalculator: '/tools/portfolio-calculator',
  portfolioCalculatorGuide: '/guides/portfolio-calculator',
  calendar: '/calendar',
  news: '/news',
  shops: '/shops',
  partnerShops: '/shops/partners',
  about: '/about',
  dataPolicy: '/data-policy',
  terms: '/terms',
  privacy: '/privacy',
  statsPrototype: '/stats-prototype'
};
const PATH_PAGES = Object.fromEntries(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]));
PATH_PAGES['/deck'] = 'deckLab';
PATH_PAGES['/deck-simulator'] = 'deckLab';
const SITE_ORIGIN = 'https://www.optcgkorea.com';
const JAPANESE_ROUTE_PREFIX = '/jp';
function normalizeSitePath(pathname = '/') {
  const normalized = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return normalized === '' ? '/' : normalized;
}

function getPathLocale(pathname = '/') {
  const path = normalizeSitePath(pathname);
  return path === JAPANESE_ROUTE_PREFIX || path.startsWith(`${JAPANESE_ROUTE_PREFIX}/`) ? 'JP' : null;
}

function getAppPath(pathname = '/') {
  const path = normalizeSitePath(pathname);
  if (path === JAPANESE_ROUTE_PREFIX) return '/';
  if (path.startsWith(`${JAPANESE_ROUTE_PREFIX}/`)) return path.slice(JAPANESE_ROUTE_PREFIX.length) || '/';
  return path;
}

function getAnalyticsVisitPath(pathname = '/') {
  const sitePath = normalizeSitePath(pathname);
  const isJapanese = sitePath === JAPANESE_ROUTE_PREFIX || sitePath.startsWith(`${JAPANESE_ROUTE_PREFIX}/`);
  const appPath = getAppPath(sitePath);
  let normalized = appPath;
  if (appPath.startsWith('/cards/')) normalized = '/cards';
  else if (appPath.startsWith('/prices/card/')) normalized = '/prices/card';
  else if (appPath.startsWith('/prices/product/')) normalized = '/prices/product';
  else if (appPath.startsWith('/prices/box/')) normalized = '/prices/box';
  else if (appPath.startsWith('/shops/') && appPath !== '/shops/partners') normalized = '/shops/detail';
  return `${isJapanese ? JAPANESE_ROUTE_PREFIX : ''}${normalized === '/' ? (isJapanese ? '' : '/') : normalized}` || '/';
}

function localizeAppPath(pathname = '/', uiLang = 'KR') {
  const path = getAppPath(pathname);
  return uiLang === 'JP' ? `${JAPANESE_ROUTE_PREFIX}${path === '/' ? '' : path}` : path;
}

function getLocalizedPagePath(page, uiLang = 'KR') {
  return localizeAppPath(PAGE_PATHS[page] || '/', uiLang);
}

function getAppHistoryState() {
  return typeof window !== 'undefined' && window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
}

function replaceAppHistoryState(patch = {}, url = window.location.href) {
  if (typeof window === 'undefined') return;
  window.history.replaceState({ ...getAppHistoryState(), ...patch }, '', url);
}

function getCurrentAppScrollY() {
  if (typeof window === 'undefined') return 0;
  const lockedScrollY = Number(document.body?.dataset?.renewModalScrollY);
  if (Number.isFinite(lockedScrollY)) return lockedScrollY;
  return window.scrollY || document.documentElement?.scrollTop || 0;
}

function rememberCurrentAppView(patch = {}) {
  if (typeof window === 'undefined') return;
  replaceAppHistoryState({ cardPoneScrollY: getCurrentAppScrollY(), ...patch });
}

function pushAppHistory(url, state = {}) {
  if (typeof window === 'undefined') return;
  rememberCurrentAppView();
  window.history.pushState({ cardPoneInternal: true, ...state }, '', url);
}

function restoreAppScrollPosition(targetY, { onDone, timeoutMs = 3000 } = {}) {
  if (typeof window === 'undefined') return () => {};
  const safeTargetY = Math.max(0, Number(targetY) || 0);
  const startedAt = Date.now();
  let frameId = 0;
  let timerId = 0;
  let stopped = false;

  const finish = (notify = true) => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(frameId);
    window.clearTimeout(timerId);
    if (notify) onDone?.();
  };

  const restore = () => {
    if (stopped) return;
    window.scrollTo({ top: safeTargetY, left: 0, behavior: 'auto' });
    const currentY = window.scrollY || document.documentElement.scrollTop || 0;
    if (Math.abs(currentY - safeTargetY) <= 2 || Date.now() - startedAt >= timeoutMs) {
      finish();
      return;
    }
    timerId = window.setTimeout(() => {
      frameId = window.requestAnimationFrame(restore);
    }, 80);
  };

  frameId = window.requestAnimationFrame(restore);
  return () => finish(false);
}

function getRouteSeoPage(pathname = '/') {
  const path = getAppPath(pathname);
  if (PATH_PAGES[path]) return PATH_PAGES[path];
  if (path.startsWith('/guides/series/')) return 'seriesGuide';
  if (path.startsWith('/cards')) return 'cards';
  if (path.startsWith('/prices')) return 'prices';
  if (path.startsWith('/community')) return 'lab';
  if (path === '/tools/profit-calculator') return 'profitCalculator';
  if (path === '/guides/profit-calculator') return 'profitGuide';
  if (path === '/tools/portfolio-calculator') return 'portfolioCalculator';
  if (path === '/guides/portfolio-calculator') return 'portfolioCalculatorGuide';
  if (path.startsWith('/lab')) return 'lab';
  if (path.startsWith('/calendar')) return 'calendar';
  if (path.startsWith('/news') || path.startsWith('/guide') || path.startsWith('/faq')) return 'news';
  if (path.startsWith('/shops/partners')) return 'partnerShops';
  if (path.startsWith('/shops')) return 'shops';
  if (path.startsWith('/market')) return 'marketplace';
  return 'home';
}

function getCatalogRouteViewState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  const path = getAppPath(pathname);
  if (path === '/cards/jp') return { locale: 'JP' };
  if (path === '/cards/kr') return { locale: 'KR' };
  if (path.startsWith('/cards/series/')) {
    const series = findSeriesByRouteSlug(path.slice('/cards/series/'.length));
    if (series) return { locale: series.locale || 'JP', selectedSeries: series.id };
  }
  if (path.startsWith('/cards/')) {
    const slug = path.slice('/cards/'.length);
    if (slug && !slug.includes('/')) {
      const series = findSeriesByRouteSlug(slug);
      if (series) return { locale: series.locale || 'JP', selectedSeries: series.id };
    }
  }
  return null;
}

function getMarketRouteState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/', search = typeof window !== 'undefined' ? window.location.search : '') {
  const path = getAppPath(pathname);
  const params = new URLSearchParams(search);
  const state = {
    code: params.get('code') || '',
    apparelId: params.get('apparelId') || null,
    cardId: params.get('cardId') || ''
  };
  if (path.startsWith('/prices/product/')) {
    state.apparelId = path.slice('/prices/product/'.length);
  }
  if (path.startsWith('/prices/card/')) {
    state.code = path.slice('/prices/card/'.length).toUpperCase();
  }
  return state;
}

function getBoxRouteCode(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  const path = getAppPath(pathname);
  if (!path.startsWith('/prices/box/')) return '';
  return path.slice('/prices/box/'.length).toUpperCase();
}

function getNewsRouteState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/', search = typeof window !== 'undefined' ? window.location.search : '') {
  const path = getAppPath(pathname);
  const params = new URLSearchParams(search);
  if (path.startsWith('/guide')) return { section: 'guide', mode: 'guide' };
  if (path.startsWith('/faq')) return { section: 'guide', mode: 'qa' };
  return {
    section: params.get('section') || '',
    mode: params.get('mode') || ''
  };
}

function getShopRouteState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  const path = getAppPath(pathname);
  if (path === '/shops/official') return { type: 'official' };
  if (!path.startsWith('/shops/')) return null;
  const slug = decodeURIComponent(path.slice('/shops/'.length)).toLowerCase();
  const regions = {
    seoul: '서울',
    gyeonggi: '경기',
    incheon: '인천',
    busan: '부산',
    daegu: '대구',
    daejeon: '대전',
    gwangju: '광주',
    ulsan: '울산',
    gangwon: '강원',
    chungbuk: '충북',
    chungnam: '충남',
    jeonbuk: '전북',
    jeonnam: '전남',
    gyeongbuk: '경북',
    gyeongnam: '경남',
    jeju: '제주',
    sejong: '세종'
  };
  return regions[slug] ? { sido: regions[slug] } : null;
}

const PAGE_SEO = {
  home: {
    title: 'Card Pone - 원피스카드 도감, 시세, 컬렉션 관리',
    h1: '원피스카드 도감·시세·컬렉션 관리',
    description: 'Card Pone는 원피스카드 유저를 위한 비공식 카드 도감, 시세 확인, 컬렉션 관리 서비스입니다.',
    keywords: '원피스카드, 원피스 카드게임, 원피스카드 도감, 원피스카드 시세, 원피스카드 구매처, OPTCG, Card Pone',
    body: 'Card Pone는 원피스카드 유저가 한글판·일본판 카드 도감, 카드별 시세, 컬렉션 관리, 구매처 정보를 한 곳에서 확인할 수 있는 비공식 팬 서비스입니다.'
  },
  cards: {
    title: '원피스카드 도감 - 한글판 일본판 카드 검색 | Card Pone',
    h1: '원피스카드 도감',
    description: '한글판과 일본판 원피스카드의 OP, EB, ST, 프로모 카드를 카드명과 일련번호로 검색할 수 있습니다.',
    keywords: '원피스카드 도감, 원피스 카드 검색, OP16, OP15, 일본판 원피스카드, 한글판 원피스카드',
    body: '원피스카드 도감에서는 한글판과 일본판 카드를 OP, EB, ST, 프로모 시리즈별로 확인하고 카드명 또는 일련번호로 검색할 수 있습니다.'
  },
  seriesGuide: {
    title: 'EBK-03 히로인즈 에디션 가이드 | Card Pone',
    h1: 'EBK-03 ONE PIECE Heroines Edition 가이드',
    description: '한글판 EBK-03 히로인즈 에디션의 발매 정보와 수록 카드, 카드별 도감 및 시세 연결을 확인할 수 있습니다.',
    keywords: 'EBK-03, 히로인즈 에디션, 원피스카드 한글판, 원피스카드 수록 카드',
    body: 'EBK-03 히로인즈 에디션의 상품 정보와 수록 카드를 기존 Card Pone 도감 및 시세 데이터와 연결해 정리한 시리즈 가이드입니다.'
  },
  prices: {
    title: '원피스카드 시세 - 카드별 시세 그래프와 박스 가격 | Card Pone',
    h1: '원피스카드 시세',
    description: '원피스카드별 시세, 박스 가격, 일본판과 한글판 거래 가격 흐름을 확인할 수 있습니다.',
    keywords: '원피스카드 시세, 원피스 카드 가격, 원피스카드 박스 시세, PSA10 시세, SNKRDUNK 원피스카드',
    body: '시세 페이지에서는 카드별 거래 가격, 박스 가격, 최근 거래 내역과 7일, 1개월, 전체 기간 그래프를 확인할 수 있습니다.'
  },
  marketplace: {
    title: '원피스 카드 거래 - 유저 교환과 판매 게시판 | Card Pone',
    h1: '원피스 카드 거래',
    description: 'Card Pone 거래 페이지는 유저 간 원피스 카드 판매, 교환, 구매 글을 카페 인증 기반으로 운영하기 위한 공간입니다.',
    keywords: '원피스카드 거래, 원피스 카드 교환, 원피스카드 판매, 원피스카드 마켓',
    body: '거래 페이지는 유저 간 카드 판매와 교환을 안전하게 운영하기 위해 카페 인증, 매물 사진, 판매자 정보, 문의 기능을 단계적으로 제공할 예정입니다.'
  },
  community: {
    title: '원피스카드 커뮤니티 - 질문·정보·자유 | Card Pone',
    h1: '원피스카드 커뮤니티',
    description: '원피스카드 질문과 정보, 자유 이야기와 가입인사를 나누고 출석 포인트와 회원 등급을 확인할 수 있습니다.',
    keywords: '원피스카드 커뮤니티, 원피스카드 질문, 원피스카드 정보, 원피스카드 가입인사, 카드 수집 커뮤니티',
    body: '질문, 정보, 자유 이야기와 가입인사를 나누고 출석 포인트와 회원 등급을 확인하는 원피스카드 커뮤니티입니다.'
  },
  lab: {
    title: '원피스카드 실험실 - 센터링·카드깡·포트폴리오 계산 | Card Pone',
    h1: '원피스카드 실험실',
    description: '원피스카드 센터링 측정기, 카드깡 시뮬레이터와 포트폴리오 수익률 계산기를 이용할 수 있습니다.',
    keywords: '원피스카드 실험실, 원피스카드 센터링, 원피스카드 카드깡, 카드 수익률 계산기',
    body: '센터링 측정기, 카드깡 시뮬레이터와 포트폴리오 수익률 계산기를 한곳에서 선택하는 공개 도구 모음입니다.'
  },
  centering: {
    title: '원피스카드 센터링 측정기 | Card Pone',
    h1: '원피스카드 센터링 측정기',
    description: '카메라 촬영이나 사진으로 원피스카드 앞면의 좌우·상하 인쇄 비율을 기기 안에서 분석하고 센터링 참고 구간을 확인할 수 있습니다.',
    keywords: '원피스카드 센터링, 카드 센터링 측정기, PSA 센터링, 원피스카드 감정',
    body: '카드 외곽과 내부 인쇄 경계를 맞춰 좌우와 상하 센터링 비율을 확인하는 공개 도구입니다.'
  },
  packSimulator: {
    title: '원피스카드 카드깡 시뮬레이터 | Card Pone',
    h1: '원피스카드 카드깡 시뮬레이터',
    description: '원피스카드 시리즈와 1팩·1박스·1카톤을 선택해 가상 개봉 결과와 획득 카드의 참고 시세를 확인할 수 있습니다.',
    keywords: '원피스카드 카드깡, 원피스카드 시뮬레이터, 원피스카드 팩 개봉, 원피스카드 박스 개봉',
    body: '도감 카드와 봉입 규칙을 이용해 팩, 박스, 카톤을 가상 개봉하고 결과 카드를 확인하는 공개 도구입니다.'
  },
  centeringGuide: {
    title: '원피스카드 센터링 측정기 사용 가이드 | Card Pone',
    h1: '센터링 측정기 사용 가이드',
    description: '원피스카드 촬영 준비, 카드 외곽과 내부 인쇄 경계 조정, 센터링 결과 해석 방법을 안내합니다.',
    keywords: '원피스카드 센터링 측정 방법, 카드 센터링 비율, 센터링 측정 가이드',
    body: '카드 촬영부터 외곽과 내부 인쇄 경계 조정, 센터링 비율 확인까지의 과정을 안내합니다.'
  },
  packSimulatorGuide: {
    title: '원피스카드 카드깡 시뮬레이터 사용 가이드 | Card Pone',
    h1: '카드깡 시뮬레이터 사용 가이드',
    description: '가상 카드깡의 시리즈와 개봉 단위 선택, 팩·박스·카톤 결과와 확률의 의미를 안내합니다.',
    keywords: '원피스카드 카드깡 시뮬레이터 사용법, 원피스카드 봉입률, 가상 카드 개봉',
    body: '시리즈와 개봉 단위를 선택하고 가상 개봉 결과와 참고 시세를 확인하는 방법을 안내합니다.'
  },
  deckLab: {
    title: '원피스카드 덱 빌더 - 리더 색상과 덱 규칙 검사 | Card Pone',
    h1: '원피스카드 덱 빌더',
    description: '원피스카드 리더를 선택하고 색상에 맞는 카드로 50장 덱을 구성하며 카드 매수와 덱 규칙을 확인할 수 있습니다.',
    keywords: '원피스카드 덱 빌더, 원피스카드 덱 구성, 원피스카드 리더, 원피스카드 덱 레시피',
    body: '리더와 사용 환경을 선택하고 색상에 맞는 카드를 검색해 50장 덱을 구성하며 기본 덱 규칙을 확인하는 공개 도구입니다.'
  },
  deckGuide: {
    title: '원피스카드 덱 빌더 사용 가이드 | Card Pone',
    h1: '덱 빌더 사용 가이드',
    description: '리더와 카드 환경 선택, 검증된 덱 불러오기, 카드 추가와 덱 규칙 검사 방법을 안내합니다.',
    keywords: '원피스카드 덱 빌더, 원피스카드 덱 구성, 원피스카드 리더 색상, 원피스카드 덱 규칙',
    body: '리더 색상에 맞는 카드를 검색하고 검증된 덱을 불러와 50장 덱을 구성하는 방법을 안내합니다.'
  },
  profitCalculator: {
    title: '카드 손익 계산기 | Card Pone',
    h1: '카드 손익 계산기',
    description: '카드 매입가, 판매 예정가, 수수료와 배송비를 입력해 예상 손익, 수익률, 손익분기 판매가를 계산하세요.',
    keywords: '원피스카드 손익 계산기, 카드 수익률 계산기, 카드 판매 수수료, 카드 손익분기 가격',
    body: '매입 단가와 판매 예정 단가, 수수료, 배송비를 바탕으로 카드 거래의 예상 손익과 손익분기 판매가를 계산하는 공개 도구입니다.'
  },
  profitGuide: {
    title: '카드 손익 계산기 사용 가이드 | Card Pone',
    h1: '카드 손익 계산 가이드',
    description: '카드 거래 손익 계산 기준, 수수료와 배송비 반영 방법, 손익분기 판매가 확인 방법을 안내합니다.',
    keywords: '카드 손익 계산 방법, 카드 수익률 계산, 카드 손익분기 판매가, 원피스카드 거래 가이드',
    body: '카드 매입가와 판매가, 수수료, 배송비를 기준으로 손익과 수익률을 확인하는 방법을 정리한 공개 가이드입니다.'
  },
  portfolioCalculator: {
    title: '원피스카드 포트폴리오 수익률 계산기 | Card Pone',
    h1: '포트폴리오 수익률 계산기',
    description: '원피스카드를 검색하고 매입가 또는 매입일 시세를 입력해 현재 평가금액, 평가손익과 수익률을 계산하세요.',
    keywords: '원피스카드 포트폴리오, 카드 수익률 계산기, 원피스카드 평가손익, 카드 매입가 계산',
    body: '카드별 매입가와 수량을 현재 참고 시세와 비교해 평가금액, 평가손익, 수익률을 확인하는 공개 도구입니다.'
  },
  portfolioCalculatorGuide: {
    title: '포트폴리오 수익률 계산기 사용 가이드 | Card Pone',
    h1: '포트폴리오 수익률 계산 가이드',
    description: '카드 검색, 매입가 직접 입력, 매입일 시세 추정과 포트폴리오 저장 방법을 안내합니다.',
    keywords: '카드 포트폴리오 사용법, 카드 수익률 계산 방법, 원피스카드 매입가, 카드 평가손익',
    body: '카드별 매입 정보와 현재 참고 시세를 이용해 평가손익을 계산하고 로그인 후 포트폴리오에 저장하는 방법을 안내합니다.'
  },
  news: {
    title: '원피스카드 정보 - 공지사항, 가이드, 사전예약 | Card Pone',
    h1: '원피스카드 정보',
    description: '원피스카드 공식 소식, 업데이트 공지, 이용 가이드, 사전예약, 카드 보관용품 정보를 확인할 수 있습니다.',
    keywords: 'Card Pone 정보, 원피스카드 공지사항, 원피스카드 뉴스, 원피스카드 가이드, 원피스카드 Q&A',
    body: '정보 영역에서는 업데이트 공지, 공식 소식, 사전예약, 카드 보관용품, 이용 가이드를 확인할 수 있습니다.'
  },
  calendar: {
    title: '원피스카드 캘린더 - 발매일·이벤트·공식 공지 | Card Pone',
    h1: '원피스카드 캘린더',
    description: '원피스카드 한글판과 일본판 상품 발매일, 이벤트 공지와 공식 소식을 월별 일정으로 확인할 수 있습니다.',
    keywords: '원피스카드 캘린더, 원피스카드 발매일, 원피스카드 이벤트, 원피스카드 일정',
    body: '원피스카드 캘린더에서는 한글판과 일본판 상품 발매 정보와 공식 이벤트·상품 공지를 날짜별로 확인할 수 있습니다.'
  },
  shops: {
    title: '원피스카드 구매처 - 지역별 공인점포 취급점포 | Card Pone',
    h1: '원피스카드 구매처',
    description: '지역별 원피스카드 오프라인 공인점포와 취급점포를 검색하고 지도 링크로 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스 카드 공인점포, 원피스카드 매장, 원피스카드 취급점포',
    body: '구매처 페이지에서는 지역별 오프라인 공인점포와 취급점포를 필터로 찾고 네이버지도 또는 카카오맵으로 위치를 확인할 수 있습니다.'
  },
  about: {
    title: 'Card Pone 서비스 안내 | 원피스카드 도감·시세·컬렉션 관리',
    h1: '서비스 안내',
    description: 'Card Pone에서 제공하는 원피스카드 도감, 시세, 컬렉션과 실험실 기능 및 문의 채널을 안내합니다.',
    keywords: 'Card Pone 서비스 안내, 원피스카드 도감, 원피스카드 시세, 원피스카드 컬렉션',
    body: 'Card Pone는 원피스 카드게임 유저가 카드 도감, 시세, 컬렉션, 구매처 정보를 한 곳에서 확인할 수 있도록 만든 비공식 정보 서비스입니다.'
  },
  dataPolicy: {
    title: '데이터 운영 정책 | Card Pone',
    h1: '데이터 운영 정책',
    description: 'Card Pone의 카드 도감, 시세, 지수, 구매처 데이터 수집 기준과 한계를 안내합니다.',
    keywords: 'Card Pone 데이터 정책, 원피스카드 시세 데이터, 원피스카드 도감 데이터',
    body: 'Card Pone는 공개 자료와 자체 수집 데이터를 바탕으로 카드 정보와 시세 정보를 제공하며, 실제 거래와 차이가 있을 수 있음을 명확히 고지합니다.'
  },
  terms: {
    title: '이용약관 | Card Pone',
    h1: '이용약관',
    description: 'Card Pone 서비스 이용 조건, 시세 정보 이용 기준, 광고 및 제휴 고지를 안내합니다.',
    keywords: 'Card Pone 이용약관, 원피스카드 서비스 약관',
    body: 'Card Pone 이용약관은 카드 도감, 시세, 컬렉션 관리 및 관련 기능의 이용 조건을 안내합니다.'
  },
  privacy: {
    title: '개인정보처리방침 | Card Pone',
    h1: '개인정보처리방침',
    description: 'Card Pone의 개인정보 수집, 이용, 보관, 삭제 및 문의 방법을 안내합니다.',
    keywords: 'Card Pone 개인정보처리방침, 원피스카드 개인정보',
    body: 'Card Pone는 로그인, 컬렉션 관리, 문의 대응 등 서비스 제공에 필요한 범위에서 개인정보를 처리합니다.'
  }
};

const CLIENT_ROUTE_SEO = {
  '/cards/jp': {
    title: '일본판 원피스카드 도감 | Card Pone',
    h1: '일본판 원피스카드 도감',
    description: '일본판 원피스 카드게임 카드 목록을 OP, EB, ST, 프로모 시리즈별로 검색하고 확인할 수 있습니다.',
    keywords: '일본판 원피스카드, 원피스카드 일본판 도감, OP 카드 리스트',
    body: '일본판 원피스 카드게임 카드 목록과 시리즈별 수집 현황을 확인할 수 있습니다.'
  },
  '/cards/kr': {
    title: '한글판 원피스카드 도감 | Card Pone',
    h1: '한글판 원피스카드 도감',
    description: '한글판 원피스 카드게임 카드 목록을 시리즈별로 검색하고 보유 카드와 위시리스트를 관리할 수 있습니다.',
    keywords: '한글판 원피스카드, 원피스카드 한글판 도감, 원피스카드 검색',
    body: '한글판 원피스 카드게임 카드 목록과 보유 카드 정보를 확인할 수 있습니다.'
  },
  '/prices/cards': {
    title: '원피스카드 싱글 카드 시세 | Card Pone',
    h1: '원피스카드 싱글 카드 시세',
    description: 'SNKRDUNK 기준 원피스카드 싱글 카드 가격과 주요 카드 시세를 확인할 수 있습니다.',
    keywords: '원피스카드 싱글 시세, 원피스카드 가격, SNKRDUNK 원피스카드',
    body: '원피스카드 싱글 카드의 주요 가격과 시세 후보를 확인할 수 있습니다.'
  },
  '/prices/boxes': {
    title: '원피스카드 박스 시세 | Card Pone',
    h1: '원피스카드 박스 시세',
    description: '원피스 카드게임 부스터 박스와 팩 가격을 최신순, 가격 높은순, 가격 낮은순으로 확인할 수 있습니다.',
    keywords: '원피스카드 박스 시세, 원피스카드 박스 가격, 부스터 박스',
    body: '원피스 카드게임 부스터 박스와 팩 가격을 확인할 수 있습니다.'
  },
  '/prices/index': {
    title: 'OPTCG Market Index | Card Pone',
    h1: 'OPTCG Market Index',
    description: 'Card Pone가 추적하는 원피스카드 대표 지수와 하위 섹터 지수를 확인할 수 있습니다.',
    keywords: 'OPTCG Index, 원피스카드 지수, 원피스카드 투자 지표',
    body: '원피스카드 대표 카드와 섹터별 가격 흐름을 지수로 확인할 수 있습니다.'
  },
  '/prices/index/manga': {
    title: 'OPTCG Manga Index | Card Pone',
    h1: 'OPTCG Manga Index',
    description: '원피스카드 망가 카드 중심의 Manga Index 가격 흐름을 확인할 수 있습니다.',
    keywords: '원피스카드 망가 시세, Manga Index, 망가 카드 가격',
    body: '원피스카드 망가 카드의 가격 흐름을 지수로 확인할 수 있습니다.'
  },
  '/prices/index/premium-art': {
    title: 'OPTCG Premium Art Index | Card Pone',
    h1: 'OPTCG Premium Art Index',
    description: '수배서, 금배경, 은배경 등 프리미엄 아트 카드 중심의 지수를 확인할 수 있습니다.',
    keywords: '원피스카드 수배서, 프리미엄 아트, 금배경 은배경',
    body: '원피스카드 프리미엄 아트 계열 카드의 가격 흐름을 지수로 확인할 수 있습니다.'
  },
  '/prices/index/heroines': {
    title: 'OPTCG Heroines Index | Card Pone',
    h1: 'OPTCG Heroines Index',
    description: '원피스카드 여성 캐릭터 카드의 가격 흐름을 지수로 확인할 수 있습니다.',
    keywords: '원피스카드 여캐, 히로인즈 인덱스, OPTCG Heroines Index',
    body: '원피스카드 여성 캐릭터 카드의 가격 흐름을 지수로 확인할 수 있습니다.'
  },
  '/prices/index/luffy': {
    title: 'OPTCG Luffy Index | Card Pone',
    h1: 'OPTCG Luffy Index',
    description: '몽키 D. 루피 주요 카드 가격 흐름을 Luffy Index로 확인할 수 있습니다.',
    keywords: '루피 카드 시세, Monkey D Luffy 카드, OPTCG Luffy Index',
    body: '몽키 D. 루피 주요 카드의 가격 흐름을 지수로 확인할 수 있습니다.'
  },
  '/guide': {
    title: '원피스카드 입문 가이드 | Card Pone',
    h1: '원피스카드 입문 가이드',
    description: '원피스카드 수집, 시세 확인, 보관, 구매 방향성을 처음 이용자도 이해하기 쉽게 정리합니다.',
    keywords: '원피스카드 입문, 원피스카드 수집 가이드, 원피스카드 보관',
    body: '원피스카드를 처음 수집하는 이용자를 위한 기본 가이드입니다.'
  },
  '/guide/box-recommendation': {
    title: '원피스카드 박스 추천 가이드 | Card Pone',
    h1: '원피스카드 박스 추천 가이드',
    description: '박스 현재가와 수록 카드 Single 시세를 비교해 최고가 카드, 안정적인 가격 분포, 유효 히트 수 기준으로 부스터 박스를 살펴봅니다.',
    keywords: '원피스카드 박스 추천, 원피스카드 박스 가격, 원피스카드 히트 카드',
    body: 'Card Pone의 박스 및 카드 시세 연결 데이터를 이용해 목적별 부스터 박스를 비교합니다.'
  },
  '/guide/box-recommendation/high-price': {
    title: '최고가 카드를 노리는 원피스카드 박스 추천 | Card Pone',
    h1: '최고가 카드 노리기',
    description: '원피스카드 부스터별 수록 카드의 최신 Single 최고가를 비교해 고가 카드를 노릴 때 확인할 박스를 순위로 보여줍니다.',
    keywords: '원피스카드 최고가 카드, 원피스카드 박스 추천, 원피스카드 고점',
    body: '박스 가격은 순위에 반영하지 않고, 각 부스터에 실제로 수록된 카드의 최신 Single 최고가만 비교합니다.'
  },
  '/guide/box-recommendation/stable': {
    title: '가격 분포가 안정적인 원피스카드 박스 추천 | Card Pone',
    h1: '가격 분포가 안정적인 박스',
    description: '일부 카드에 가격이 집중되지 않고 매핑된 히트 카드 가격이 비교적 고른 원피스카드 부스터를 확인합니다.',
    keywords: '원피스카드 안정적인 박스, 원피스카드 박스 추천, 원피스카드 히트 카드',
    body: '최고가와 중앙값의 차이, 가격 분산과 데이터 커버리지를 함께 비교합니다.'
  },
  '/guide/box-recommendation/more-hits': {
    title: '히트 카드가 많은 원피스카드 박스 추천 | Card Pone',
    h1: '유효 히트가 많은 박스',
    description: '박스 가격과 비교했을 때 의미 있는 Single 시세가 확인되는 히트 카드가 많은 부스터를 살펴봅니다.',
    keywords: '원피스카드 히트 많은 박스, 원피스카드 박스 추천, 원피스카드 카드깡',
    body: '박스 가격의 일정 비율 이상인 수록 카드 수와 가격 데이터 커버리지를 기준으로 비교합니다.'
  },
  '/faq': {
    title: '원피스카드 Q&A | Card Pone',
    h1: '원피스카드 Q&A',
    description: '원피스카드 레어도, 패러렐, 박스 봉입률, 시세 확인에 대한 자주 묻는 질문을 정리합니다.',
    keywords: '원피스카드 Q&A, 원피스카드 FAQ, 원피스카드 레어도',
    body: '원피스카드 이용자가 자주 묻는 질문과 답변을 정리합니다.'
  }
};

const JP_PAGE_SEO = {
  home: {
    title: 'ワンピースカードゲームのカード図鑑・相場 | Card Pone',
    h1: 'ワンピースカードゲームのカード図鑑・相場',
    description: 'ONE PIECE CARD GAMEの日本版カードを中心に、カード図鑑、SNKRDUNK基準の相場、価格チャート、コレクション管理を確認できる非公式サービスです。',
    keywords: 'ワンピースカードゲーム,ワンピカード,ワンピースカード 相場,ワンピカード 相場,ワンピースカード 図鑑,SNKRDUNK,Card Pone',
    body: 'ONE PIECE CARD GAMEのカード図鑑、相場、コレクション管理をひとつにまとめた非公式サービスです。'
  },
  cards: {
    title: 'ワンピースカードゲーム カード図鑑 | Card Pone',
    h1: 'ワンピースカードゲーム カード図鑑',
    description: 'ONE PIECE CARD GAMEの日本版カードをOP、EB、ST、プロモシリーズごとに検索し、カード名や番号から確認できます。',
    keywords: 'ワンピースカードゲーム カードリスト,ワンピカード 図鑑,ワンピースカード 検索,OPカード,Card Pone',
    body: '日本版ONE PIECE CARD GAMEのカードをシリーズ、カード番号、カード名から検索できます。'
  },
  prices: {
    title: 'ワンピースカードゲーム 相場・価格チャート | Card Pone',
    h1: 'ワンピースカードゲーム 相場',
    description: 'SNKRDUNK基準でONE PIECE CARD GAMEのSingle・PSA10の価格、最近の取引記録、7日・1か月・1年チャートを確認できます。',
    keywords: 'ワンピースカードゲーム 相場,ワンピカード 相場,ワンピースカード 価格,SNKRDUNK,PSA10,Card Pone',
    body: 'カードごとの最近の取引価格、価格チャート、ボックス相場を確認できます。'
  },
  community: {
    title: 'ワンピースカードゲーム コミュニティ | Card Pone',
    h1: 'ワンピースカードゲーム コミュニティ',
    description: 'ONE PIECE CARD GAMEの質問、情報、自己紹介、コレクションの話を共有できるコミュニティです。',
    keywords: 'ワンピースカードゲーム コミュニティ,ワンピカード 質問,ワンピカード 情報,ワンピカード 自己紹介,ワンピカード コレクション',
    body: '質問、情報、自己紹介、自由な話題を共有できるONE PIECE CARD GAMEコミュニティです。'
  },
  lab: {
    title: 'ワンピースカード ラボ - センタリング・開封・収益率計算 | Card Pone',
    h1: 'ワンピースカード ラボ',
    description: 'センタリング測定、パック開封シミュレーター、ポートフォリオ収益率計算を利用できます。',
    keywords: 'ワンピースカード ラボ,カード センタリング,パック開封 シミュレーター,カード 収益率 計算',
    body: 'センタリング測定、パック開封シミュレーター、ポートフォリオ収益率計算を選べる公開ツール集です。'
  },
  centering: {
    title: 'ワンピースカード センタリング測定 | Card Pone',
    h1: 'ワンピースカード センタリング測定',
    description: '撮影したカードの外枠と印刷境界を調整し、表面の左右・上下のセンタリング比率を端末内で確認できます。',
    keywords: 'ワンピースカード センタリング,カード センタリング測定,PSA センタリング',
    body: 'カードの外枠と印刷境界から左右・上下のセンタリング比率を確認する公開ツールです。'
  },
  packSimulator: {
    title: 'ワンピースカード 開封シミュレーター | Card Pone',
    h1: 'ワンピースカード 開封シミュレーター',
    description: 'シリーズと1パック・1ボックス・1カートンを選び、仮想開封結果とカードの参考価格を確認できます。',
    keywords: 'ワンピースカード 開封シミュレーター,ワンピカード パック開封,ボックス開封',
    body: 'カード図鑑と封入ルールを使ってパック、ボックス、カートンを仮想開封する公開ツールです。'
  },
  centeringGuide: {
    title: 'ワンピースカード センタリング測定ガイド | Card Pone',
    h1: 'センタリング測定ガイド',
    description: '撮影準備、カード外枠と印刷境界の調整、センタリング結果の見方を案内します。',
    keywords: 'カード センタリング 測定方法,センタリング 比率,ワンピースカード ガイド',
    body: '撮影から外枠と印刷境界の調整、センタリング比率の確認までを案内します。'
  },
  packSimulatorGuide: {
    title: 'ワンピースカード 開封シミュレーターガイド | Card Pone',
    h1: '開封シミュレーターガイド',
    description: 'シリーズと開封単位の選択、パック・ボックス・カートンの結果と確率の見方を案内します。',
    keywords: 'ワンピースカード 開封シミュレーター 使い方,封入率,仮想開封',
    body: 'シリーズと開封単位を選び、仮想開封結果と参考価格を確認する方法を案内します。'
  },
  deckGuide: {
    title: 'ワンピースカード デッキビルダーガイド | Card Pone',
    h1: 'デッキビルダーガイド',
    description: 'リーダーとカード環境の選択、検証済みデッキの読み込み、カード追加とデッキルール確認方法を案内します。',
    keywords: 'ワンピースカード デッキビルダー,デッキ構築,リーダーカラー,デッキルール',
    body: 'リーダーの色に合うカードを検索し、検証済みデッキを読み込んで50枚のデッキを構築する方法を案内します。'
  },
  profitCalculator: {
    title: 'カード損益計算機 | Card Pone',
    h1: 'カード損益計算機',
    description: 'カードの仕入れ値、販売予定価格、手数料、送料から、予想損益、収益率、損益分岐販売価格を計算できます。',
    keywords: 'カード 損益計算,カード 利益計算,トレーディングカード 手数料,損益分岐価格',
    body: '仕入れ値、販売予定価格、手数料、送料をもとに、カード取引の予想損益と損益分岐販売価格を計算する公開ツールです。'
  },
  profitGuide: {
    title: 'カード損益計算機の使い方 | Card Pone',
    h1: 'カード損益計算機の使い方',
    description: 'カード取引の損益計算、手数料・送料の反映、損益分岐販売価格の確認方法を解説します。',
    keywords: 'カード 損益計算 方法,カード 利益率 計算,損益分岐価格,トレーディングカード ガイド',
    body: 'カードの仕入れ値と販売価格、手数料、送料をもとに損益と収益率を確認する方法をまとめた公開ガイドです。'
  },
  portfolioCalculator: {
    title: 'ワンピースカード ポートフォリオ収益率計算 | Card Pone',
    h1: 'ポートフォリオ収益率計算',
    description: 'カードを検索し、購入価格または購入日の参考価格から現在評価額、評価損益、収益率を計算できます。',
    keywords: 'ワンピースカード ポートフォリオ,カード 収益率 計算,カード 評価損益,カード 購入価格',
    body: 'カードごとの購入価格と数量を現在の参考価格と比較し、評価額、評価損益、収益率を確認する公開ツールです。'
  },
  portfolioCalculatorGuide: {
    title: 'ポートフォリオ収益率計算ガイド | Card Pone',
    h1: 'ポートフォリオ収益率計算ガイド',
    description: 'カード検索、購入価格の入力、購入日の参考価格推定、ポートフォリオ保存方法を案内します。',
    keywords: 'カード ポートフォリオ 使い方,カード 収益率 計算方法,ワンピースカード 購入価格',
    body: '購入情報と現在の参考価格から評価損益を計算し、ログイン後にポートフォリオへ保存する方法を案内します。'
  },
  calendar: {
    title: 'ワンピースカードゲーム 発売日・イベントカレンダー | Card Pone',
    h1: 'ワンピースカードゲーム カレンダー',
    description: 'ONE PIECE CARD GAMEの新商品、パック、ボックス、プロモカードの発売日と公式イベント情報を月別に確認できます。',
    keywords: 'ワンピースカードゲーム 発売日,ワンピカード 発売日,ワンピカード カレンダー,ワンピースカード イベント',
    body: '新商品とプロモカードの発売日、公式イベント情報をカレンダーで確認できます。'
  },
  news: {
    title: 'ワンピースカードゲーム 公式情報・新商品情報 | Card Pone',
    h1: 'ワンピースカードゲーム 情報',
    description: 'ONE PIECE CARD GAMEの公式情報、新商品、予約情報、コレクションガイドをまとめて確認できます。',
    keywords: 'ワンピースカードゲーム 情報,ワンピカード 新商品,ワンピースカード 公式,ワンピカード 予約',
    body: '公式情報、新商品、予約情報とコレクションガイドを確認できます。'
  },
  shops: {
    title: 'ワンピースカードゲーム 公式ショップ・公認店 | Card Pone',
    h1: 'ONE PIECEカードゲーム 公式ショップ・公認店',
    description: '日本全国のONE PIECE CARD GAME公式ショップを地域や店舗名から検索し、住所、営業時間、Googleマップ、公認店検索を確認できます。',
    keywords: 'ワンピースカードゲーム 公式ショップ,ワンピカード 公認店,ワンピカード 店舗,ONE PIECEカードゲーム ショップ',
    body: '日本全国の公式ショップ情報と公認店検索を確認できます。'
  }
};

function getJapaneseRouteSeo(pathname, page) {
  const path = getAppPath(pathname);
  const directSeriesSlug = path.startsWith('/cards/') ? path.slice('/cards/'.length) : '';
  const seriesSlug = path.startsWith('/cards/series/')
    ? path.slice('/cards/series/'.length)
    : directSeriesSlug && !directSeriesSlug.includes('/') && !['jp', 'kr'].includes(directSeriesSlug.toLowerCase())
      ? directSeriesSlug
      : '';
  if (seriesSlug) {
    const series = getBaseSeriesId(findSeriesByRouteSlug(seriesSlug) || seriesSlug.toUpperCase() || 'SERIES');
    return {
      title: `${series} ワンピースカードゲーム カードリスト | Card Pone`,
      h1: `${series} カードリスト`,
      description: `${series}シリーズのONE PIECE CARD GAMEカードをカード番号、レアリティ、カード名から確認できます。`,
      keywords: `${series},ワンピースカードゲーム,ワンピカード,カードリスト`,
      body: `${series}シリーズのカードリストです。`
    };
  }
  if (path.startsWith('/prices/product/')) {
    const id = path.slice('/prices/product/'.length);
    return {
      title: `SNKRDUNK 商品 #${id} 相場 | Card Pone`,
      h1: `SNKRDUNK 商品 #${id} 相場`,
      description: `SNKRDUNK商品 #${id} のONE PIECE CARD GAME価格チャートと最近の取引記録を確認できます。`,
      keywords: `SNKRDUNK ${id},ワンピースカードゲーム 相場,ワンピカード 価格`,
      body: `SNKRDUNK商品 #${id} の相場詳細です。`
    };
  }
  if (path.startsWith('/prices/card/')) {
    const code = path.slice('/prices/card/'.length).toUpperCase();
    return {
      title: `${code} ワンピースカードゲーム 相場 | Card Pone`,
      h1: `${code} 相場`,
      description: `${code}のONE PIECE CARD GAME相場候補と価格を確認できます。`,
      keywords: `${code},ワンピースカードゲーム 相場,ワンピカード 価格`,
      body: `${code}の相場候補です。`
    };
  }
  if (path.startsWith('/prices/box/')) {
    const code = path.slice('/prices/box/'.length).toUpperCase();
    return {
      title: `${code} ボックス相場 | Card Pone`,
      h1: `${code} ボックス相場`,
      description: `ONE PIECE CARD GAME ${code}のボックス価格とSNKRDUNK商品情報を確認できます。`,
      keywords: `${code},ワンピースカードゲーム ボックス 相場,ワンピカード ボックス`,
      body: `${code}ボックスの相場詳細です。`
    };
  }
  return JP_PAGE_SEO[page] || JP_PAGE_SEO.home;
}

function getClientRouteSeo(page, uiLang = 'KR') {
  if (typeof window === 'undefined') return null;
  const path = getAppPath(window.location.pathname);
  if (path.startsWith('/guides/series/')) {
    const series = findSeriesByRouteSlug(path.slice('/guides/series/'.length));
    if (series) {
      const code = getBaseSeriesId(series);
      const isJapanese = uiLang === 'JP' || getPathLocale(window.location.pathname) === 'JP';
      const name = (isJapanese ? series.enName : series.koName) || series.enName || series.koName || code;
      const locale = series.locale || 'JP';
      const cardCount = Number(seriesCardCounts?.[locale]?.series?.[series.id] || 0);
      if (isJapanese) {
        const localeLabel = locale === 'JP' ? '日本版' : locale === 'EN' ? '英語版' : '韓国版';
        return {
          title: `${code} ${name} カードリスト・シリーズガイド | Card Pone`,
          h1: `${code} ${name} シリーズガイド`,
          description: `${localeLabel}${code} ${name}の登録カード${cardCount}枚をカード番号、レアリティ、画像から確認できるシリーズガイドです。`,
          keywords: `${code},${name},ワンピースカードゲーム,カードリスト,${localeLabel}`,
          body: `${code}シリーズの基本情報と収録カードをCard Poneのカード図鑑・相場データとあわせて確認できます。`
        };
      }
      return {
        title: `${code} ${name} 카드 리스트·시리즈 가이드 | Card Pone`,
        h1: `${code} ${name} 시리즈 가이드`,
        description: `${code} ${name}의 도감 등록 카드 ${cardCount}장을 카드번호, 레어도, 이미지로 확인하는 원피스카드 시리즈 가이드입니다.`,
        keywords: `${code}, ${name}, 원피스카드 리스트, 원피스카드 도감`,
        body: `${code} 시리즈의 상품 정보와 수록 카드를 Card Pone 도감 및 시세 데이터와 연결해 정리한 가이드입니다.`
      };
    }
  }
  if (uiLang === 'JP' || getPathLocale(window.location.pathname) === 'JP') return getJapaneseRouteSeo(window.location.pathname, page);
  const seoAliases = {
    '/prices/collector-index': '/prices/index',
    '/prices/manga-index': '/prices/index/manga',
    '/prices/premium-art-index': '/prices/index/premium-art',
    '/prices/sp-index': '/prices/index',
    '/prices/index/sp': '/prices/index',
    '/prices/index/heroines': '/prices/index',
    '/prices/luffy-index': '/prices/index/luffy'
  };
  if (seoAliases[path] && CLIENT_ROUTE_SEO[seoAliases[path]]) return CLIENT_ROUTE_SEO[seoAliases[path]];
  if (CLIENT_ROUTE_SEO[path]) return CLIENT_ROUTE_SEO[path];
  if (path.startsWith('/shops/partners')) {
    const { shop } = getPartnerShopRoute(path);
    if (shop) {
      const title = shop.titleEn || shop.titleKr || 'Partner Card Shop';
      const location = shop.bodyEn || shop.bodyKr || '';
      return {
        title: `${title} - 원피스카드 파는곳 | Card Pone`,
        h1: `${title} - 원피스카드 파는곳`,
        description: `${title} 제휴 카드샵 정보입니다. ${location} 위치, 영업시간, 지도, 온라인 채널을 확인할 수 있습니다.`,
        keywords: `${title}, 원피스카드 파는곳, 원피스카드 매장, 원피스카드 카드샵, Card Pone`,
        body: `${title} 제휴 카드샵 상세 정보`
      };
    }
    return {
      title: '원피스카드 파는곳 - 제휴 카드샵 | Card Pone',
      h1: '원피스카드 파는곳 - 제휴 카드샵',
      description: 'Card Pone 제휴 카드샵 목록입니다. 원피스카드 매장 위치, 영업시간, 네이버지도, 인스타그램, 스마트스토어 바로가기를 확인할 수 있습니다.',
      keywords: '원피스카드 파는곳, 원피스카드 매장, 원피스카드 카드샵, 원피스카드 구매처, Card Pone',
      body: '원피스카드 제휴 카드샵 목록'
    };
  }
  if (path.startsWith('/cards/series/')) {
    const matchedSeries = findSeriesByRouteSlug(path.slice('/cards/series/'.length));
    const series = matchedSeries ? getBaseSeriesId(matchedSeries) : (path.split('/').pop()?.toUpperCase() || 'SERIES');
    return {
      title: `${series} 원피스카드 리스트 | Card Pone`,
      h1: `${series} 원피스카드 리스트`,
      description: `${series} 시리즈의 원피스 카드게임 카드 목록과 보유 카드 정보를 확인할 수 있습니다.`,
      keywords: `${series} 원피스카드, ${series} 카드 리스트, 원피스카드 도감`,
      body: `${series} 시리즈 카드 목록을 확인할 수 있습니다.`
    };
  }
  if (path.startsWith('/cards/')) {
    const slug = path.slice('/cards/'.length);
    const matchedSeries = slug && !slug.includes('/') ? findSeriesByRouteSlug(slug) : null;
    if (!matchedSeries) return null;
    const series = getBaseSeriesId(matchedSeries);
    return {
      title: `${series} 원피스카드 리스트 | Card Pone`,
      h1: `${series} 원피스카드 리스트`,
      description: `${series} 시리즈의 원피스 카드게임 카드 목록과 보유 카드 정보를 확인할 수 있습니다.`,
      keywords: `${series} 원피스카드, ${series} 카드 리스트, 원피스카드 도감`,
      body: `${series} 시리즈 카드 목록을 확인할 수 있습니다.`
    };
  }
  if (path.startsWith('/shops/')) {
    const region = decodeURIComponent(path.split('/').pop() || '').replace(/-/g, ' ');
    return {
      title: `${region} 원피스카드 구매처 | Card Pone`,
      h1: `${region} 원피스카드 구매처`,
      description: `${region} 지역의 원피스 카드게임 공인점포와 취급점포 정보를 확인할 수 있습니다.`,
      keywords: `${region} 원피스카드 매장, ${region} 원피스카드 구매처`,
      body: `${region} 지역 구매처 정보를 확인할 수 있습니다.`
    };
  }
  if (path.startsWith('/prices/product/')) {
    const id = path.slice('/prices/product/'.length);
    return {
      title: `SNKRDUNK Product #${id} Price | Card Pone`,
      h1: `SNKRDUNK Product #${id}`,
      description: `Check ONE PIECE Card Game market price, chart, and recent trades for SNKRDUNK product #${id}.`,
      keywords: `SNKRDUNK ${id}, ONE PIECE Card Game price, Card Pone`,
      body: `Market price detail for SNKRDUNK product #${id}.`
    };
  }
  if (path.startsWith('/prices/card/')) {
    const code = path.slice('/prices/card/'.length).toUpperCase();
    return {
      title: `${code} Price | Card Pone`,
      h1: `${code} Price`,
      description: `Check ONE PIECE Card Game market candidates and prices for ${code}.`,
      keywords: `${code}, ONE PIECE Card Game price, Card Pone`,
      body: `Market price candidates for ${code}.`
    };
  }
  if (path.startsWith('/prices/box/')) {
    const code = path.slice('/prices/box/'.length).toUpperCase();
    return {
      title: `${code} Box Price | Card Pone`,
      h1: `${code} Box Price`,
      description: `Check ONE PIECE Card Game booster box price for ${code}.`,
      keywords: `${code} box price, ONE PIECE Card Game box, Card Pone`,
      body: `Booster box market price for ${code}.`
    };
  }
  if (path === '/guide/card-storage') {
    return {
      title: '원피스카드 보관 방법 | 슬리브, 탑로더, 바인더 보관 가이드 | Card Pone',
      h1: '원피스카드 보관 방법',
      description: '원피스카드 보관 방법을 슬리브, 탑로더, 카드세이버, 자석케이스, 바인더 기준으로 정리했습니다. 습기, 빛, 압력, 스크래치로부터 카드를 보호하는 방법을 확인하세요.',
      keywords: '원피스카드 보관 방법, 원피스카드 슬리브, 원피스카드 탑로더, 카드세이버, 카드 바인더, 카드 보관용품',
      body: '원피스카드를 장기 보관할 때 필요한 슬리브, 탑로더, 카드세이버, 바인더 사용 방법과 주의점을 정리한 가이드입니다.'
    };
  }
  if (path === '/guide/shops') {
    return {
      title: '원피스카드 사는 방법 | 공인점포, 취급점포, 구매처 찾기 | Card Pone',
      h1: '원피스카드 사는 방법',
      description: '원피스카드 파는 곳을 공식 홈페이지 기준 공인점포와 취급점포로 정리했습니다. 지역별 검색, 내 주변순 정렬, 네이버지도와 카카오맵 바로가기를 확인하세요.',
      keywords: '원피스카드 사는 방법, 원피스카드 파는 곳, 원피스카드 구매처, 원피스카드 공인점포, 원피스카드 취급점포',
      body: '원피스카드 구매처를 지역별로 찾고 가까운 매장 순서로 확인할 수 있는 구매 가이드입니다.'
    };
  }
  if (path === '/guide/card-price') {
    return {
      title: '원피스카드 시세 보는 방법 | 카드 가격, 박스 가격, 거래 기록 | Card Pone',
      h1: '원피스카드 시세 보는 방법',
      description: '원피스카드 시세를 일련번호, 카드 버전, A등급, PSA10, 최근 거래 기록과 기간별 그래프로 확인하는 방법을 정리했습니다.',
      keywords: '원피스카드 시세, 원피스카드 가격, 원피스카드 박스 시세, 원피스카드 PSA10, 원피스카드 거래 가격',
      body: '원피스카드 카드별 시세와 박스 가격, 최근 거래 기록, 기간별 그래프를 확인하는 방법을 정리한 가이드입니다.'
    };
  }
  if (path === '/guide/card-catalog') {
    return {
      title: '원피스카드 도감 사용법 | 한글판, 일본판, 일련번호 검색 | Card Pone',
      h1: '원피스카드 도감 사용법',
      description: '원피스카드 도감에서 한글판과 일본판 카드, OP/EB/ST/PR 시리즈, 일련번호와 카드명 검색을 사용하는 방법을 정리했습니다.',
      keywords: '원피스카드 도감, 원피스카드 일련번호, 원피스카드 카드번호, 일본판 원피스카드 도감, 한글판 원피스카드 도감',
      body: '원피스카드 도감에서 시리즈, 일련번호, 카드명, 언어별 카드를 찾는 방법을 정리한 가이드입니다.'
    };
  }
  if (path.startsWith('/guide/')) {
    const slug = path.slice('/guide/'.length).replace(/-/g, ' ');
    return {
      title: `OPTCG Guide - ${slug} | Card Pone`,
      h1: 'OPTCG Guide',
      description: `ONE PIECE Card Game guide for ${slug}.`,
      keywords: `OPTCG guide, ONE PIECE Card Game ${slug}`,
      body: 'Guide content for ONE PIECE Card Game collectors.'
    };
  }
  if (path.startsWith('/faq/')) {
    const slug = path.slice('/faq/'.length).replace(/-/g, ' ');
    return {
      title: `OPTCG FAQ - ${slug} | Card Pone`,
      h1: 'OPTCG FAQ',
      description: `Frequently asked questions about ONE PIECE Card Game ${slug}.`,
      keywords: `OPTCG FAQ, ONE PIECE Card Game ${slug}`,
      body: 'FAQ content for ONE PIECE Card Game collectors.'
    };
  }
  return null;
}

function getPageFromPath(pathname = '/') {
  return getRouteSeoPage(pathname);
}

function getRouteBackInfo(pathname = '/', search = '') {
  const path = getAppPath(pathname);
  const hasSearch = Boolean(String(search || '').replace(/^\?/, ''));
  if (path === '/admin/analytics') return { page: 'home' };
  if (path.startsWith('/shops/partners/')) return { page: 'partnerShops' };
  if (path === '/shops/partners') return { page: 'shops' };
  if (path === '/' || (['/cards', '/prices', '/community', '/calendar', '/news', '/shops', '/market'].includes(path) && !hasSearch)) return null;
  if (path.startsWith('/cards')) return { page: 'cards' };
  if (path.startsWith('/guides/series/')) return { page: 'cards' };
  if (path.startsWith('/prices') || (path === '/prices' && hasSearch)) return { page: 'prices' };
  if (path.startsWith('/community')) return { page: 'community' };
  if (path === '/tools/profit-calculator') return { page: 'home' };
  if (path === '/guides/profit-calculator') return { page: 'profitCalculator' };
  if (path === '/tools/portfolio-calculator') return { page: 'lab' };
  if (path === '/guides/portfolio-calculator') return { page: 'portfolioCalculator' };
  if (path === '/guides/centering') return { page: 'centering' };
  if (path === '/guides/pack-simulator') return { page: 'packSimulator' };
  if (path === '/guides/deck-builder') return { page: 'deckLab' };
  if (path === '/lab/decks/builder') return { page: 'deckLab' };
  if (path === '/lab/decks') return { page: 'deckLab' };
  if (path.startsWith('/lab')) return { page: 'lab' };
  if (path.startsWith('/news') || path.startsWith('/guide') || path.startsWith('/faq')) return { page: 'news' };
  if (path.startsWith('/shops')) return { page: 'shops' };
  if (path.startsWith('/market')) return { page: 'marketplace' };
  if (['/about', '/data-policy', '/terms', '/privacy'].includes(path)) return { page: 'home' };
  return null;
}

function getRouteBackLabel(uiLang = 'KR') {
  if (uiLang === 'EN') return 'Back';
  if (uiLang === 'JP') return '戻る';
  return '뒤로가기';
}

function getCanonicalUrl(page) {
  if (typeof window !== 'undefined') {
    const currentPath = normalizeSitePath(window.location.pathname);
    if (getRouteSeoPage(currentPath) === page) return `${SITE_ORIGIN}${currentPath === '/' ? '/' : currentPath}`;
  }
  return `${SITE_ORIGIN}${PAGE_PATHS[page] || '/'}`;
}

function setHeadMeta(selector, attrs) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    const name = selector.match(/\[(name|property|rel)="([^"]+)"\]/);
    if (name) el.setAttribute(name[1], name[2]);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
}

function setJsonLd(id, data) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function getPageJsonLd(page, seo, uiLang = 'KR') {
  const url = getCanonicalUrl(page);
  const breadcrumb = [
    { '@type': 'ListItem', position: 1, name: 'Card Pone', item: SITE_ORIGIN },
    { '@type': 'ListItem', position: 2, name: seo.h1, item: url }
  ];
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Card Pone',
      alternateName: ['카드포네', '카드 포네'],
      url: SITE_ORIGIN
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'Card Pone',
      alternateName: ['카드포네', '카드 포네', '원피스카드 도감', '원피스카드 시세'],
      url: SITE_ORIGIN,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` }
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: seo.title,
      description: seo.description,
      inLanguage: uiLang === 'JP' ? 'ja-JP' : uiLang === 'EN' ? 'en-US' : 'ko-KR',
      about: seo.keywords,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` }
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: breadcrumb
    }
  ];
  if (page === 'shops') {
    graph.push({
      '@type': 'ItemList',
      name: '원피스 카드 구매처 목록',
      description: seo.description,
      url
    });
  }
  if (page === 'partnerShops') {
    const { shop } = typeof window !== 'undefined' ? getPartnerShopRoute(window.location.pathname) : { shop: null };
    if (shop) {
      graph.push({
        '@type': 'LocalBusiness',
        name: shop.titleEn || shop.titleKr,
        image: shop.imageUrl ? `${SITE_ORIGIN}${shop.imageUrl}` : undefined,
        address: shop.bodyKr || shop.bodyEn,
        openingHours: shop.metaKr || shop.metaEn,
        url,
        sameAs: (shop.actions || []).map((action) => action.href).filter(Boolean)
      });
    } else {
      graph.push({
        '@type': 'ItemList',
        name: 'Card Pone 제휴 카드샵',
        description: seo.description,
        url,
        itemListElement: PARTNER_AD_ITEMS.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.titleEn || item.titleKr,
          url: `${SITE_ORIGIN}${getPartnerShopUrl(item)}`
        }))
      });
    }
  }
  if (page === 'news') {
    graph.push({
      '@type': 'FAQPage',
      name: 'Card Pone 이용 가이드',
      mainEntity: GUIDE_QA_GROUPS.flatMap((group) => group.items).slice(0, 10).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    });
    graph.push({
      '@type': 'Article',
      headline: 'Card Pone 업데이트 안내',
      description: seo.description,
      author: { '@type': 'Organization', name: 'Card Pone' },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      mainEntityOfPage: url
    });
  }
  if (['profitCalculator', 'portfolioCalculator', 'centering', 'packSimulator'].includes(page)) {
    graph.push({
      '@type': 'WebApplication',
      name: seo.h1,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      url,
      description: seo.description
    });
  }
  if (page === 'profitGuide') {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: getProfitCalculatorFaq(uiLang).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    });
  }
  if (page === 'portfolioCalculatorGuide') {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: getPortfolioCalculatorFaq(uiLang).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    });
  }
  if (['centeringGuide', 'packSimulatorGuide', 'deckGuide'].includes(page)) {
    const guideType = page === 'centeringGuide'
      ? 'centering'
      : page === 'packSimulatorGuide'
        ? 'packSimulator'
        : 'deckBuilder';
    graph.push({
      '@type': 'FAQPage',
      mainEntity: getLabToolGuideContent(guideType, uiLang).faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function setHreflangLinks() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  document.head.querySelectorAll('link[data-card-pone-hreflang]').forEach((element) => element.remove());
  const path = getAppPath(window.location.pathname);
  const baseHref = `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
  const japaneseHref = `${SITE_ORIGIN}${JAPANESE_ROUTE_PREFIX}${path === '/' ? '' : path}`;
  [
    ['ko', baseHref],
    ['ja', japaneseHref],
    ['x-default', baseHref]
  ].forEach(([hrefLang, href]) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = hrefLang;
    link.href = href;
    link.dataset.cardPoneHreflang = 'true';
    document.head.appendChild(link);
  });
}

function applyPageSeo(page, uiLang = 'KR') {
  const seo = getClientRouteSeo(page, uiLang) || PAGE_SEO[page] || PAGE_SEO.home;
  const url = getCanonicalUrl(page);
  const isJapanese = uiLang === 'JP' || (typeof window !== 'undefined' && getPathLocale(window.location.pathname) === 'JP');
  document.title = seo.title;
  document.documentElement.lang = isJapanese ? 'ja' : uiLang === 'EN' ? 'en' : 'ko';
  setHeadMeta('meta[name="description"]', { content: seo.description });
  setHeadMeta('meta[name="keywords"]', { content: seo.keywords || '' });
  setHeadMeta('link[rel="canonical"]', { rel: 'canonical', href: url });
  setHeadMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  setHeadMeta('meta[property="og:locale"]', { property: 'og:locale', content: isJapanese ? 'ja_JP' : uiLang === 'EN' ? 'en_US' : 'ko_KR' });
  setHeadMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
  setHeadMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
  setHeadMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  setHeadMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Card Pone' });
  setHeadMeta('meta[property="og:image"]', { property: 'og:image', content: `${SITE_ORIGIN}/og-card-pone.jpg` });
  setHeadMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  setHeadMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
  setHeadMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
  setHeadMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: `${SITE_ORIGIN}/og-card-pone.jpg` });
  setHreflangLinks();
  setJsonLd('optcg-page-jsonld', getPageJsonLd(page, seo, isJapanese ? 'JP' : uiLang));
}

const TERMS_SECTIONS = [
  ['제1조 목적', '본 약관은 Card Pone가 제공하는 카드 도감, 시세 확인, 컬렉션 관리 및 관련 서비스의 이용 조건과 절차를 정함을 목적으로 합니다.'],
  ['제2조 서비스의 성격', '본 사이트는 원피스 카드게임 유저를 위한 비공식 정보 제공 서비스입니다.\n본 사이트는 BANDAI, ONE PIECE CARD GAME 공식 유통사 및 관련 권리자와 제휴되어 있지 않습니다.'],
  ['제3조 제공 서비스', '본 서비스는 웹사이트와 Android 앱에서 카드 정보, 카드 시세, 컬렉션 관리, 위시리스트, 시세 알림, 커뮤니티, 출석 및 포인트 등의 기능을 제공할 수 있습니다.'],
  ['제4조 시세 정보의 이용', '본 사이트에서 제공하는 시세 정보는 외부 거래 플랫폼, 공개 정보 또는 자체 수집 데이터를 기반으로 한 참고용 정보입니다.\n실제 거래 가격과 차이가 있을 수 있으며, 카드 구매·판매·투자 판단의 책임은 이용자 본인에게 있습니다.'],
  ['제5조 회원 및 계정', '신규 회원가입은 카카오톡 또는 Google 소셜 로그인을 통해 제공됩니다. 기존 이메일 계정은 계속 로그인할 수 있습니다.\n이용자는 본인의 계정 정보를 안전하게 관리해야 하며, 마이페이지의 계정 삭제 기능을 통해 언제든지 탈퇴할 수 있습니다.'],
  ['제6조 금지행위', '이용자는 다음 행위를 해서는 안 됩니다.\n- 사이트의 정상적인 운영을 방해하는 행위\n- 허위 정보 입력 또는 타인의 계정 도용\n- 무단 크롤링, 자동화 프로그램을 이용한 과도한 접근\n- 저작권, 상표권 등 제3자의 권리를 침해하는 행위\n- 기타 법령 또는 공서양속에 반하는 행위'],
  ['제7조 광고 및 제휴', '본 사이트에는 Google AdSense 등 제3자 광고 서비스 또는 제휴 링크가 포함될 수 있습니다.\n광고 및 제휴 링크를 통해 발생하는 외부 사이트 이용에 대해서는 해당 외부 사이트의 정책이 적용됩니다.\n본 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.'],
  ['제8조 저작권 및 지식재산권', '본 사이트의 디자인, 데이터 구성, 자체 제작 콘텐츠의 권리는 운영자에게 있습니다.\nONE PIECE CARD GAME 및 관련 이미지, 명칭, 상표의 권리는 각 권리자에게 있습니다.'],
  ['제9조 서비스 변경 및 중단', '운영자는 서비스 개선, 유지보수, 외부 데이터 제공처 변경 등의 사유로 서비스의 일부 또는 전부를 변경하거나 중단할 수 있습니다.'],
  ['제10조 책임의 제한', '운영자는 제공 정보의 정확성, 완전성, 최신성을 보장하지 않습니다.\n이용자가 본 사이트의 정보를 바탕으로 한 거래, 구매, 판매, 투자 판단으로 입은 손해에 대해 운영자는 책임을 지지 않습니다.'],
  ['제11조 문의', '서비스 이용과 관련한 문의는 아래 이메일로 접수할 수 있습니다.\n이메일: optkr26@gmail.com']
];

const PRIVACY_SECTIONS = [
  ['1. 수집하는 개인정보 항목', '본 서비스는 기능 제공을 위해 다음 정보를 수집할 수 있습니다.\n- 계정 정보: 이메일, 아이디, 닉네임, 소셜 로그인 제공자의 계정 식별자 및 프로필 정보\n- 서비스 이용 정보: 보유 카드, 위시리스트, 컬렉션 정보, 시세 알림 조건\n- 커뮤니티 정보: 게시글, 댓글, 업로드 이미지, 좋아요, 출석 및 포인트 내역\n- 알림 정보: Android 앱의 푸시 알림 기기 토큰 및 알림 수신 상태\n- 자동 수집 정보: 접속 IP, 브라우저·앱·기기 정보, 접속 기록, 쿠키\n- 문의 시 수집 정보: 이메일 주소, 문의 내용\n센터링 측정을 위해 카메라 권한을 요청할 수 있으나, 촬영 이미지는 기기 안에서만 분석하며 서버로 수집·저장·전송하지 않습니다.'],
  ['2. 개인정보의 이용 목적', '수집한 개인정보는 다음 목적으로 이용됩니다.\n- 회원 식별 및 로그인 기능 제공\n- 컬렉션 관리, 위시리스트, 보유 카드 저장 기능 제공\n- 커뮤니티 운영, 출석 확인 및 포인트 중복 적립 방지\n- 서비스 이용 기록 관리 및 부정 이용 방지\n- 문의 응대 및 공지사항 전달\n- 서비스 개선 및 통계 분석\n- 광고 표시 및 광고 성과 분석'],
  ['3. 개인정보의 보유 및 이용 기간', '개인정보는 서비스 제공 목적이 달성될 때까지 보관합니다. 이용자는 웹과 앱의 마이페이지에서 계정을 직접 삭제할 수 있으며, 탈퇴 시 계정 정보, 컬렉션, 커뮤니티 활동, 출석·포인트, 시세 알림과 푸시 토큰을 지체 없이 삭제합니다.\n다만 관련 법령에 따라 보관이 필요한 정보는 해당 기간 동안 분리 보관할 수 있습니다.'],
  ['4. 쿠키 및 광고 서비스 이용', '본 사이트는 서비스 이용 분석, 사용자 편의 제공 및 광고 표시를 위해 쿠키를 사용할 수 있습니다.\nGoogle과 광고 파트너는 이용자의 이전 방문 기록을 바탕으로 광고를 제공하기 위해 쿠키를 사용할 수 있습니다. 이용자는 Google 광고 설정(https://adssettings.google.com/)에서 맞춤 광고를 관리할 수 있으며, Google의 광고 데이터 이용 방식은 https://policies.google.com/technologies/ads 에서 확인할 수 있습니다.\n브라우저 설정에서 쿠키를 거부하거나 삭제할 수 있으나 일부 서비스 이용이 제한될 수 있습니다. Google 광고가 동의 대상 지역에서 제공되는 경우 Google 인증 동의 관리 도구를 적용합니다.'],
  ['5. 개인정보의 제3자 제공', '본 사이트는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.\n다만 법령에 따른 요청이 있거나 이용자의 동의가 있는 경우에는 예외로 합니다.'],
  ['6. 개인정보 처리의 위탁', '본 서비스는 운영을 위해 다음 외부 서비스를 사용할 수 있습니다.\n- Supabase: 회원 인증, 계정 및 컬렉션 데이터 저장\n- Kakao Login, Google Identity 및 Naver Login: 소셜 로그인 제공\n- Firebase Cloud Messaging: Android 푸시 알림 전송\n- Cloudflare: 웹·API 제공 및 보안\n- Google AdSense: 웹사이트 광고 제공\n사용하는 서비스가 변경될 경우 본 방침을 통해 안내합니다.'],
  ['7. 이용자의 권리', '이용자는 언제든지 본인의 개인정보를 조회·수정하거나 마이페이지에서 계정을 삭제할 수 있습니다. 별도 요청이 필요한 경우 아래 이메일로 접수할 수 있습니다.\n이메일: optkr26@gmail.com'],
  ['8. 개인정보 보호책임자', '개인정보 관련 문의는 아래 연락처로 문의할 수 있습니다.\n운영자: Card Pone\n이메일: optkr26@gmail.com'],
  ['9. 개인정보처리방침 변경', '본 개인정보처리방침은 법령, 서비스 변경 사항에 따라 수정될 수 있으며, 변경 시 사이트 공지사항 또는 본 페이지를 통해 안내합니다.\n시행일: 2026년 8월 11일']
];

const STATIC_INFO_PAGES = {
  about: {
    title: '서비스 안내',
    lead: 'Card Pone는 원피스 카드게임의 카드 정보와 수집 기능을 한곳에 모은 비공식 서비스입니다.',
    sections: [
      {
        title: '제공하는 기능',
        body: [
          '한글판·일본판 카드 도감과 시세, 보유 카드 관리, 일정, 구매처 정보를 제공합니다.',
          '센터링 측정기, 카드깡 시뮬레이터, 수익률 계산기와 덱 빌더는 실험실에서 이용할 수 있습니다.'
        ]
      },
      {
        title: '운영 목적',
        body: [
          '국내 수집가가 언어판별 카드 정보, 공개 시장의 참고 시세, 발매 일정과 구매처를 여러 사이트에서 반복해 찾는 불편을 줄이기 위해 운영합니다.',
          '도감 검색과 시세 비교에 그치지 않고 센터링 측정, 가상 개봉, 덱 구성과 손익 계산처럼 직접 사용할 수 있는 도구를 함께 제공합니다.'
        ]
      },
      {
        title: '편집과 정정 원칙',
        body: [
          '카드와 일정은 확인 가능한 공식 공개 자료를 우선하며, 외부 공지는 원문 링크와 날짜를 함께 표시합니다.',
          '카드번호, 상품 매핑, 가격 기록 또는 매장 정보의 오류가 접수되면 원문과 수집 기록을 대조한 뒤 수정합니다.'
        ]
      },
      {
        title: '독립성 안내',
        body: [
          'Card Pone는 BANDAI 및 ONE PIECE CARD GAME의 공식 서비스가 아니며 카드와 상품의 권리는 각 권리자에게 있습니다.',
          '광고 또는 제휴 여부는 도감 수록, 시세 표시, 구매처 검색 결과와 데이터 정정 기준에 영향을 주지 않습니다.'
        ]
      },
      {
        title: '문의',
        body: ['카드 정보 오류와 서비스 문의는 optkr26@gmail.com 으로 보내주세요.']
      }
    ]
  },
  dataPolicy: {
    title: '데이터 운영 정책',
    lead: 'Card Pone는 공개 자료와 자체 수집 데이터를 기반으로 카드 정보와 시세 정보를 제공합니다.',
    sections: [
      {
        title: '카드 도감 데이터',
        body: [
          '카드 도감은 공식 카드 리스트와 공개적으로 확인 가능한 카드 정보를 기준으로 정리합니다.',
          '같은 일련번호라도 일반판, 패러렐, 프로모, 언어, 재록판이 다를 수 있어 카드별 고유 구분값을 함께 관리합니다.'
        ]
      },
      {
        title: '시세 데이터',
        body: [
          '시세는 SNKRDUNK 등 공개적으로 확인 가능한 거래·상품 정보를 바탕으로 수집 및 정리합니다.',
          'PSA10 통합 시세처럼 외부 플랫폼 데이터가 함께 표시되는 경우 플랫폼명이 함께 노출됩니다.',
          '가격은 환율, 판매 상태, 수수료, 배송비, 플랫폼 정책에 따라 실제 구매·판매 금액과 다를 수 있습니다.'
        ]
      },
      {
        title: '출처 표시와 편집',
        body: [
          '외부 플랫폼 데이터는 출처를 구분해 표시하고, 공식 공지와 상품 일정은 확인 가능한 원문으로 연결합니다.',
          '외부 자료를 그대로 재게시하기보다 카드 검색, 언어판 구분, 거래 조건 비교와 기간별 확인에 필요한 형태로 정리합니다.'
        ]
      },
      {
        title: '갱신과 오류 처리',
        body: [
          '수집 작업이 실패하거나 거래 기록을 확인할 수 없는 경우 임의의 가격이나 거래일을 만들지 않습니다.',
          '오류가 확인된 데이터는 원문과 수집 기록을 다시 대조하며, 수정 전까지 표시를 보류하거나 데이터 없음으로 안내할 수 있습니다.'
        ]
      },
      {
        title: '지수 데이터',
        body: [
          'OPTCG Index는 지정된 카드군의 시세 데이터를 기준화해 만든 참고용 지표입니다.',
          '지수는 투자 권유가 아니며, 수집 시장의 상대적인 가격 흐름을 보기 위한 보조 정보입니다.'
        ]
      },
      {
        title: '데이터 수정 요청',
        body: ['잘못된 카드 정보, 시세 매핑, 구매처 정보가 있는 경우 optkr26@gmail.com 으로 제보할 수 있습니다.']
      }
    ]
  },
  terms: {
    title: '이용약관',
    lead: '본 약관은 Card Pone가 제공하는 카드 도감, 시세 확인, 컬렉션 관리 및 관련 서비스의 이용 조건을 안내합니다.',
    sections: [
      {
        title: '서비스 성격',
        body: [
          'Card Pone는 원피스 카드게임 유저를 위한 비공식 정보 제공 서비스입니다.',
          '본 사이트는 BANDAI, ONE PIECE CARD GAME 공식 유통사 및 권리자와 제휴되어 있지 않습니다.'
        ]
      },
      {
        title: '시세 정보 이용',
        body: [
          '제공되는 시세 정보는 공개 데이터와 자체 수집 데이터를 기반으로 한 참고용 정보입니다.',
          '실제 거래 가격과 차이가 있을 수 있으며, 구매·판매·교환 결정의 책임은 이용자 본인에게 있습니다.'
        ]
      },
      {
        title: '광고 및 제휴',
        body: [
          '본 사이트에는 Google AdSense 등 제3자 광고 서비스 또는 제휴 링크가 포함될 수 있습니다.',
          '본 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
          '광고 및 제휴 링크를 통해 발생하는 외부 사이트 이용에는 해당 외부 사이트의 정책이 적용됩니다.'
        ]
      },
      {
        title: '문의',
        body: ['서비스 이용과 관련한 문의는 optkr26@gmail.com 으로 접수할 수 있습니다.']
      }
    ]
  },
  privacy: {
    title: '개인정보처리방침',
    lead: 'Card Pone는 이용자의 개인정보를 중요하게 생각하며, 서비스 제공에 필요한 범위에서 개인정보를 처리합니다.',
    sections: [
      {
        title: '수집하는 정보',
        list: [
          '계정 정보: 이메일, 아이디, 닉네임, 카카오 또는 Google 계정 식별자와 프로필 정보',
          '서비스 이용 정보: 보유 카드, 위시리스트, 컬렉션 정보, 시세 알림 조건',
          '커뮤니티 정보: 게시글, 댓글, 업로드 이미지, 좋아요, 출석 및 포인트 내역',
          '알림 정보: Android 앱의 푸시 기기 토큰과 알림 수신 상태',
          '자동 수집 정보: 접속 IP, 브라우저·앱·기기 정보, 접속 기록, 쿠키',
          '문의 시 수집 정보: 이메일 주소, 문의 내용'
        ]
      },
      {
        title: '카메라 권한과 촬영 이미지',
        body: [
          '센터링 측정 기능을 사용할 때만 카메라 권한을 요청합니다.',
          '촬영 이미지는 이용자의 기기 안에서 분석하며 Card Pone 서버로 수집, 저장 또는 전송하지 않습니다.'
        ]
      },
      {
        title: '이용 목적',
        list: [
          '회원 식별 및 로그인 기능 제공',
          '컬렉션 관리, 위시리스트, 보유 카드 저장 기능 제공',
          '커뮤니티 운영, 출석 확인 및 포인트 중복 적립 방지',
          '서비스 이용 기록 관리 및 부정 이용 방지',
          '문의 응대 및 서비스 개선',
          '광고 표시 및 광고 성과 분석'
        ]
      },
      {
        title: '광고와 쿠키',
        body: [
          'Google과 광고 파트너는 이전 방문 기록을 바탕으로 광고를 제공하기 위해 쿠키를 사용할 수 있습니다.',
          '브라우저에서 쿠키를 거부하거나 삭제할 수 있으며, Google 광고가 동의 대상 지역에서 제공되는 경우 Google 인증 동의 관리 도구를 적용합니다.'
        ],
        links: [
          { href: 'https://adssettings.google.com/', label: 'Google 광고 설정' },
          { href: 'https://policies.google.com/technologies/ads', label: 'Google 광고 데이터 안내' }
        ]
      },
      {
        title: '외부 서비스',
        body: [
          '본 서비스는 Supabase, Kakao Login, Google Identity, Naver Login, Firebase Cloud Messaging, Cloudflare를 사용하며 웹사이트에서 Google AdSense를 사용할 수 있습니다.',
          '사용하는 외부 서비스가 변경될 경우 본 방침 또는 공지사항을 통해 안내합니다.'
        ]
      },
      {
        id: 'account-deletion',
        title: '계정 및 데이터 삭제',
        body: [
          '로그인 가능한 이용자는 웹과 Android 앱의 마이페이지에서 계정 삭제를 완료할 수 있습니다.',
          '앱을 삭제했거나 로그인할 수 없는 경우 아래 이메일로 계정 이메일과 삭제 요청 사실을 보내 주세요. 본인 확인 후 계정, 컬렉션, 커뮤니티 활동, 출석·포인트, 시세 알림과 푸시 토큰을 삭제합니다.'
        ],
        actionUrl: 'mailto:optkr26@gmail.com?subject=Card%20Pone%20계정%20삭제%20요청',
        actionLabel: '계정 삭제 요청 이메일 보내기'
      },
      {
        title: '방침 변경',
        body: [
          '법령 또는 서비스 변경에 따라 본 방침을 수정할 수 있으며 변경 내용은 본 페이지 또는 공지사항을 통해 안내합니다.',
          '시행일: 2026년 8월 11일'
        ]
      }
    ]
  }
};

function MobileNavIcon({ type }) {
  const paths = {
    home: <><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
    cards: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5a1 1 0 0 1 1 1V5a1 1 0 0 0-1-1h-5a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4a1 1 0 0 0-1 1z" /></>,
    prices: <><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></>,
    marketplace: <><path d="M7 7h11l-3-3" /><path d="M18 7l-3 3" /><path d="M17 17H6l3 3" /><path d="M6 17l3-3" /></>,
    community: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    lab: <><path d="M9 3h6" /><path d="M10 3v6.2L5.6 17A3 3 0 0 0 8.2 21h7.6a3 3 0 0 0 2.6-4L14 9.2V3" /><path d="M8.5 15h7" /></>,
    calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>,
    details: <><path d="M2.1 12a10.2 10.2 0 0 1 19.8 0 10.2 10.2 0 0 1-19.8 0" /><circle cx="12" cy="12" r="3" /></>,
    store: <><path d="M6 2 3 6v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V6l-3-4Z" /><path d="M5 11v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" /><path d="M9 22v-6h6v6" /></>,
    instagram: <><rect width="18" height="18" x="3" y="3" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" /></>,
    external: <><path d="M15 3h6v6" /><path d="m10 14 11-11" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    news: <><path d="M15 18h-5" /><path d="M18 14h-8" /><path d="M18 10h-8" /><path d="M4 22h16a2 2 0 0 0 2-2V4H8a2 2 0 0 0-2 2v14a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" /></>,
    shops: <><path d="M20 10c0 4.5-8 12-8 12S4 14.5 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
    account: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
    supplies: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    dark: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9" />,
    light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[type] || paths.home}
    </svg>
  );
}

function formatNotificationTime(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const pad = (part) => String(part).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getNotificationPayload(item) {
  if (item?.payload_json && typeof item.payload_json === 'object') return item.payload_json;
  try {
    return JSON.parse(item?.payload_json || '{}');
  } catch {
    return {};
  }
}

function RenewNotificationMenu({ notifications, onSelect, onMarkAll }) {
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  return (
    <div className="renew-notification-menu" role="dialog" aria-label="알림 목록">
      <div className="renew-notification-head">
        <div>
          <strong>알림</strong>
          {unreadCount ? <span>새 알림 {unreadCount}개</span> : null}
        </div>
        {unreadCount ? <button type="button" onClick={onMarkAll}>모두 읽음</button> : null}
      </div>
      <div className="renew-notification-list">
        {notifications.map((item) => {
          const payload = getNotificationPayload(item);
          const isPriceAlert = item.type === 'price_alert';
          const context = isPriceAlert
            ? `${payload.conditionKey === 'psa10' ? 'PSA10' : 'Single'} · ${payload.direction === 'above' ? '상승' : '하락'} 알림`
            : '알림';
          const title = payload.cardName || item.title || '알림';
          return (
            <button
              key={item.id}
              type="button"
              className={!item.read_at ? 'is-unread' : ''}
              onClick={() => onSelect(item)}
            >
              <span className="renew-notification-item-meta">
                <span>
                  {!item.read_at ? <i aria-hidden="true" /> : null}
                  <b>{context}</b>
                </span>
                <time dateTime={item.created_at || undefined}>{formatNotificationTime(item.created_at)}</time>
              </span>
              <span className="renew-notification-item-content">
                {payload.previewImageUrl ? <img src={payload.previewImageUrl} alt="" loading="lazy" /> : null}
                <span className="renew-notification-item-copy">
                  <strong className="renew-notification-item-title">{title}</strong>
                  {item.body ? <span className="renew-notification-item-body">{item.body}</span> : null}
                </span>
              </span>
            </button>
          );
        })}
        {!notifications.length ? <div className="renew-notification-empty">새 알림이 없습니다.</div> : null}
      </div>
    </div>
  );
}

function RenewPriceAlertModal({ item, defaultCondition = 'a', currentPrices = {}, isAdmin = false, onClose }) {
  useBodyScrollLock();
  const [rules, setRules] = useState([]);
  const [conditionKey, setConditionKey] = useState(normalizeMarketConditionKey(defaultCondition));
  const [triggerType, setTriggerType] = useState('price');
  const [direction, setDirection] = useState('below');
  const [thresholdInput, setThresholdInput] = useState('');
  const [resolvedPrices, setResolvedPrices] = useState(currentPrices || {});
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pushStatus, setPushStatus] = useState('loading');
  const [pushBusy, setPushBusy] = useState(false);
  const apparelId = Number(item?.apparelId || 0);
  const jpyToKrw = MARKET_USD_TO_KRW / MARKET_USD_TO_JPY;
  const currentPrice = Number(resolvedPrices?.[conditionKey] || 0);

  const loadRules = useCallback(async () => {
    const payload = await fetchPriceAlertRules();
    setRules((payload?.rules || []).filter((rule) => Number(rule.apparelId) === apparelId));
  }, [apparelId]);

  useEffect(() => {
    loadRules().catch(() => setMessage('알림 설정을 불러오지 못했습니다.'));
  }, [loadRules]);

  useEffect(() => {
    let cancelled = false;
    const capability = getPushCapability();
    if (!capability.supported) {
      setPushStatus('unsupported');
      return undefined;
    }
    fetchPushNotificationStatus()
      .then((status) => {
        if (cancelled) return;
        if (!status.configured) setPushStatus('unconfigured');
        else if (status.permission === 'denied') setPushStatus('denied');
        else if (status.permission === 'granted' && status.subscribed) setPushStatus('enabled');
        else setPushStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setPushStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestPushPermission() {
    setPushBusy(true);
    setMessage('');
    try {
      await enablePushNotifications();
      setPushStatus('enabled');
      setMessage('이 기기에서 시세 푸시 알림을 받을 수 있습니다.');
    } catch (error) {
      const code = error?.message || '';
      if (code === 'push_denied' || code === 'push_not_granted') {
        setPushStatus('denied');
        setMessage('알림 권한이 거절되어 시세 알림을 등록할 수 없습니다. 브라우저 설정에서 알림을 허용해 주세요.');
      } else if (code === 'push_unsupported') {
        setPushStatus('unsupported');
      } else {
        setPushStatus('unavailable');
        setMessage('푸시 알림을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function testPushNotification() {
    setPushBusy(true);
    setMessage('');
    try {
      await sendTestPushNotification();
      setMessage('테스트 알림을 이 기기로 전송했습니다.');
    } catch (error) {
      setMessage(error?.message === 'push_test_failed'
        ? '테스트 알림 발송에 실패했습니다. 기기 알림 설정을 확인해 주세요.'
        : '테스트 알림을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!apparelId || Number(resolvedPrices?.a || 0) || Number(resolvedPrices?.psa10 || 0)) return undefined;
    let cancelled = false;
    fetchMarketPrice({ code: item?.code || '', apparelId })
      .then((detail) => {
        if (cancelled) return;
        setResolvedPrices({
          a: Number(getMarketConditionBucket(detail?.latestByCondition, 'a')?.price || 0),
          psa10: Number(getMarketConditionBucket(detail?.latestByCondition, 'psa10')?.price || 0)
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apparelId, item?.code, resolvedPrices?.a, resolvedPrices?.psa10]);

  useEffect(() => {
    if (editingId || thresholdInput) return;
    if (triggerType === 'percent') {
      setThresholdInput('10');
      return;
    }
    if (currentPrice > 0) {
      const targetJpy = direction === 'above' ? currentPrice * 1.1 : currentPrice * 0.9;
      setThresholdInput(String(Math.round(targetJpy * jpyToKrw / 1000) * 1000));
    }
  }, [currentPrice, direction, editingId, jpyToKrw, thresholdInput, triggerType]);

  function resetForm(nextCondition = conditionKey) {
    setEditingId('');
    setConditionKey(nextCondition);
    setTriggerType('price');
    setDirection('below');
    setThresholdInput('');
    setMessage('');
  }

  function editRule(rule) {
    setEditingId(rule.id);
    setConditionKey(rule.conditionKey);
    setTriggerType(rule.triggerType);
    setDirection(rule.direction);
    setThresholdInput(String(rule.triggerType === 'percent'
      ? rule.thresholdValue
      : rule.thresholdDisplayKrw || Math.round(rule.thresholdValue * jpyToKrw)));
    setMessage('');
  }

  async function submitRule(event) {
    event.preventDefault();
    if (pushStatus !== 'enabled') {
      setMessage('먼저 이 기기에서 알림 권한을 허용해 주세요.');
      return;
    }
    const inputValue = Number(thresholdInput || 0);
    if (!inputValue || inputValue <= 0) {
      setMessage('알림 기준값을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await savePriceAlertRule({
        id: editingId || undefined,
        apparelId,
        cardId: item?.cardId || '',
        code: item?.code || '',
        cardName: item?.name || '',
        previewImageUrl: item?.previewImageUrl || '',
        conditionKey,
        triggerType,
        direction,
        thresholdValue: triggerType === 'percent' ? inputValue : Math.round(inputValue / jpyToKrw),
        thresholdDisplayKrw: triggerType === 'price' ? Math.round(inputValue) : null,
        currentPriceJpy: currentPrice || null
      });
      await loadRules();
      resetForm(conditionKey);
      setMessage('가격 알림을 등록했습니다.');
    } catch (error) {
      setMessage(error?.message || '가격 알림 등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(id) {
    setBusy(true);
    setMessage('');
    try {
      await deletePriceAlertRule(id);
      await loadRules();
      if (editingId === id) resetForm();
    } catch (error) {
      setMessage(error?.message || '가격 알림 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <div className="renew-modal-backdrop renew-price-alert-backdrop" onClick={onClose}>
      <section className="renew-price-alert-modal" onClick={(event) => event.stopPropagation()} aria-label="가격 알림 등록">
        <header>
          <div>
            <span>PRICE ALERT</span>
            <h2>{item?.name || item?.code || '카드'} 시세 알림</h2>
            <p>{item?.code || ''}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </header>

        <div className={`renew-alert-permission is-${pushStatus}`}>
          <div>
            <strong>{pushStatus === 'enabled' ? '푸시 알림 사용 중' : '기기 알림 권한'}</strong>
            {pushStatus === 'enabled' ? <p>조건 충족 시 앱 알림함과 이 기기의 알림 배너로 알려드립니다.</p> : null}
            {pushStatus === 'ready' ? <p>알림을 등록하려면 먼저 이 기기에서 알림 수신을 허용해야 합니다.</p> : null}
            {pushStatus === 'denied' ? <p>브라우저에서 알림 권한이 차단되어 있습니다. 사이트 설정에서 알림을 허용한 뒤 다시 열어 주세요.</p> : null}
            {pushStatus === 'unsupported' ? <p>이 환경에서는 웹 푸시를 사용할 수 없습니다. iPhone과 iPad는 Card Pone을 홈 화면에 추가한 뒤 설치된 앱에서 다시 열어 주세요.</p> : null}
            {pushStatus === 'unconfigured' ? <p>푸시 알림 서버 설정을 준비하고 있습니다.</p> : null}
            {pushStatus === 'unavailable' ? <p>푸시 알림 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : null}
            {pushStatus === 'loading' ? <p>이 기기의 알림 상태를 확인하고 있습니다.</p> : null}
          </div>
          {pushStatus === 'ready' ? (
            <button type="button" onClick={requestPushPermission} disabled={pushBusy}>
              {pushBusy ? '연결 중' : '알림 허용'}
            </button>
          ) : null}
          {pushStatus === 'enabled' && isAdmin ? (
            <button type="button" onClick={testPushNotification} disabled={pushBusy}>
              {pushBusy ? '전송 중' : '테스트 알림'}
            </button>
          ) : null}
        </div>

        <form onSubmit={submitRule}>
          <div className="renew-alert-segment" aria-label="가격 조건">
            <button type="button" className={conditionKey === 'a' ? 'is-active' : ''} onClick={() => resetForm('a')}>Single</button>
            <button type="button" className={conditionKey === 'psa10' ? 'is-active' : ''} onClick={() => resetForm('psa10')}>PSA10</button>
          </div>
          <div className="renew-alert-current">
            <span>현재 시세</span>
            <strong>{currentPrice ? formatUsdWonFromYen(currentPrice) : '시세 없음'}</strong>
          </div>
          <div className="renew-alert-segment" aria-label="알림 유형">
            <button type="button" className={triggerType === 'price' ? 'is-active' : ''} onClick={() => { setTriggerType('price'); setThresholdInput(''); setEditingId(''); }}>목표가</button>
            <button type="button" className={triggerType === 'percent' ? 'is-active' : ''} onClick={() => { setTriggerType('percent'); setThresholdInput('10'); setEditingId(''); }}>24시간 등락률</button>
          </div>
          <div className="renew-alert-segment" aria-label="상승 또는 하락">
            <button type="button" className={direction === 'below' ? 'is-active' : ''} onClick={() => { setDirection('below'); setThresholdInput(''); }}>하락</button>
            <button type="button" className={direction === 'above' ? 'is-active' : ''} onClick={() => { setDirection('above'); setThresholdInput(''); }}>상승</button>
          </div>
          <label className="renew-alert-input">
            <span>{triggerType === 'percent' ? '변동률 기준' : '목표 가격'}</span>
            <span>
              <input
                type="number"
                min={triggerType === 'percent' ? '0.1' : '1'}
                max={triggerType === 'percent' ? '100' : undefined}
                step={triggerType === 'percent' ? '0.1' : '1'}
                value={thresholdInput}
                onChange={(event) => setThresholdInput(event.target.value)}
              />
              <em>{triggerType === 'percent' ? '%' : '원'}</em>
            </span>
          </label>
          <button type="submit" className="renew-alert-submit" disabled={busy || !apparelId || pushStatus !== 'enabled'}>
            {editingId ? '알림 수정' : '알림 등록'}
          </button>
          {message ? <p className="renew-alert-message">{message}</p> : null}
        </form>

        <div className="renew-alert-rules">
          <strong>등록된 알림</strong>
          {rules.map((rule) => (
            <div key={rule.id}>
              <button type="button" onClick={() => editRule(rule)}>
                <span>{rule.conditionKey === 'psa10' ? 'PSA10' : 'Single'} · {rule.direction === 'above' ? '상승' : '하락'}</span>
                <strong>{rule.triggerType === 'percent'
                  ? `${rule.thresholdValue}%`
                  : `₩${Number(rule.thresholdDisplayKrw || Math.round(rule.thresholdValue * jpyToKrw)).toLocaleString('ko-KR')}`}</strong>
              </button>
              <button type="button" onClick={() => removeRule(rule.id)} disabled={busy}>삭제</button>
            </div>
          ))}
          {!rules.length ? <p>이 카드에 등록된 알림이 없습니다.</p> : null}
        </div>
      </section>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function RenewHeader({ activePage, onNavigate, onMobileNews, isDark, onToggleTheme, isLoggedIn, isAdmin = false, displayName, onAuthClick, uiLang, onUiLangChange, notifications = [], onNotificationSelect, onNotificationsReadAll }) {
  const t = (key) => getUiText(uiLang, key);
  const isLabActive = ['lab', 'centering', 'centeringGuide', 'packSimulator', 'packSimulatorGuide', 'portfolioCalculator', 'portfolioCalculatorGuide', 'deckLab', 'deckBuilder', 'deckGuide'].includes(activePage);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [mobileLanguageOpen, setMobileLanguageOpen] = useState(false);
  useBodyScrollLock(notificationMenuOpen && isLoggedIn);
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const handleNotificationClick = () => {
    setMobileLanguageOpen(false);
    if (!isLoggedIn) {
      onAuthClick('login');
      return;
    }
    setNotificationMenuOpen((value) => !value);
  };
  const handleAccountClick = () => {
    setMobileLanguageOpen(false);
    if (isLoggedIn) {
      setAccountMenuOpen((value) => !value);
      return;
    }
    onAuthClick('login');
  };
  const handleAccountMenu = (action) => {
    setAccountMenuOpen(false);
    onAuthClick(action);
  };
  return (
    <header className="renew-header" data-nosnippet>
      <div className="renew-mobile-topbar">
        <a href={getLocalizedPagePath('home', uiLang)} className="renew-mobile-logo" onClick={(event) => { event.preventDefault(); onNavigate('home'); }} aria-label="메인으로 이동">
          <img src={LOGO_SRC} alt="Card Pone" />
        </a>
        <div className="renew-mobile-actions">
          <div className={`renew-mobile-language ${mobileLanguageOpen ? 'is-open' : ''}`}>
            <button type="button" onClick={() => { setAccountMenuOpen(false); setNotificationMenuOpen(false); setMobileLanguageOpen((value) => !value); }} aria-label="언어 변경" aria-expanded={mobileLanguageOpen}>
              {uiLang}
            </button>
            {mobileLanguageOpen ? (
              <div className="renew-mobile-language-menu" role="menu" aria-label="언어 선택">
                {['KR', 'EN', 'JP'].map((lang) => (
                  <button key={lang} type="button" className={uiLang === lang ? 'is-active' : ''} onClick={() => { setMobileLanguageOpen(false); onUiLangChange(lang); }} role="menuitem">
                    {lang}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className={`renew-notification-shell ${notificationMenuOpen ? 'is-open' : ''}`}>
            <button type="button" onClick={handleNotificationClick} aria-label="알림">
              <MobileNavIcon type="bell" />
              {unreadCount ? <span className="renew-notification-dot" aria-label={`읽지 않은 알림 ${unreadCount}개`} /> : null}
            </button>
            {notificationMenuOpen && isLoggedIn ? (
              <RenewNotificationMenu
                notifications={notifications}
                onSelect={(item) => { setNotificationMenuOpen(false); onNotificationSelect?.(item); }}
                onMarkAll={() => onNotificationsReadAll?.()}
              />
            ) : null}
          </div>
          <button type="button" onClick={onToggleTheme} aria-label="테마 전환">
            <MobileNavIcon type={isDark ? 'light' : 'dark'} />
          </button>
          <div className={`renew-account-menu ${accountMenuOpen ? 'is-open' : ''}`}>
            <button type="button" onClick={handleAccountClick} aria-label={isLoggedIn ? displayName : t('login')}>
              <MobileNavIcon type="account" />
            </button>
            {isLoggedIn ? (
              <div className="renew-account-dropdown">
                {isAdmin ? <button type="button" onClick={() => { setAccountMenuOpen(false); onNavigate('adminAnalytics'); }}>관리자 통계</button> : null}
                <button type="button" onClick={() => handleAccountMenu('mypage')}>{getLocaleText(uiLang, '마이페이지', 'My page', 'マイページ')}</button>
                <button type="button" onClick={() => handleAccountMenu('logout')}>{t('logout')}</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="renew-nav">
        <a href={getLocalizedPagePath('home', uiLang)} className="renew-logo-button" onClick={(event) => { event.preventDefault(); onNavigate('home'); }} aria-label="메인으로 이동">
          <img src={LOGO_SRC} alt="Card Pone" className="renew-logo" />
        </a>

        <nav className="renew-tabs" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 ? <span className="renew-tab-divider" aria-hidden="true">|</span> : null}
              <a
                href={getLocalizedPagePath(item.id, uiLang)}
                className={`renew-tab ${(item.id === 'lab' ? isLabActive : activePage === item.id) ? 'is-active' : ''}`}
                onClick={(event) => { event.preventDefault(); onNavigate(item.id); }}
              >
                {t(item.labelKey)}
              </a>
            </React.Fragment>
          ))}
        </nav>

        <div className="renew-actions">
          <div className={`renew-account-menu ${accountMenuOpen ? 'is-open' : ''}`}>
            <button type="button" className="renew-pill is-filled renew-account-pill" onClick={handleAccountClick}>
              {isLoggedIn ? displayName : t('login')}
            </button>
            {isLoggedIn ? (
              <div className="renew-account-dropdown">
                {isAdmin ? <button type="button" onClick={() => { setAccountMenuOpen(false); onNavigate('adminAnalytics'); }}>관리자 통계</button> : null}
                <button type="button" onClick={() => handleAccountMenu('mypage')}>{getLocaleText(uiLang, '마이페이지', 'My page', 'マイページ')}</button>
                <button type="button" onClick={() => handleAccountMenu('logout')}>{t('logout')}</button>
              </div>
            ) : null}
          </div>
          <div className={`renew-desktop-language ${mobileLanguageOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="renew-desktop-language-trigger"
              onClick={() => {
                setAccountMenuOpen(false);
                setNotificationMenuOpen(false);
                setMobileLanguageOpen((value) => !value);
              }}
              aria-label="UI language"
              aria-expanded={mobileLanguageOpen}
            >
              <span>{uiLang}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {mobileLanguageOpen ? (
              <div className="renew-desktop-language-menu" role="menu" aria-label="UI language">
                {['KR', 'EN', 'JP'].map((lang) => (
                  <button key={lang} type="button" className={uiLang === lang ? 'is-active' : ''} onClick={() => { setMobileLanguageOpen(false); onUiLangChange(lang); }} role="menuitem">
                    {lang}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className={`renew-notification-shell ${notificationMenuOpen ? 'is-open' : ''}`}>
            <button type="button" className="renew-mode" onClick={handleNotificationClick} aria-label="알림">
              <MobileNavIcon type="bell" />
              {unreadCount ? <span className="renew-notification-dot" aria-label={`읽지 않은 알림 ${unreadCount}개`} /> : null}
            </button>
            {notificationMenuOpen && isLoggedIn ? (
              <RenewNotificationMenu
                notifications={notifications}
                onSelect={(item) => { setNotificationMenuOpen(false); onNotificationSelect?.(item); }}
                onMarkAll={() => onNotificationsReadAll?.()}
              />
            ) : null}
          </div>
          <button type="button" className="renew-mode" onClick={onToggleTheme} aria-label="테마 전환">
            {isDark ? '☀' : '☾'}
          </button>
        </div>
      </div>
      <nav className="renew-bottom-nav" aria-label="모바일 하단 메뉴">
        <a href={getLocalizedPagePath('cards', uiLang)} className={activePage === 'cards' ? 'is-active' : ''} onClick={(event) => { event.preventDefault(); onNavigate('cards'); }} aria-label="도감">
          <MobileNavIcon type="cards" />
          <span>{t('navCards')}</span>
        </a>
        <a href={getLocalizedPagePath('prices', uiLang)} className={activePage === 'prices' ? 'is-active' : ''} onClick={(event) => { event.preventDefault(); onNavigate('prices'); }} aria-label="시세">
          <MobileNavIcon type="prices" />
          <span>{t('navPrices')}</span>
        </a>
        <a href={getLocalizedPagePath('lab', uiLang)} className={isLabActive ? 'is-active' : ''} onClick={(event) => { event.preventDefault(); onNavigate('lab'); }} aria-label="실험실">
          <MobileNavIcon type="lab" />
          <span>{t('navLab')}</span>
        </a>
        <a href={getLocalizedPagePath('news', uiLang)} className={activePage === 'news' ? 'is-active' : ''} onClick={(event) => { event.preventDefault(); onMobileNews(); }} aria-label="정보">
          <MobileNavIcon type="news" />
          <span>{t('navNews')}</span>
        </a>
        <a href={getLocalizedPagePath('shops', uiLang)} className={activePage === 'shops' ? 'is-active' : ''} onClick={(event) => { event.preventDefault(); onNavigate('shops'); }} aria-label="구매처">
          <MobileNavIcon type="shops" />
          <span>{t('navShops')}</span>
        </a>
      </nav>
    </header>
  );
}

function RenewSuppliesModal({ onClose }) {
  useBodyScrollLock();
  return (
    <div className="renew-modal-backdrop" onClick={onClose} data-nosnippet>
      <div className="renew-info-modal renew-supplies-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>카드용품</h2>
            <p>수집 카드 보관에 자주 쓰이는 용품입니다.</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="renew-supplies-modal-grid">
          {COUPANG_PARTNER_ITEMS.map((item) => (
            <a key={item.title} href={item.href} target="_blank" rel="nofollow sponsored noreferrer" className="renew-supplies-modal-item">
              <b>{item.title}</b>
              <span>{item.description}</span>
            </a>
          ))}
        </div>
        <p className="renew-supplies-modal-disclosure">{COUPANG_DISCLOSURE}</p>
      </div>
    </div>
  );
}

function normalizePopularSearchText(value = '') {
  return String(value).normalize('NFKC').toLowerCase().replace(/[^0-9a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣ぁ-んァ-ヶ一-龯]+/g, '');
}

async function resolvePopularSearchItem(query, locale) {
  const normalizedQuery = normalizePopularSearchText(query);
  const matchedBox = boxMarketItems.find((item) => (
    normalizePopularSearchText(item.code) === normalizedQuery
    || normalizePopularSearchText(item.name) === normalizedQuery
  ));
  if (matchedBox) {
    return {
      type: 'box',
      locale: 'JP',
      label: matchedBox.code,
      query: matchedBox.name,
      targetId: String(matchedBox.apparelId)
    };
  }

  try {
    const cards = await searchCards(query, locale);
    const exactCard = cards.find((card) => normalizePopularSearchText(card.cardNo) === normalizedQuery)
      || cards.find((card) => normalizePopularSearchText(card.name) === normalizedQuery);
    if (exactCard) {
      return {
        type: 'card',
        locale: exactCard.locale || locale,
        label: `${exactCard.cardNo} ${exactCard.name}`.trim(),
        query,
        targetId: exactCard.id
      };
    }
  } catch {
    // Search navigation should still work when ranking resolution is unavailable.
  }
  return { type: 'query', locale, label: query, query, targetId: '' };
}

function RenewSearch({ onSubmitSearch, onSelectPopular, visitorToken, uiLang }) {
  const [locale, setLocale] = useState(() => isJapaneseUi(uiLang) ? 'JP' : 'KR');
  const [keyword, setKeyword] = useState('');
  const [popularItems, setPopularItems] = useState([]);
  const [popularOpen, setPopularOpen] = useState(false);
  const [popularIndex, setPopularIndex] = useState(0);
  const popularRef = useRef(null);
  const t = (key) => getUiText(uiLang, key);

  useEffect(() => {
    if (isJapaneseUi(uiLang)) setLocale('JP');
  }, [uiLang]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchPopularSearches()
      .then((payload) => {
        if (!cancelled) setPopularItems(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!popularOpen) return undefined;
    const close = (event) => {
      if (!popularRef.current?.contains(event.target)) setPopularOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [popularOpen]);

  useEffect(() => {
    const itemCount = Math.min(popularItems.length, 10);
    if (itemCount < 2) {
      setPopularIndex(0);
      return undefined;
    }
    setPopularIndex((index) => index % itemCount);
    const timer = window.setInterval(() => {
      setPopularIndex((index) => (index + 1) % itemCount);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [popularItems.length]);

  function submitSearch(event) {
    event.preventDefault();
    const q = keyword.trim();
    if (!q) return;
    onSubmitSearch?.({ locale, q });
    resolvePopularSearchItem(q, locale)
      .then((item) => trackPopularSearch(visitorToken, item))
      .catch(() => {});
  }

  const currentPopular = popularItems[popularIndex];

  return (
    <div className="renew-search-row">
      <form className="renew-search" onSubmit={submitSearch}>
        <div className="renew-locale-switch" aria-label="검색 언어">
          <button type="button" className={locale === 'KR' ? 'is-active' : ''} onClick={() => setLocale('KR')}>{t('searchKr')}</button>
          <button type="button" className={locale === 'JP' ? 'is-active' : ''} onClick={() => setLocale('JP')}>{t('searchJp')}</button>
        </div>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label="카드명 또는 일련번호 검색"
        />
        <button type="submit" className="renew-search-submit" aria-label="검색">↑</button>
      </form>
      <div
        ref={popularRef}
        className={`renew-popular-search${popularOpen ? ' is-open' : ''}`}
      >
        <button type="button" className="renew-popular-trigger" onClick={() => setPopularOpen((value) => !value)} aria-expanded={popularOpen}>
          <span>실시간 인기 검색어</span>
          <strong>
            {currentPopular ? <><em>{popularIndex + 1}위</em>{currentPopular.label}</> : '집계 중'}
          </strong>
          <b aria-hidden="true">⌄</b>
        </button>
        <div className="renew-popular-panel" aria-label="실시간 인기 검색어 순위">
          <div><strong>실시간 인기 검색어</strong><small>최근 24시간</small></div>
          {popularItems.length ? popularItems.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setPopularOpen(false);
                onSelectPopular?.(item);
              }}
            >
              <b>{index + 1}</b>
              <span>{item.label}</span>
            </button>
          )) : <p>검색 데이터 집계 중입니다.</p>}
        </div>
      </div>
    </div>
  );
}

function RenewOfficialLinks({ uiLang }) {
  const items = OFFICIAL_LINK_ITEMS.filter((item) => !item.locales || item.locales.includes(uiLang));
  return (
    <nav className="renew-official-links" aria-label="공식 링크">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target={item.external ? '_blank' : undefined}
          rel={item.external ? 'noreferrer' : undefined}
        >
          {getLocaleText(uiLang, item.labelKr, item.labelEn, item.labelJp)}
        </a>
      ))}
    </nav>
  );
}

const PAGE_SEO_JA = {
  cards: {
    h1: 'ワンピースカード図鑑',
    body: '日本版と韓国版のカードをシリーズ別に確認し、カード名やカード番号から検索できます。'
  },
  prices: {
    h1: 'ワンピースカード相場',
    body: 'カード別の取引価格、ボックス価格、最近の取引履歴と期間別チャートを確認できます。'
  },
  news: {
    h1: 'ワンピースカード情報',
    body: '公式発表をもとに、新商品、プロモーション、イベントの日程と最新情報を確認できます。'
  },
  shops: {
    h1: 'カードショップ・取扱店',
    body: 'ONE PIECE CARD GAMEの取扱店とカードショップを地域別に検索できます。'
  }
};

function RenewSeoSummary({ page, titleAs = 'h1', placement = 'page', uiLang = 'KR' }) {
  const seo = isJapaneseUi(uiLang)
    ? (PAGE_SEO_JA[page] || PAGE_SEO[page] || PAGE_SEO.home)
    : (PAGE_SEO[page] || PAGE_SEO.home);
  const Heading = titleAs;
  return (
    <section className={`renew-seo-summary renew-seo-summary-${page} renew-seo-summary-${placement}`} aria-label={`${seo.h1} 설명`}>
      <Heading>{seo.h1}</Heading>
      <p>{seo.body}</p>
    </section>
  );
}

function savePendingSocialConsent() {
  window.localStorage.setItem(PENDING_SOCIAL_CONSENT_KEY, JSON.stringify({
    acceptedAt: new Date().toISOString(),
    version: AUTH_CONSENT_VERSION
  }));
}

async function applyPendingSocialConsent(user) {
  if (!supabase || !user?.id) return user;
  const rawConsent = window.localStorage.getItem(PENDING_SOCIAL_CONSENT_KEY);
  if (!rawConsent) return user;
  window.localStorage.removeItem(PENDING_SOCIAL_CONSENT_KEY);
  try {
    const consent = JSON.parse(rawConsent);
    const acceptedAt = consent?.acceptedAt || new Date().toISOString();
    const version = consent?.version || AUTH_CONSENT_VERSION;
    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata || {}),
        terms_accepted_at: acceptedAt,
        terms_version: version,
        privacy_accepted_at: acceptedAt,
        privacy_version: version
      }
    });
    if (error) throw error;
    return data?.user || user;
  } catch {
    window.localStorage.setItem(PENDING_SOCIAL_CONSENT_KEY, rawConsent);
    return user;
  }
}

function RenewAuthModal({ onClose, onSignedIn }) {
  useBodyScrollLock();
  const [mode, setMode] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [agreements, setAgreements] = useState({ terms: false, privacy: false });
  const [legalType, setLegalType] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';
  const requiredAgreed = agreements.terms && agreements.privacy;

  useEffect(() => {
    const handleNativeAuth = (event) => {
      if (event.detail?.error) {
        setMessage(event.detail.error);
        return;
      }
      if (event.detail?.user) {
        onSignedIn(event.detail.user);
        onClose();
      }
    };
    window.addEventListener(NATIVE_AUTH_EVENT, handleNativeAuth);
    return () => window.removeEventListener(NATIVE_AUTH_EVENT, handleNativeAuth);
  }, [onClose, onSignedIn]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setPassword('');
    setMessage('');
  }

  function getAuthErrorMessage(error) {
    const raw = String(error?.message || '').trim();
    if (raw === 'consent_required') return '필수 약관에 동의해 주세요.';
    return raw || `${isSignup ? '회원가입' : '로그인'}에 실패했습니다.`;
  }

  async function submitLogin(event) {
    event.preventDefault();
    if (!supabase || !hasSupabaseAuthConfig) {
      setMessage('인증 환경변수가 아직 연결되지 않았습니다.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      if (isSignup) throw new Error('신규 가입은 카카오톡 또는 Google을 이용해 주세요.');
      const data = await signInWithIdentifier(identifier.trim(), password);
      onSignedIn(data?.user || null);
      onClose();
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loginWithKakao() {
    if (!supabase || !hasSupabaseAuthConfig) {
      setMessage('인증 환경변수가 아직 연결되지 않았습니다.');
      return;
    }
    if (isSignup && !requiredAgreed) {
      setMessage('필수 약관에 동의해 주세요.');
      return;
    }
    if (isSignup) savePendingSocialConsent();
    try {
      const { error } = await signInWithSocialProvider('kakao');
      if (error) throw error;
    } catch (error) {
      if (isSignup) window.localStorage.removeItem(PENDING_SOCIAL_CONSENT_KEY);
      setMessage(error.message);
    }
  }

  async function loginWithGoogle() {
    if (!supabase || !hasSupabaseAuthConfig) {
      setMessage('인증 환경변수가 아직 연결되지 않았습니다.');
      return;
    }
    if (isSignup && !requiredAgreed) {
      setMessage('필수 약관에 동의해 주세요.');
      return;
    }
    if (isSignup) savePendingSocialConsent();
    try {
      const { error } = await signInWithSocialProvider('google');
      if (error) throw error;
    } catch (error) {
      if (isSignup) window.localStorage.removeItem(PENDING_SOCIAL_CONSENT_KEY);
      setMessage(error.message);
    }
  }

  async function loginWithNaver() {
    if (!supabase || !hasSupabaseAuthConfig) {
      setMessage('인증 환경변수가 아직 연결되지 않았습니다.');
      return;
    }
    if (isSignup && !requiredAgreed) {
      setMessage('필수 약관에 동의해 주세요.');
      return;
    }
    if (isSignup) savePendingSocialConsent();
    try {
      const { error } = await signInWithSocialProvider('custom:naver');
      if (error) throw error;
    } catch (error) {
      if (isSignup) window.localStorage.removeItem(PENDING_SOCIAL_CONSENT_KEY);
      setMessage(error.message);
    }
  }

  return (
    <>
      <div className="renew-modal-backdrop" onClick={onClose}>
        <div className={`renew-auth-modal${isSignup ? ' is-signup' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{isSignup ? '회원가입' : '로그인'}</h2>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <form className="renew-login-form" onSubmit={submitLogin}>
          <div className="renew-auth-provider-grid">
            <button type="button" className="renew-kakao" onClick={loginWithKakao} disabled={!hasSupabaseAuthConfig} aria-label="카카오톡으로 계속하기">
              카카오톡
            </button>
            <button type="button" className="renew-google" onClick={loginWithGoogle} disabled={!hasSupabaseAuthConfig} aria-label="Google로 계속하기">
              Google
            </button>
            <button type="button" className="renew-naver" onClick={loginWithNaver} disabled={!hasSupabaseAuthConfig} aria-label="네이버로 계속하기">
              네이버
            </button>
          </div>
          {!isSignup ? <div className="renew-divider"><span>기존 계정 로그인</span></div> : null}
          {!isSignup ? (
            <label>
              <span>아이디 또는 이메일</span>
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" />
            </label>
          ) : null}
          {!isSignup ? <label>
            <span>비밀번호</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label> : null}
          {isSignup ? (
            <>
              <p className="renew-auth-social-guide">카카오톡, Google 또는 네이버 계정으로 간편하게 가입할 수 있습니다.</p>
              <div className="renew-auth-consent">
                <label className="renew-auth-consent-all">
                  <input
                    type="checkbox"
                    checked={requiredAgreed}
                    onChange={(event) => setAgreements({ terms: event.target.checked, privacy: event.target.checked })}
                  />
                  <strong>필수 약관 전체 동의</strong>
                </label>
                <label>
                  <input type="checkbox" checked={agreements.terms} onChange={(event) => setAgreements((current) => ({ ...current, terms: event.target.checked }))} />
                  <span>[필수] <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setLegalType('terms'); }}>이용약관</button> 동의</span>
                </label>
                <label>
                  <input type="checkbox" checked={agreements.privacy} onChange={(event) => setAgreements((current) => ({ ...current, privacy: event.target.checked }))} />
                  <span>[필수] <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setLegalType('privacy'); }}>개인정보처리방침</button> 동의</span>
                </label>
              </div>
            </>
          ) : null}
          {message ? <p className="renew-form-message" aria-live="polite">{message}</p> : null}
          {!isSignup ? <button
            type="submit"
            className="renew-submit"
            disabled={loading || !password || !identifier.trim()}
          >
            {loading ? '처리 중...' : '로그인'}
          </button> : null}
          <p className="renew-auth-mode-switch">
            {isSignup ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}
            <button type="button" onClick={() => changeMode(isSignup ? 'login' : 'signup')}>
              {isSignup ? '로그인' : '회원가입'}
            </button>
          </p>
          </form>
        </div>
      </div>
      {legalType ? (
        <div className="renew-modal-backdrop renew-auth-legal-backdrop" onClick={() => setLegalType(null)}>
          <RenewLegalDialog type={legalType} onClose={() => setLegalType(null)} />
        </div>
      ) : null}
    </>
  );
}

function RenewSocialConsentModal({ authUser, onAccepted, onLogout }) {
  useBodyScrollLock();
  const [agreements, setAgreements] = useState({ terms: false, privacy: false });
  const [legalType, setLegalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const requiredAgreed = agreements.terms && agreements.privacy;

  async function acceptConsent() {
    if (!supabase || !authUser?.id || !requiredAgreed || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const acceptedAt = new Date().toISOString();
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(authUser.user_metadata || {}),
          terms_accepted_at: acceptedAt,
          terms_version: AUTH_CONSENT_VERSION,
          privacy_accepted_at: acceptedAt,
          privacy_version: AUTH_CONSENT_VERSION
        }
      });
      if (error) throw error;
      onAccepted(data?.user || authUser);
    } catch (error) {
      setMessage(error?.message || '약관 동의를 저장하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="renew-modal-backdrop renew-social-consent-backdrop">
        <section className="renew-auth-modal renew-social-consent-modal" role="dialog" aria-modal="true" aria-labelledby="social-consent-title">
          <div className="renew-modal-head">
            <div>
              <span>SIGN UP</span>
              <h2 id="social-consent-title">가입 약관 동의</h2>
            </div>
          </div>
          <div className="renew-login-form">
            <p className="renew-auth-social-guide">서비스 이용을 시작하려면 필수 약관에 동의해 주세요.</p>
            <div className="renew-auth-consent">
              <label className="renew-auth-consent-all">
                <input type="checkbox" checked={requiredAgreed} onChange={(event) => setAgreements({ terms: event.target.checked, privacy: event.target.checked })} />
                <strong>필수 약관 전체 동의</strong>
              </label>
              <label>
                <input type="checkbox" checked={agreements.terms} onChange={(event) => setAgreements((current) => ({ ...current, terms: event.target.checked }))} />
                <span>[필수] <button type="button" onClick={() => setLegalType('terms')}>이용약관</button> 동의</span>
              </label>
              <label>
                <input type="checkbox" checked={agreements.privacy} onChange={(event) => setAgreements((current) => ({ ...current, privacy: event.target.checked }))} />
                <span>[필수] <button type="button" onClick={() => setLegalType('privacy')}>개인정보처리방침</button> 동의</span>
              </label>
            </div>
            {message ? <p className="renew-form-message" role="status">{message}</p> : null}
            <button type="button" className="renew-submit" onClick={acceptConsent} disabled={!requiredAgreed || loading}>{loading ? '저장 중...' : '동의하고 시작하기'}</button>
            <button type="button" className="renew-social-consent-logout" onClick={onLogout} disabled={loading}>다른 계정으로 로그인</button>
          </div>
        </section>
      </div>
      {legalType ? (
        <div className="renew-modal-backdrop renew-auth-legal-backdrop" onClick={() => setLegalType(null)}>
          <RenewLegalDialog type={legalType} onClose={() => setLegalType(null)} />
        </div>
      ) : null}
    </>
  );
}

function getPointHistoryLabel(reason, uiLang) {
  if (reason === 'daily_checkin') return getLocaleText(uiLang, '출석체크', 'Daily check-in', '出席チェック');
  if (reason === 'post_created') return getLocaleText(uiLang, '게시글 작성', 'Post published', '投稿作成');
  if (reason === 'post_like') return getLocaleText(uiLang, '게시글 좋아요', 'Post like received', '投稿へのいいね');
  if (reason === 'admin_adjustment') return getLocaleText(uiLang, '운영자 조정', 'Admin adjustment', '管理者調整');
  return getLocaleText(uiLang, '포인트 적립', 'Points', 'ポイント');
}

function formatPointHistoryDate(value, uiLang) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(uiLang === 'JP' ? 'ja-JP' : uiLang === 'EN' ? 'en-US' : 'ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getCommunityMemberGrade(points, uiLang) {
  const current = getCommunityGrade(points);
  const next = current.next;
  return {
    label: getLocaleText(uiLang, current.kr, current.en, current.jp),
    nextLabel: next ? getLocaleText(uiLang, next.kr, next.en, next.jp) : '',
    remaining: current.remaining
  };
}

function RenewAccountModal({ authUser, userState, displayName, uiLang = 'KR', onClose, onLogout, onUserUpdated }) {
  useBodyScrollLock();
  const text = (kr, en, jp) => getLocaleText(uiLang, kr, en, jp);
  const email = authUser?.user_metadata?.naver_email || authUser?.email || '';
  const username = authUser?.user_metadata?.username || email.split('@')[0] || '-';
  const provider = authUser?.app_metadata?.provider || 'email';
  const isSocialAccount = provider !== 'email';
  const [unlocked, setUnlocked] = useState(isSocialAccount);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nickname, setNickname] = useState(displayName || '');
  const [message, setMessage] = useState('');
  const [nicknameNotice, setNicknameNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [pointOverview, setPointOverview] = useState(null);
  const [pointLoading, setPointLoading] = useState(false);

  useEffect(() => {
    if (!unlocked) return undefined;
    let cancelled = false;
    setPointLoading(true);
    fetchCommunityPointOverview()
      .then((overview) => {
        if (!cancelled) setPointOverview(overview || null);
      })
      .catch(() => {
        if (!cancelled) setPointOverview(null);
      })
      .finally(() => {
        if (!cancelled) setPointLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unlocked]);

  useEffect(() => {
    if (!nicknameNotice) return undefined;
    const timer = window.setTimeout(() => setNicknameNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [nicknameNotice]);

  async function unlockAccount(event) {
    event.preventDefault();
    if (!supabase || !email || !currentPassword.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (error) throw error;
      setUnlocked(true);
      setCurrentPassword('');
    } catch (error) {
      setMessage(error?.message || '현재 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function saveNickname() {
    const nextNickname = nickname.trim();
    const currentNickname = String(authUser?.user_metadata?.nickname || '').trim();
    if (!supabase || !nextNickname) return;
    if (nextNickname.length < 2 || nextNickname.length > 20) {
      setNicknameNotice({ type: 'error', message: text('닉네임은 2자 이상 20자 이하로 입력해 주세요.', 'Use 2 to 20 characters.', 'ニックネームは2〜20文字で入力してください。') });
      return;
    }
    setLoading(true);
    setNicknameNotice(null);
    try {
      if (nextNickname.toLowerCase() !== currentNickname.toLowerCase()) {
        const availability = await checkAuthAvailability('nickname', nextNickname);
        if (!availability?.available) throw new Error(text('이미 사용 중인 닉네임입니다.', 'This nickname is already in use.', 'このニックネームは使用されています。'));
      }
      const { data, error } = await supabase.auth.updateUser({
        data: { ...(authUser?.user_metadata || {}), nickname: nextNickname }
      });
      if (error) throw error;
      onUserUpdated(data?.user || null);
      setNicknameNotice({ type: 'success', message: text('닉네임이 변경되었습니다.', 'Nickname updated.', 'ニックネームを変更しました。') });
    } catch (error) {
      setNicknameNotice({ type: 'error', message: error?.message || text('닉네임 변경에 실패했습니다.', 'Could not update nickname.', 'ニックネームを変更できませんでした。') });
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (!newPassword || newPassword !== newPasswordConfirm) {
      setMessage('새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordOpen(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      setMessage('비밀번호가 변경되었습니다.');
    } catch (error) {
      setMessage(error?.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (deleteConfirm.trim() !== '탈퇴') return;
    setLoading(true);
    setMessage('');
    try {
      await deleteMyAccount();
      await supabase?.auth.signOut({ scope: 'local' });
      onUserUpdated(null);
      onClose();
      window.location.assign('/');
    } catch (error) {
      setMessage(error?.message || '계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  const providerLabel = provider === 'kakao'
    ? '카카오'
    : provider === 'google'
      ? 'Google'
      : ['custom:naver', 'naver'].includes(provider)
        ? '네이버'
        : '일반 계정';
  const memberGrade = getCommunityMemberGrade(pointOverview?.totalPoints, uiLang);
  const isAdmin = authUser?.app_metadata?.role === 'admin';

  return (
    <>
      <div className="renew-modal-backdrop" onClick={onClose}>
        <div className="renew-info-modal renew-account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div className="renew-account-title">
            <h2>마이페이지</h2>
            {isAdmin ? <span>ADMIN</span> : null}
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        {!unlocked ? (
          <form className="renew-account-form" onSubmit={unlockAccount}>
            <label>
              <span>현재 비밀번호</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
            </label>
            {message ? <p className="renew-form-message">{message}</p> : null}
            <button type="submit" className="renew-submit" disabled={loading || !currentPassword.trim()}>
              {loading ? '확인 중...' : '확인'}
            </button>
          </form>
        ) : (
          <>
            <section className="renew-account-points" aria-label={text('내 포인트', 'My points', 'マイポイント')}>
              <div className="renew-account-point-stats">
                <div>
                  <span>{text('현재 등급', 'Member grade', '会員ランク')}</span>
                  <strong>{pointLoading ? '-' : memberGrade.label}</strong>
                  {!pointLoading ? (
                    <small className="renew-account-grade-progress">
                      {memberGrade.nextLabel
                        ? text(`다음 ${memberGrade.nextLabel}까지 ${memberGrade.remaining}P`, `${memberGrade.remaining}P to ${memberGrade.nextLabel}`, `次の${memberGrade.nextLabel}まで${memberGrade.remaining}P`)
                        : text('최고 등급', 'Highest grade', '最高ランク')}
                    </small>
                  ) : null}
                </div>
                <div>
                  <span>{text('누적 포인트', 'Total points', '累計ポイント')}</span>
                  <strong>{pointLoading ? '-' : `${Number(pointOverview?.totalPoints || 0).toLocaleString(uiLang === 'EN' ? 'en-US' : uiLang === 'JP' ? 'ja-JP' : 'ko-KR')}P`}</strong>
                </div>
                <div>
                  <span>{text('연속 출석일', 'Check-in streak', '連続出席')}</span>
                  <strong>{pointLoading ? '-' : text(`${Number(pointOverview?.streak || 0)}일`, `${Number(pointOverview?.streak || 0)} days`, `${Number(pointOverview?.streak || 0)}日`)}</strong>
                </div>
              </div>
              <div className="renew-account-point-history">
                <header>
                  <strong>{text('포인트 내역', 'Point history', 'ポイント履歴')}</strong>
                  <small>{text('최근 30건', 'Latest 30', '最新30件')}</small>
                </header>
                {pointLoading ? <p>{text('포인트 내역을 불러오는 중입니다.', 'Loading point history.', 'ポイント履歴を読み込んでいます。')}</p> : null}
                {!pointLoading && !pointOverview ? <p>{text('포인트 정보를 불러오지 못했습니다.', 'Could not load points.', 'ポイント情報を読み込めませんでした。')}</p> : null}
                {!pointLoading && pointOverview && !pointOverview.history?.length ? <p>{text('아직 적립된 포인트가 없습니다.', 'No point activity yet.', 'ポイント履歴はまだありません。')}</p> : null}
                {!pointLoading && pointOverview?.history?.length ? (
                  <ul>
                    {pointOverview.history.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{getPointHistoryLabel(item.reason, uiLang)}</strong>
                          <time>{formatPointHistoryDate(item.createdAt, uiLang)}</time>
                        </div>
                        <b className={item.amount < 0 ? 'is-negative' : ''}>{item.amount > 0 ? '+' : ''}{item.amount}P</b>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
            <div className="renew-account-summary">
              <div>
                <span>닉네임</span>
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
                <button type="button" onClick={saveNickname} disabled={loading || !nickname.trim()}>닉네임 변경</button>
                <small>{text('Card Pone에서 표시할 닉네임입니다.', 'This name is shown on Card Pone.', 'Card Poneで表示するニックネームです。')}</small>
              </div>
              <div>
                <span>아이디</span>
                <strong>{username}</strong>
                <small>아이디는 변경할 수 없습니다.</small>
              </div>
              <div>
                <span>이메일</span>
                <strong>{email || '-'}</strong>
              </div>
              <div>
                <span>로그인 방식</span>
                <strong>{providerLabel}</strong>
              </div>
            </div>
            <div className="renew-account-actions">
              <button type="button" onClick={() => setPasswordOpen(true)} disabled={isSocialAccount}>비밀번호 변경</button>
              <button type="button" onClick={onLogout}>로그아웃</button>
              <button type="button" className="renew-account-delete-button" onClick={() => setDeleteOpen(true)}>계정 삭제</button>
            </div>
            {isSocialAccount ? <p className="renew-account-help">소셜 로그인 계정의 비밀번호는 해당 서비스에서 관리합니다.</p> : null}
            {message ? <p className="renew-form-message renew-account-message">{message}</p> : null}
          </>
        )}
        {passwordOpen ? (
          <div className="renew-password-panel">
            <form onSubmit={changePassword}>
              <label>
                <span>새 비밀번호</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label>
                <span>새 비밀번호 확인</span>
                <input type="password" value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} autoComplete="new-password" />
              </label>
              <div>
                <button type="button" onClick={() => setPasswordOpen(false)}>취소</button>
                <button type="submit" disabled={loading || !newPassword || !newPasswordConfirm}>변경</button>
              </div>
            </form>
          </div>
        ) : null}
        {deleteOpen ? (
          <div className="renew-password-panel renew-account-delete-panel">
            <form onSubmit={deleteAccount}>
              <strong>계정을 삭제하시겠습니까?</strong>
              <p>보유 카드, 위시리스트, 시세 알림과 계정 정보가 삭제되며 복구할 수 없습니다.</p>
              <label>
                <span>확인을 위해 ‘탈퇴’를 입력해 주세요.</span>
                <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} autoComplete="off" />
              </label>
              <div>
                <button type="button" onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}>취소</button>
                <button type="submit" disabled={loading || deleteConfirm.trim() !== '탈퇴'}>계정 삭제</button>
              </div>
            </form>
          </div>
        ) : null}
        </div>
      </div>
      {nicknameNotice ? createPortal(
        <div className={`renew-account-toast is-${nicknameNotice.type}`} role="status" aria-live="polite">
          <span aria-hidden="true">{nicknameNotice.type === 'success' ? '✓' : '!'}</span>
          <strong>{nicknameNotice.message}</strong>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function RenewComingSoonModal({ uiLang, onClose, titleKey = 'deckComingSoonTitle', bodyKey = 'deckComingSoonBody' }) {
  useBodyScrollLock();
  const t = (key) => getUiText(uiLang, key);
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{t(titleKey)}</h2>
            <p>{t(bodyKey)}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label={t('close')}>×</button>
        </div>
      </div>
    </div>
  );
}

function RenewPortfolioEditorModal({ item, initialGrade = 'a', holdings, initialDetail = null, onSave, onDeleteLot, onClose, uiLang }) {
  useBodyScrollLock();
  const text = (kr, en, jp) => getLocaleText(uiLang, kr, en, jp);
  const [grade, setGrade] = useState(normalizeMarketConditionKey(initialGrade));
  const [mode, setMode] = useState('manual');
  const [quantity, setQuantity] = useState(1);
  const [purchaseDate, setPurchaseDate] = useState(getKstDateKey(Date.now()));
  const [currency, setCurrency] = useState(() => isJapaneseUi(uiLang) ? 'JPY' : 'KRW');
  const [unitPrice, setUnitPrice] = useState('');
  const [editingLotId, setEditingLotId] = useState('');
  const [detail, setDetail] = useState(initialDetail);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const holding = findPortfolioHolding(holdings, item, grade);
  const lots = Array.isArray(holding?.purchases) ? holding.purchases : [];
  const estimatePoint = mode === 'estimate' ? findPortfolioEstimatePoint(detail, grade, purchaseDate) : null;
  const estimatePriceJpy = Number(estimatePoint?.price || 0) || 0;
  const manualPriceJpy = convertPortfolioUnitPriceToJpy(unitPrice, currency);
  const unitPriceJpy = mode === 'manual' ? manualPriceJpy : mode === 'estimate' ? estimatePriceJpy : 0;
  const currentPriceJpy = Number(getMarketConditionBucket(detail?.latestByCondition, grade)?.price || item?.price || 0) || 0;
  const projectedPercent = unitPriceJpy > 0 && currentPriceJpy > 0
    ? ((currentPriceJpy / unitPriceJpy) - 1) * 100
    : null;
  const canSave = !saving
    && quantity > 0
    && (mode === 'later' || (mode === 'manual' && manualPriceJpy > 0) || (mode === 'estimate' && estimatePriceJpy > 0));

  useEffect(() => {
    setDetail(initialDetail);
  }, [initialDetail, item?.apparelId]);

  useEffect(() => {
    let cancelled = false;
    if (mode !== 'estimate' || detail || !item?.apparelId) return undefined;
    setDetailLoading(true);
    fetchMarketPrice({ code: item.code, apparelId: item.apparelId })
      .then(async (marketPriceDetail) => {
        if (cancelled) return;
        const psaDetail = item.cardId ? await fetchPsa10MarketPrice(item.cardId).catch(() => null) : null;
        if (!cancelled) setDetail(mergePsa10MarketDetail(marketPriceDetail, psaDetail));
      })
      .catch(() => {
        if (!cancelled) setMessage(text('과거 시세를 불러오지 못했습니다.', 'Could not load historical prices.', '過去の相場を読み込めませんでした。'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, detail, item?.apparelId, item?.code, item?.cardId, uiLang]);

  function resetForm(nextGrade = grade) {
    setGrade(normalizeMarketConditionKey(nextGrade));
    setMode('manual');
    setQuantity(1);
    setPurchaseDate(getKstDateKey(Date.now()));
    setCurrency(isJapaneseUi(uiLang) ? 'JPY' : 'KRW');
    setUnitPrice('');
    setEditingLotId('');
    setMessage('');
  }

  function editLot(lot) {
    setEditingLotId(String(lot.id || ''));
    setMode(lot.mode || 'later');
    setQuantity(Math.max(1, Number(lot.quantity || 1) || 1));
    setPurchaseDate(lot.purchaseDate || getKstDateKey(Date.now()));
    setCurrency(lot.originalCurrency || 'KRW');
    setUnitPrice(lot.originalUnitPrice > 0 ? String(lot.originalUnitPrice) : '');
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setMessage('');
    const existingLot = lots.find((lot) => String(lot.id) === editingLotId);
    const now = new Date().toISOString();
    const lot = {
      id: editingLotId || (globalThis.crypto?.randomUUID?.() || `lot-${Date.now()}`),
      mode,
      quantity,
      purchaseDate: mode === 'later' ? '' : purchaseDate,
      originalCurrency: mode === 'manual' ? currency : 'JPY',
      originalUnitPrice: mode === 'manual' ? Number(unitPrice || 0) : estimatePriceJpy,
      unitPriceJpy,
      referenceDate: mode === 'estimate' ? estimatePoint?.dateKey || '' : '',
      referenceSource: mode === 'estimate' ? estimatePoint?.referenceSource || '' : '',
      createdAt: existingLot?.createdAt || now,
      updatedAt: now
    };
    try {
      await onSave?.({ grade, holdingId: holding?.id || '', lot });
      resetForm(grade);
      setMessage(text('매입 기록을 저장했습니다.', 'Purchase record saved.', '購入記録を保存しました。'));
    } catch (error) {
      setMessage(error?.message || text('저장하지 못했습니다.', 'Failed to save.', '保存できませんでした。'));
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div className="renew-modal-backdrop renew-portfolio-editor-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-portfolio-editor" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <small>PORTFOLIO</small>
            <h2>{text('포트폴리오에 추가', 'Add to Portfolio', 'ポートフォリオに追加')}</h2>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label={text('닫기', 'Close', '閉じる')}>×</button>
        </div>

        <div className="renew-portfolio-editor-card">
          <img src={item?.previewImageUrl || item?.imageUrl || '/card-placeholder.svg'} alt={item?.name || item?.code} onError={placeholderImage} />
          <div>
            <strong>{item?.code}</strong>
            <span>{item?.name || item?.code}</span>
            <small>{item?.setName || ''}</small>
          </div>
        </div>

        <div className="renew-portfolio-grade-tabs" aria-label={text('카드 등급', 'Card grade', 'カードグレード')}>
          {['a', 'psa10'].map((gradeKey) => (
            <button
              key={gradeKey}
              type="button"
              className={grade === gradeKey ? 'is-active' : ''}
              onClick={() => resetForm(gradeKey)}
            >
              {gradeKey === 'a' ? 'Single' : 'PSA10'}
            </button>
          ))}
        </div>

        {lots.length ? (
          <div className="renew-portfolio-lot-history">
            <div className="renew-portfolio-section-title">
              <strong>{text('매입 기록', 'Purchase history', '購入記録')}</strong>
              <span>{lots.length}</span>
            </div>
            {lots.map((lot) => (
              <div key={lot.id} className="renew-portfolio-lot-row">
                <button type="button" className="renew-portfolio-lot-edit" onClick={() => editLot(lot)}>
                  <span>{lot.purchaseDate || text('날짜 미등록', 'Date not set', '日付未入力')}</span>
                  <strong>{lot.quantity}{text('장', ' card(s)', '枚')} · {lot.unitPriceJpy > 0 ? getLocalizedCurrencyText(lot.unitPriceJpy, uiLang) : text('가격 나중에 입력', 'Price later', '価格は後で入力')}</strong>
                  <small>{lot.mode === 'estimate' ? text('날짜 시세 추정', 'Date price estimate', '日付相場から推定') : lot.mode === 'manual' ? text('직접 입력', 'Manual', '直接入力') : text('미입력', 'Pending', '未入力')}</small>
                </button>
                <button type="button" className="renew-portfolio-lot-delete" onClick={() => onDeleteLot?.({ holdingId: holding?.id || '', purchaseId: lot.id })} aria-label={text('매입 기록 삭제', 'Delete purchase record', '購入記録を削除')}>×</button>
              </div>
            ))}
          </div>
        ) : null}

        <form className="renew-portfolio-form" onSubmit={submit}>
          <div className="renew-portfolio-section-title">
            <strong>{editingLotId ? text('매입 기록 수정', 'Edit record', '購入記録を編集') : (lots.length ? text('추가 매입 기록', 'Add another purchase', '追加の購入記録') : text('매입 정보', 'Purchase information', '購入情報'))}</strong>
            {editingLotId ? <button type="button" onClick={() => resetForm(grade)}>{text('수정 취소', 'Cancel edit', '編集を取り消す')}</button> : null}
          </div>
          <div className="renew-portfolio-mode-tabs">
            {[
              ['manual', text('직접 입력', 'Enter price', '価格を入力')],
              ['estimate', text('날짜로 추정', 'Estimate by date', '日付から推定')],
              ['later', text('나중에 입력', 'Later', '後で入力')]
            ].map(([modeKey, label]) => (
              <button key={modeKey} type="button" className={mode === modeKey ? 'is-active' : ''} onClick={() => { setMode(modeKey); setMessage(''); }}>{label}</button>
            ))}
          </div>

          <label className="renew-portfolio-quantity">
            <span>{text('수량', 'Quantity', '数量')}</span>
            <div>
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label={text('수량 줄이기', 'Decrease quantity', '数量を減らす')}>−</button>
              <input type="number" min="1" max="9999" value={quantity} onChange={(event) => setQuantity(Math.min(9999, Math.max(1, Number(event.target.value || 1))))} />
              <button type="button" onClick={() => setQuantity((value) => Math.min(9999, value + 1))} aria-label={text('수량 늘리기', 'Increase quantity', '数量を増やす')}>+</button>
            </div>
          </label>

          {mode !== 'later' ? (
            <label>
              <span>{text('매입 날짜', 'Purchase date', '購入日')}</span>
              <input type="date" value={purchaseDate} max={getKstDateKey(Date.now())} onChange={(event) => setPurchaseDate(event.target.value)} />
            </label>
          ) : null}

          {mode === 'manual' ? (
            <div className="renew-portfolio-price-input">
              <label>
                <span>{text('통화', 'Currency', '通貨')}</span>
                <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  <option value="KRW">KRW ₩</option>
                  <option value="JPY">JPY ¥</option>
                  <option value="USD">USD $</option>
                </select>
              </label>
              <label>
                <span>{text('1장당 매입가', 'Price per card', '1枚あたりの購入価格')}</span>
                <input type="number" min="0" step={currency === 'USD' ? '0.01' : '1'} value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0" />
              </label>
            </div>
          ) : null}

          {mode === 'estimate' ? (
            <div className={`renew-portfolio-estimate ${estimatePriceJpy > 0 ? 'has-price' : ''}`}>
              <small>{text('기준 시세', 'Reference price', '参考相場')}</small>
              <strong>{detailLoading ? text('불러오는 중...', 'Loading...', '読み込み中...') : estimatePriceJpy > 0 ? getLocalizedCurrencyText(estimatePriceJpy, uiLang) : text('이전 7일 내 유효한 시세 기록이 없습니다.', 'No valid price within the previous 7 days', '過去7日以内の有効な相場記録はありません。')}</strong>
              {estimatePoint ? <span>{estimatePoint.dateKey} · {estimatePoint.referenceSource === 'listing' ? 'SNKRDUNK' : text('거래 중앙값', 'Median sale price', '取引中央値')} · {text('추정값', 'Estimate', '推定値')}</span> : null}
            </div>
          ) : null}

          {projectedPercent != null ? (
            <div className="renew-portfolio-preview">
              <span>{text('현재 시세 기준 예상 수익률', 'Estimated return at current price', '現在相場に基づく予想収益率')}</span>
              <strong className={projectedPercent > 0 ? 'is-up' : projectedPercent < 0 ? 'is-down' : ''}>{formatSignedPortfolioPercent(projectedPercent)}</strong>
            </div>
          ) : null}

          {message ? <p className="renew-portfolio-message" aria-live="polite">{message}</p> : null}
          <div className="renew-portfolio-form-actions">
            <button type="button" onClick={onClose}>{text('닫기', 'Close', '閉じる')}</button>
            <button type="submit" disabled={!canSave}>{saving ? text('저장 중...', 'Saving...', '保存中...') : editingLotId ? text('수정 저장', 'Save changes', '変更を保存') : text('추가', 'Add', '追加')}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function RenewHome({ authUser, userState, portfolioHoldings, setPortfolioHoldings, stateLoading, onSubmitSearch, onSelectPopular, visitorToken, onNavigateNews, onOpenIndex, onOpenPrices, uiLang }) {
  const isJp = isJapaneseUi(uiLang);
  const [marketTotalJpy, setMarketTotalJpy] = useState(null);
  const [marketCards, setMarketCards] = useState([]);
  const [valueModalGrade, setValueModalGrade] = useState(null);
  const [portfolioEditorItem, setPortfolioEditorItem] = useState(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [renewalNoticeOpen, setRenewalNoticeOpen] = useState(false);
  const [renewalNoticeChecked, setRenewalNoticeChecked] = useState(false);
  const [partnerNewsOpen, setPartnerNewsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressLocale, setProgressLocale] = useState('KR');
  const [progressData, setProgressData] = useState({ KR: { owned: 0, total: 0, percent: 0, series: [] }, JP: { owned: 0, total: 0, percent: 0, series: [] } });
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceNotice, setAttendanceNotice] = useState('');
  const ownedCount = Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds.length : 0;
  const valuationEntries = (Array.isArray(portfolioHoldings) ? portfolioHoldings : []).map((item) => [item.id, item]);
  const totalJpy = marketTotalJpy ?? 0;
  const aCount = marketCards.length
    ? marketCards.filter((item) => item.grade === 'a').reduce((sum, item) => sum + item.quantity, 0)
    : valuationEntries.filter(([, item]) => item.grade === 'a').reduce((sum, [, item]) => sum + getPortfolioQuantity(item.purchases), 0);
  const psa10Count = marketCards.length
    ? marketCards.filter((item) => item.grade === 'psa10').reduce((sum, item) => sum + item.quantity, 0)
    : valuationEntries.filter(([, item]) => item.grade === 'psa10').reduce((sum, [, item]) => sum + getPortfolioQuantity(item.purchases), 0);
  const portfolioCostJpy = marketCards.reduce((sum, item) => sum + item.costJpy, 0);
  const portfolioCurrentForCostJpy = marketCards.reduce((sum, item) => sum + item.price * item.pricedQuantity, 0);
  const portfolioProfitJpy = portfolioCurrentForCostJpy - portfolioCostJpy;
  const portfolioReturnPercent = portfolioCostJpy > 0 ? (portfolioProfitJpy / portfolioCostJpy) * 100 : null;
  const costCards = marketCards.filter((item) => item.costJpy > 0);

  useEffect(() => {
    let cancelled = false;
    const entries = valuationEntries
      .filter(([, item]) => item?.code && item?.apparelId);
    if (!entries.length) {
      setMarketTotalJpy(null);
      setMarketCards([]);
      return () => {
        cancelled = true;
      };
    }

    const apparelIds = [...new Set(entries.map(([, item]) => Number(item.apparelId)).filter((value) => value > 0))];
    const apparelIdChunks = [];
    for (let index = 0; index < apparelIds.length; index += 200) apparelIdChunks.push(apparelIds.slice(index, index + 200));
    Promise.all(apparelIdChunks.map((chunk) => {
      const params = new URLSearchParams({ summary: 'portfolio', apparelIds: chunk.join(',') });
      return fetch(`/api/market?${params.toString()}`)
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null);
    })).then((summaries) => ({ items: summaries.flatMap((summary) => Array.isArray(summary?.items) ? summary.items : []) }))
      .then((summary) => {
        if (cancelled) return;
        const latestByApparelId = new Map(
          (Array.isArray(summary?.items) ? summary.items : [])
            .filter((item) => item?.apparelId)
            .map((item) => [String(item.apparelId), item])
        );
        const items = entries.map(([key, item]) => {
          const grade = normalizeMarketConditionKey(item.grade || 'a');
          const latest = latestByApparelId.get(String(item.apparelId));
          const livePrice = Number(grade === 'psa10' ? latest?.psa10PriceJpy : latest?.aPriceJpy) || 0;
          const price = livePrice;
          const lots = Array.isArray(item.purchases) ? item.purchases : [];
          const quantity = getPortfolioQuantity(lots);
          const pricedQuantity = getPortfolioPricedQuantity(lots);
          const costJpy = getPortfolioCostJpy(lots);
          const returnPercent = costJpy > 0 && price > 0 && pricedQuantity > 0
            ? (((price * pricedQuantity) - costJpy) / costJpy) * 100
            : null;
          return {
            key,
            id: item.id,
            grade,
            price,
            quantity,
            pricedQuantity,
            costJpy,
            returnPercent,
            lots,
            code: item.code,
            apparelId: item.apparelId,
            cardId: item.cardId || '',
            name: item.name || item.code,
            setName: item.setName || '',
            sourceUrl: item.sourceUrl || '',
            previewImageUrl: item.previewImageUrl || item.imageUrl || '/card-placeholder.svg'
          };
        });
         setMarketCards(items);
         setMarketTotalJpy(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
       });

    return () => {
      cancelled = true;
    };
  }, [portfolioHoldings]);

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

  const modalCards = valueModalGrade ? marketCards : [];
  const t = (key) => getUiText(uiLang, key);
  const portfolioTotalParts = authUser
    ? (isJp
      ? [formatYen(totalJpy)]
      : formatUsdWonFromYen(totalJpy).replace(/^US\s+/, '').split(' / '))
    : [t('portfolioLoginRequired')];
  const homeNewsLinks = useMemo(() => {
    if (!isJp) return getHomeNewsLinks();
    return OFFICIAL_TOPIC_ITEMS
      .filter((item) => (item.locale || '').toUpperCase() === 'JP')
      .slice(0, 3)
      .map((item) => ({
        label: item.category || '公式ニュース',
        description: item.title,
        query: 'section=notice&locale=JP'
      }));
  }, [isJp]);
  const latestPartnerNews = useMemo(() => isJp ? null : getActivePartnerShopNews()[0] || null, [isJp]);

  useEffect(() => {
    if (!authUser?.id) {
      setAttendance(null);
      return undefined;
    }
    let cancelled = false;
    fetchCommunityPointOverview()
      .then((overview) => {
        if (!cancelled) setAttendance(overview || null);
      })
      .catch(() => {
        if (!cancelled) setAttendance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  async function checkInFromHome() {
    if (attendanceLoading || attendance?.checkedToday) return;
    setAttendanceLoading(true);
    setAttendanceNotice('');
    try {
      const status = await checkInCommunityAttendance();
      try {
        setAttendance(await fetchCommunityPointOverview());
      } catch {
        setAttendance((current) => ({ ...(current || {}), ...status }));
      }
      setAttendanceNotice(status?.awarded
        ? getLocaleText(uiLang, '+1P 적립 완료', '+1P awarded', '+1P獲得完了')
        : getLocaleText(uiLang, '오늘 출석 완료', 'Checked in today', '本日は出席済み'));
    } catch {
      setAttendanceNotice(getLocaleText(uiLang, '출석 처리 실패', 'Check-in failed', '出席に失敗しました'));
    } finally {
      setAttendanceLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!RENEWAL_NOTICE_POPUP_ENABLED) {
      setRenewalNoticeOpen(false);
      setRenewalNoticeChecked(true);
      return;
    }
    if (!authUser?.id) {
      setRenewalNoticeOpen(false);
      setRenewalNoticeChecked(true);
      return;
    }
    if (isJp) {
      setRenewalNoticeOpen(false);
      setRenewalNoticeChecked(true);
      return;
    }
    if (!window.localStorage.getItem(RENEWAL_NOTICE_KEY)) {
      window.localStorage.setItem(RENEWAL_NOTICE_KEY, '1');
      setRenewalNoticeOpen(true);
    }
    setRenewalNoticeChecked(true);
  }, [authUser?.id, isJp]);

  useEffect(() => {
    if (!PARTNER_NEWS_POPUP_ENABLED || typeof window === 'undefined' || !latestPartnerNews || !renewalNoticeChecked || renewalNoticeOpen) return;
    const storageKey = `card-pone-partner-news-${latestPartnerNews.id}`;
    if (window.localStorage.getItem(storageKey)) return;
    setPartnerNewsOpen(true);
  }, [latestPartnerNews, renewalNoticeChecked, renewalNoticeOpen]);

  function closePartnerNews() {
    if (typeof window !== 'undefined' && latestPartnerNews) {
      window.localStorage.setItem(`card-pone-partner-news-${latestPartnerNews.id}`, '1');
    }
    setPartnerNewsOpen(false);
  }

  async function saveHomePortfolioLot({ grade, lot }) {
    if (!portfolioEditorItem) return;
    const payload = await savePortfolioPurchase({
      holding: {
        ...portfolioEditorItem,
        grade: normalizeMarketConditionKey(grade)
      },
      purchase: lot
    });
    setPortfolioHoldings(Array.isArray(payload?.holdings) ? payload.holdings : []);
  }

  async function deleteHomePortfolioLot({ purchaseId }) {
    const payload = await deletePortfolioPurchase(purchaseId);
    setPortfolioHoldings(Array.isArray(payload?.holdings) ? payload.holdings : []);
  }

  async function removeValuationCard(holdingId) {
    if (!authUser) {
      window.alert(t('loginRequired'));
      return;
    }
    const payload = await deletePortfolioHolding(holdingId);
    setPortfolioHoldings(Array.isArray(payload?.holdings) ? payload.holdings : []);
  }

  return (
    <main className="renew-home">
      <h1 className="renew-sr-only">{PAGE_SEO.home.h1}</h1>
      <p className="renew-sr-only">{PAGE_SEO.home.body}</p>
      <section className="renew-hero" aria-label="메인 검색">
        <RenewSearch onSubmitSearch={onSubmitSearch} onSelectPopular={onSelectPopular} visitorToken={visitorToken} uiLang={uiLang} />
        <RenewOfficialLinks uiLang={uiLang} />
      </section>

      <section className="renew-dashboard" aria-label={getLocaleText(uiLang, '메인 현황', 'Site overview', 'サイト概要')}>
        <button type="button" className="renew-float-card renew-progress" onClick={() => setProgressOpen(true)}>
          <div className="renew-card-title">{t('progress')}</div>
          {[
            ['KR', getLocaleText(uiLang, '한글판', 'Korean', '韓国版')],
            ['JP', getLocaleText(uiLang, '일본판', 'Japanese', '日本版')]
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
          <div className="renew-value-head">
            <div className="renew-card-title">Portfolio</div>
            <div className="renew-value-head-actions">
              {authUser ? <button type="button" onClick={() => setValueModalGrade('all')}>{getLocaleText(uiLang, '전체 보기', 'View all', 'すべて見る')}</button> : null}
            </div>
          </div>
          <div className="renew-value-total">
            {portfolioTotalParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? <i aria-hidden="true">/</i> : null}
                {part}
              </span>
            ))}
          </div>
          {authUser ? (
            <div className="renew-value-performance">
              <div>
                <span>{getLocaleText(uiLang, '총 평가손익', 'Total return', '評価損益')}</span>
                {portfolioReturnPercent == null ? (
                  <strong className="is-empty">{getLocaleText(uiLang, '매입가 입력 필요', 'Add purchase price', '購入価格の入力が必要です')}</strong>
                ) : (
                  <strong className={portfolioProfitJpy > 0 ? 'is-up' : portfolioProfitJpy < 0 ? 'is-down' : ''}>
                    {isJp ? formatSignedYen(portfolioProfitJpy) : formatSignedWonFromYen(portfolioProfitJpy)} <small>{formatSignedPortfolioPercent(portfolioReturnPercent)}</small>
                  </strong>
                )}
              </div>
              <p>
                {getLocaleText(uiLang, '원가 반영', 'Cost coverage', '購入価格入力済み')} {costCards.length} / {marketCards.length}
              </p>
            </div>
          ) : null}
          <div className="renew-value-grid">
            <button type="button" onClick={() => setValueModalGrade('a')}>
              <span>Single</span>
              <strong>{aCount}</strong>
            </button>
            <button type="button" onClick={() => setValueModalGrade('psa10')}>
              <span>PSA10</span>
              <strong>{psa10Count}</strong>
            </button>
          </div>
          {authUser ? (
            <div className="renew-home-attendance">
              <div>
                <span>{getLocaleText(uiLang, '오늘의 출석', 'Today\'s check-in', '今日の出席')}</span>
                <strong>{attendance?.checkedToday
                  ? getLocaleText(uiLang, '출석 완료', 'Complete', '出席済み')
                  : getLocaleText(uiLang, '매일 1회 +1P', '+1P once a day', '1日1回 +1P')}</strong>
                <small>{getLocaleText(uiLang, `연속 ${Number(attendance?.streak || 0)}일 · ${Number(attendance?.totalPoints || 0).toLocaleString('ko-KR')}P`, `${Number(attendance?.streak || 0)}-day streak · ${Number(attendance?.totalPoints || 0)}P`, `${Number(attendance?.streak || 0)}日連続 · ${Number(attendance?.totalPoints || 0)}P`)}</small>
              </div>
              <button type="button" onClick={checkInFromHome} disabled={attendanceLoading || attendance?.checkedToday}>
                {attendanceLoading
                  ? getLocaleText(uiLang, '처리 중', 'Checking in', '処理中')
                  : attendance?.checkedToday
                    ? getLocaleText(uiLang, '완료', 'Done', '完了')
                    : getLocaleText(uiLang, '출석체크', 'Check in', '出席')}
              </button>
              {attendanceNotice ? <em>{attendanceNotice}</em> : null}
            </div>
          ) : null}
          {MARKET_INDEX_PUBLIC_ENABLED ? <RenewHomeMarketIndex onOpen={onOpenIndex} /> : null}
        </article>

        <article className="renew-float-card renew-home-news">
          <div className="renew-card-title">{getLocaleText(uiLang, '새 소식', 'Latest news', '最新情報')}</div>
          <div className="renew-home-news-list">
            {homeNewsLinks.map((item, index) => (
              <button key={`${item.query}-${item.description}-${index}`} type="button" onClick={() => onNavigateNews?.(item.query)}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <button type="button" className="renew-home-news-more" onClick={() => onNavigateNews?.('section=all')}>
            {getLocaleText(uiLang, '전체 소식 보기', 'View all news', 'すべてのお知らせを見る')}
          </button>
        </article>
      </section>
      {!isJp ? <button type="button" className="renew-home-updates-mini" onClick={() => setUpdatesOpen(true)}>
        <span>업데이트 내역</span>
      </button> : null}
      {valueModalGrade ? (
        <RenewValueModal
          initialGrade={valueModalGrade}
          cards={modalCards}
          onClose={() => setValueModalGrade(null)}
          onRemove={removeValuationCard}
          onEdit={setPortfolioEditorItem}
          uiLang={uiLang}
          onOpenPrices={() => {
            setValueModalGrade(null);
            onOpenPrices?.();
          }}
        />
      ) : null}
      {portfolioEditorItem ? (
        <RenewPortfolioEditorModal
          item={portfolioEditorItem}
          initialGrade={portfolioEditorItem.grade}
          holdings={portfolioHoldings}
          onSave={saveHomePortfolioLot}
          onDeleteLot={deleteHomePortfolioLot}
          onClose={() => setPortfolioEditorItem(null)}
          uiLang={uiLang}
        />
      ) : null}
      {updatesOpen && !isJp ? <RenewUpdateModal onClose={() => setUpdatesOpen(false)} /> : null}
      {renewalNoticeOpen && !isJp ? <RenewalNoticeModal onClose={() => setRenewalNoticeOpen(false)} /> : null}
      {PARTNER_NEWS_POPUP_ENABLED && partnerNewsOpen && latestPartnerNews ? (
        <PartnerShopNewsModal news={latestPartnerNews} uiLang={uiLang} onClose={closePartnerNews} />
      ) : null}
      {progressOpen ? (
        <RenewProgressModal
          progressData={progressData}
          locale={progressLocale}
          onLocaleChange={setProgressLocale}
          onClose={() => setProgressOpen(false)}
          uiLang={uiLang}
        />
      ) : null}
    </main>
  );
}

function RenewPartnerAdSection({ uiLang, placement = 'home' }) {
  const isEn = uiLang === 'EN';
  const getActionPresentation = (action) => {
    const actionKey = `${action?.labelEn || ''} ${action?.href || ''}`.toLowerCase();
    if (actionKey.includes('instagram')) return { icon: 'instagram', label: isEn ? 'Insta' : '인스타' };
    if (actionKey.includes('map.naver') || actionKey.includes('naver.me')) return { icon: 'shops', label: isEn ? 'Map' : '지도' };
    if (actionKey.includes('smartstore')) return { icon: 'store', label: isEn ? 'Store' : '스토어' };
    return { icon: 'external', label: isEn ? action.labelEn : action.labelKr };
  };
  return (
    <section className={`renew-partner-ad${placement === 'shops' ? ' is-in-shops' : ''}`} aria-label={isEn ? 'Partner card shop news' : '제휴 카드샵 소식'}>
      <div className="renew-partner-ad-head">
        <span>{isEn ? 'Partner Shops' : '제휴 카드샵'}</span>
        <a className="renew-partner-ad-contact" href="mailto:optkr26@gmail.com?subject=Card%20Pone%20card%20shop%20partnership">
          {isEn ? 'Contact' : '제휴 문의'}
        </a>
      </div>
      <div className="renew-partner-ad-grid">
        {PARTNER_AD_ITEMS.map((item) => {
          const shopNews = null;
          const shopActions = (item.actions || []).filter((action) => action?.href);
          return (
            <article key={item.key} className={`renew-partner-ad-card${item.imageUrl ? ' has-logo' : ''}`}>
              {item.imageUrl ? (
                <img className="renew-partner-ad-logo" src={item.imageUrl} alt={isEn ? item.titleEn : item.titleKr} loading="lazy" />
              ) : null}
              <div className="renew-partner-ad-copy">
                <small>{isEn ? item.labelEn : item.labelKr}</small>
                <strong>{isEn ? item.titleEn : item.titleKr}</strong>
                <span>{isEn ? item.bodyEn : item.bodyKr}</span>
                {item.metaKr ? <em>{isEn ? item.metaEn : item.metaKr}</em> : null}
              </div>
              {shopNews ? (
                <div className="renew-partner-ad-news">
                  <img src={shopNews.imageUrl} alt={isEn ? shopNews.titleEn : shopNews.titleKr} loading="lazy" />
                  <div>
                    <small>{isEn ? 'Stock News' : '입고소식'}</small>
                    <b>{isEn ? shopNews.titleEn : shopNews.titleKr}</b>
                    <span>{isEn ? shopNews.date : shopNews.date}</span>
                  </div>
                </div>
              ) : null}
              <div className="renew-partner-ad-actions" style={{ '--partner-action-count': shopActions.length + 1 }}>
                <a href={getPartnerShopUrl(item)} onClick={() => rememberCurrentAppView()}>
                  <MobileNavIcon type="details" />
                  <span>{isEn ? 'Details' : '상세'}</span>
                </a>
                {shopActions.map((action) => {
                  const isExternal = action.href.startsWith('http');
                  const presentation = getActionPresentation(action);
                  return (
                  <a key={action.href} href={action.href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
                    <MobileNavIcon type={presentation.icon} />
                    <span>{presentation.label}</span>
                  </a>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RenewPartnerShopSeoPage({ uiLang }) {
  const isEn = uiLang === 'EN';
  const { shop } = getPartnerShopRoute();

  const renderActions = (item) => (
    <div className="renew-partner-seo-actions">
      {(item.actions || []).filter((action) => action?.href).map((action) => {
        const isExternal = action.href.startsWith('http');
        return (
          <a key={action.href} href={action.href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
            {isEn ? action.labelEn : action.labelKr}
          </a>
        );
      })}
    </div>
  );

  if (shop) {
    const shopNews = getActivePartnerShopNews().filter((item) => item.shopKey === shop.key);
    return (
      <main className="renew-subpage renew-partner-seo-main">
        <article className="renew-panel renew-partner-seo-detail">
          <div className="renew-partner-seo-detail-head">
            {shop.imageUrl ? <img src={shop.imageUrl} alt={shop.titleEn || shop.titleKr} loading="lazy" /> : null}
            <div>
              <small>{isEn ? 'Partner card shop' : '제휴 카드샵'}</small>
              <h1>{isEn ? `${shop.titleEn} card shop` : `${shop.titleKr} - 원피스카드 파는곳`}</h1>
              <p>{isEn ? shop.bodyEn : shop.bodyKr}</p>
              {shop.metaKr ? <em>{isEn ? shop.metaEn : shop.metaKr}</em> : null}
            </div>
          </div>
          {renderActions(shop)}
          {shopNews.length ? (
            <section className="renew-partner-seo-news" aria-label={isEn ? 'Shop news' : '카드샵 소식'}>
              <h2>{isEn ? 'Shop News' : '입고소식 / 이벤트'}</h2>
              {shopNews.map((item) => (
                <article key={item.id}>
                  {item.imageUrl ? <img src={item.imageUrl} alt={isEn ? item.titleEn : item.titleKr} loading="lazy" /> : null}
                  <div>
                    <small>{item.date}</small>
                    <strong>{isEn ? item.titleEn : item.titleKr}</strong>
                    <p>{isEn ? item.bodyEn : item.bodyKr}</p>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
          <section className="renew-partner-seo-copy">
            <h2>{isEn ? 'Before visiting' : '방문 전 확인할 점'}</h2>
            <ul>
              <li>{isEn ? 'Check opening hours before visiting.' : '방문 전 영업시간을 확인해 주세요.'}</li>
              <li>{isEn ? 'Use map or Instagram links for current store notices.' : '최신 입고소식과 이벤트는 지도 또는 인스타그램 링크에서 확인할 수 있습니다.'}</li>
              <li>{isEn ? 'Stock and event details may change by store.' : '매장별 재고와 이벤트 내용은 시점에 따라 달라질 수 있습니다.'}</li>
            </ul>
          </section>
        </article>
      </main>
    );
  }

  return (
    <main className="renew-subpage renew-partner-seo-main">
      <RenewPartnerAdSection uiLang={uiLang} placement="shops" />
    </main>
  );
}

const MARKET_INDEX_CONDITION = 'psa10';

const HOME_MARKET_INDEX_OPTIONS = [
  { key: 'manga', label: 'Manga' },
  { key: 'luffy', label: 'Luffy' },
];

function RenewHomeMarketIndex({ onOpen }) {
  const [payloads, setPayloads] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(HOME_MARKET_INDEX_OPTIONS.map(async (option) => {
      const response = await fetch(`/api/market-index?type=${option.key}&condition=${MARKET_INDEX_CONDITION}&range=7d`);
      return [option.key, response.ok ? await response.json() : null];
    }))
      .then((entries) => {
        if (!cancelled) setPayloads(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setPayloads({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = HOME_MARKET_INDEX_OPTIONS
    .map((option) => ({ option, payload: payloads[option.key] }))
    .filter(({ payload }) => payload?.currentValue != null && Number.isFinite(Number(payload.currentValue)));

  if (!items.length) return null;

  return (
    <section className="renew-home-index-summary" aria-label="OPTCG Market Index">
      <span className="renew-home-index-label">Market Index</span>
      <div
        className="renew-home-index-list"
        data-count={items.length}
        style={{ '--market-index-count': items.length }}
      >
        {items.map(({ option, payload }) => (
          <button key={option.key} type="button" onClick={() => onOpen(option.key)} aria-label={`${option.label} Index 바로가기`}>
            <span>{option.label}</span>
            <strong>{formatIndexValue(payload.currentValue)}</strong>
            <em className={indexChangeClass(payload?.change?.d1)}>1D {formatIndexDailyChange(payload?.change?.d1)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatBoxMarketPrice(box) {
  const amount = Number(box?.minPrice || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const currency = String(box?.priceCurrency || box?.currency || '').toUpperCase();
  if (currency === 'KRW') return `₩${Math.round(amount).toLocaleString('ko-KR')}`;
  if (currency === 'JPY') return `¥${Math.round(amount).toLocaleString('ja-JP')}`;
  return formatUsdWonFromUsd(amount);
}

function RenewalNoticeModal({ onClose }) {
  useBodyScrollLock();
  const latestUpdate = VISIBLE_RENEW_HOME_UPDATES[0] || RENEW_HOME_UPDATES[0];
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-announcement-modal" onClick={(event) => event.stopPropagation()}>
        <span>NEWS UPDATE</span>
        <h2>{latestUpdate?.summary || '업데이트 안내'}</h2>
        <ul>
          {(latestUpdate?.details || []).slice(0, 4).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
        <p>{latestUpdate?.title || '[26.06.30] 업데이트 안내'}</p>
        <button type="button" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

function PartnerShopNewsModal({ news, uiLang, onClose }) {
  useBodyScrollLock();
  const isEn = uiLang === 'EN';
  const shop = getPartnerShopByKey(news.shopKey);
  const title = isEn ? news.titleEn : news.titleKr;
  const body = isEn ? news.bodyEn : news.bodyKr;
  const shopName = shop ? (isEn ? shop.titleEn : shop.titleKr) : '';
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-partner-news-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <span className="renew-partner-news-kicker">{isEn ? 'PARTNER SHOP NEWS' : '카드샵 입고소식'}</span>
            <h2>{title}</h2>
            {shopName ? <p>{shopName} · {news.date}</p> : <p>{news.date}</p>}
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label={isEn ? 'Close' : '닫기'}>×</button>
        </div>
        <img className="renew-partner-news-image" src={news.imageUrl} alt={title} />
        <div className="renew-partner-news-copy">
          <p>{body}</p>
        </div>
        <p className="renew-partner-news-note">
          {isEn ? 'For detailed stock availability and purchase questions, please contact the shop through Instagram DM.' : '자세한 입고 수량과 구매 가능 여부는 인스타그램 DM으로 문의해 주세요.'}
        </p>
        {shop?.actions?.length ? (
          <div className="renew-partner-news-actions">
            {shop.actions.filter((action) => action?.href).map((action) => {
              const isExternal = action.href.startsWith('http');
              return (
                <a key={action.href} href={action.href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
                  {isEn ? action.labelEn : action.labelKr}
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RenewProgressModal({ progressData, locale, onLocaleChange, onClose, uiLang }) {
  useBodyScrollLock();
  const text = (kr, en, jp) => getLocaleText(uiLang, kr, en, jp);
  const [progressGroup, setProgressGroup] = useState('OP');
  const current = progressData[locale] || { owned: 0, total: 0, percent: 0, series: [] };
  const progressGroups = ['OP', 'EB', 'ST', 'PR'];
  const visibleSeries = useMemo(
    () => current.series.filter((series) => getProgressSeriesGroup(series) === progressGroup),
    [current.series, progressGroup]
  );
  const modal = (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-progress-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{text('수집 진행도', 'Collection progress', 'コレクション進捗')}</h2>
            <p>{current.owned} / {current.total} · {formatPercent(current.percent)}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label={text('닫기', 'Close', '閉じる')}>×</button>
        </div>
        <div className="renew-progress-detail">
          <div className="renew-progress-locale">
            <button type="button" className={locale === 'KR' ? 'is-active' : ''} onClick={() => onLocaleChange('KR')}>{text('한글판', 'Korean', '韓国版')}</button>
            <button type="button" className={locale === 'JP' ? 'is-active' : ''} onClick={() => onLocaleChange('JP')}>{text('일본판', 'Japanese', '日本版')}</button>
          </div>
          <div className="renew-progress-groups" role="tablist" aria-label={text('시리즈 분류', 'Series category', 'シリーズ分類')}>
            {progressGroups.map((group) => (
              <button
                key={group}
                type="button"
                className={progressGroup === group ? 'is-active' : ''}
                onClick={() => setProgressGroup(group)}
              >
                {group}
              </button>
            ))}
          </div>
          <div className="renew-progress-series-list">
            {visibleSeries.map((series) => (
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
            {!visibleSeries.length ? (
              <div className="renew-progress-empty">{text(`${progressGroup} 시리즈가 없습니다.`, `No ${progressGroup} series found.`, `${progressGroup}シリーズはありません。`)}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function RenewValueModal({ initialGrade = 'all', cards, onClose, onRemove, onEdit, onOpenPrices, uiLang }) {
  useBodyScrollLock();
  const t = (key) => getUiText(uiLang, key);
  const text = (kr, en, jp) => getLocaleText(uiLang, kr, en, jp);
  const [gradeFilter, setGradeFilter] = useState(['a', 'psa10'].includes(initialGrade) ? initialGrade : 'all');
  const [sortMode, setSortMode] = useState('value');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => (window.innerWidth <= 560 ? 8 : 12));
  const imageCacheRef = useRef(loadPortfolioImageCache());
  const filteredCards = cards
    .filter((item) => gradeFilter === 'all' || item.grade === gradeFilter)
    .sort((a, b) => {
      if (sortMode === 'gain') return Number(b.returnPercent ?? -Infinity) - Number(a.returnPercent ?? -Infinity);
      if (sortMode === 'loss') return Number(a.returnPercent ?? Infinity) - Number(b.returnPercent ?? Infinity);
      return Number(b.price || 0) * Number(b.quantity || 1) - Number(a.price || 0) * Number(a.quantity || 1);
    });
  const total = filteredCards.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const totalQuantity = filteredCards.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const pageCount = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const visibleCards = filteredCards.slice(page * pageSize, page * pageSize + pageSize);
  const getImageCacheKey = (item) => `${item.code || ''}::${item.apparelId || ''}`;
  const getValueImageSrc = (item) => {
    const cachedSource = imageCacheRef.current[getImageCacheKey(item)];
    if (cachedSource) return getCardImageSrc({ imageUrl: cachedSource });
    if (!isPlaceholderImageUrl(item.imageUrl)) return item.imageUrl;
    if (!isPlaceholderImageUrl(item.previewImageUrl)) return item.previewImageUrl;
    return '/card-placeholder.svg';
  };

  async function resolveValueImage(item, allowSearchFallback = true) {
    try {
      const approvedLink = await findApprovedCardMarketLinkByApparelId(item.apparelId);
      if (approvedLink?.cardId) {
        const linkedCard = await fetchCardById(approvedLink.cardId);
        const linkedSource = linkedCard?.imageUrl || linkedCard?.image_url || linkedCard?.image;
        if (linkedSource) {
          imageCacheRef.current = { ...imageCacheRef.current, [getImageCacheKey(item)]: linkedSource };
          savePortfolioImageCache(imageCacheRef.current);
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
      imageCacheRef.current = { ...imageCacheRef.current, [getImageCacheKey(item)]: fallbackSource };
      savePortfolioImageCache(imageCacheRef.current);
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
  }, [gradeFilter, sortMode, pageSize]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const modal = (
    <div className="renew-modal-backdrop renew-value-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-value-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>PORTFOLIO</h2>
            <p>{totalQuantity}{text('장', ' card(s)', '枚')} · {getLocalizedCurrencyText(total, uiLang)}</p>
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label={text('닫기', 'Close', '閉じる')}>×</button>
        </div>
        <div className="renew-portfolio-list-tools">
          <div className="renew-portfolio-grade-tabs" aria-label={text('포트폴리오 등급 필터', 'Portfolio grade filter', 'ポートフォリオのグレード絞り込み')}>
            {[
              ['all', text('전체', 'All', 'すべて')],
              ['a', 'Single'],
              ['psa10', 'PSA10']
            ].map(([key, label]) => (
              <button key={key} type="button" className={gradeFilter === key ? 'is-active' : ''} onClick={() => setGradeFilter(key)}>{label}</button>
            ))}
          </div>
          <label>
            <span className="renew-sr-only">{text('포트폴리오 정렬', 'Sort portfolio', 'ポートフォリオを並び替え')}</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="value">{text('평가액 높은 순', 'Highest value', '評価額が高い順')}</option>
              <option value="gain">{text('수익률 높은 순', 'Highest return', '収益率が高い順')}</option>
              <option value="loss">{text('수익률 낮은 순', 'Lowest return', '収益率が低い順')}</option>
            </select>
          </label>
        </div>
        <div className="renew-value-list">
          {filteredCards.length ? visibleCards.map((item) => {
            const itemProfitJpy = item.costJpy > 0 ? item.price * item.pricedQuantity - item.costJpy : null;
            return (
            <article key={item.key} className="renew-value-row">
              <PortfolioValueImage
                item={item}
                src={getValueImageSrc(item)}
                resolveImage={resolveValueImage}
                onError={handleValueImageError}
              />
              <div className="renew-value-row-identity">
                <strong>{item.code}</strong>
                <span>{item.name}</span>
                <small>{item.grade === 'psa10' ? 'PSA10' : 'Single'} · {item.quantity}{text('장', ' card(s)', '枚')}</small>
              </div>
              <div className="renew-value-row-metrics">
                <div className="renew-value-row-metric">
                  <span>{text('현재 평가액', 'Current value', '現在評価額')}</span>
                  <strong>{getLocalizedCurrencyText(item.price * item.quantity, uiLang)}</strong>
                  <small>{text('1장당', 'Per card', '1枚あたり')} {getLocalizedCurrencyText(item.price, uiLang)}</small>
                </div>
                <div className="renew-value-row-metric">
                  <span>{text('평가손익', 'Valuation P/L', '評価損益')}</span>
                  {item.returnPercent == null ? (
                    <strong className="is-empty">{text('매입가 필요', 'Price needed', '購入価格が必要です')}</strong>
                  ) : (
                    <strong className={itemProfitJpy > 0 ? 'is-up' : itemProfitJpy < 0 ? 'is-down' : ''}>{formatSignedPortfolioPercent(item.returnPercent)}</strong>
                  )}
                  <small>{itemProfitJpy == null ? '-' : isJapaneseUi(uiLang) ? formatSignedYen(itemProfitJpy) : formatSignedWonFromYen(itemProfitJpy)}</small>
                </div>
              </div>
              <div className="renew-value-row-actions">
                <button type="button" onClick={() => onEdit?.(item)}>{text('매입 정보', 'Purchase info', '購入情報')}</button>
                <button type="button" className="renew-value-remove" onClick={() => onRemove?.(item.key)} aria-label={text('포트폴리오에서 제거', 'Remove from portfolio', 'ポートフォリオから削除')}>×</button>
              </div>
            </article>
          );
          }) : (
            <div className="renew-empty-note renew-value-empty">
              <p>{t('portfolioEmptyHelp')}</p>
              <button type="button" onClick={onOpenPrices}>{t('goToPrices')}</button>
            </div>
          )}
        </div>
        {filteredCards.length > pageSize ? (
          <div className="renew-update-pager renew-value-pager">
            <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>이전</button>
            <span>{page + 1} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>다음</button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function PortfolioValueImage({ item, src, resolveImage, onError }) {
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    setImageSrc(src);
    if (!isPlaceholderImageUrl(src)) {
      resolveImage(item, true).then((fallbackSrc) => {
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
  }, [item.key, item.code, item.apparelId, src]);

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
    <section id="card-supplies" className="renew-partner-banners" aria-label="카드 보관용품 추천">
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
  useBodyScrollLock();
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const pageCount = Math.ceil(VISIBLE_RENEW_HOME_UPDATES.length / pageSize);
  const items = VISIBLE_RENEW_HOME_UPDATES.slice(page * pageSize, page * pageSize + pageSize);

  const modal = (
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
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function RenewCalendarEventCard({ event, uiLang }) {
  const isEn = uiLang === 'EN';
  const isJp = uiLang === 'JP';
  const displayTitle = getCalendarDisplayTitle(event, uiLang);
  const showOriginalTitle = !isEn && !isJp && event.locale === 'JP' && event.titleKo && event.titleKo !== event.title;
  const kindLabel = event.kind === 'release'
    ? (isJp ? '発売' : isEn ? 'Release' : '발매')
    : event.kind === 'event'
      ? (event.isSchedule ? (isJp ? 'イベント' : isEn ? 'Event' : '이벤트') : (isJp ? 'イベント告知' : isEn ? 'Event notice' : '이벤트 공지'))
      : (isJp ? '商品告知' : isEn ? 'Product notice' : '상품 공지');
  const actionLabel = event.kind === 'release'
    ? (isJp ? '商品を見る' : isEn ? 'View product' : '상품 보기')
    : (isJp ? '元の情報を見る' : isEn ? 'View source' : '원문 보기');
  return (
    <article className={`renew-calendar-event-card is-priority-${event.priority || 'low'}`}>
      <span className={`renew-calendar-event-mark is-${event.kind}`} aria-hidden="true">
        {event.imageUrl ? <img src={getCardImageSrc(event)} alt="" loading="lazy" onError={(error) => { error.currentTarget.hidden = true; }} /> : null}
      </span>
      <div>
        <div className="renew-calendar-event-meta">
          {event.priority === 'high' ? <span className="is-priority">{isJp ? '注目の発売' : isEn ? 'Featured release' : '주요 발매'}</span> : null}
          <span className={`is-${event.kind}`}>{kindLabel}</span>
          <span>{event.locale}</span>
          <small>{event.sourceLabel}</small>
        </div>
        <strong>{displayTitle}</strong>
        {showOriginalTitle ? <small className="renew-calendar-event-original" lang="ja">{event.title}</small> : null}
        <small className="renew-calendar-event-date">{event.endDate ? `${event.date} - ${event.endDate}` : event.date} · {event.category}</small>
      </div>
      {event.url ? <a href={event.url} target={event.url.startsWith('http') ? '_blank' : undefined} rel={event.url.startsWith('http') ? 'noreferrer' : undefined} onClick={() => { if (!event.url.startsWith('http')) rememberCurrentAppView(); }}>{actionLabel}</a> : null}
    </article>
  );
}

function RenewCalendar({ uiLang }) {
  const isEn = uiLang === 'EN';
  const isJp = uiLang === 'JP';
  const dateLocale = isJp ? 'ja-JP' : isEn ? 'en-US' : 'ko-KR';
  const todayKey = getCalendarTodayKey();
  const savedViewState = getAppHistoryState().calendarViewState || {};
  const [monthKey, setMonthKey] = useState(() => /^\d{4}-\d{2}$/.test(savedViewState.monthKey || '') ? savedViewState.monthKey : todayKey.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(savedViewState.selectedDate || '') ? savedViewState.selectedDate : todayKey);
  const [localeFilter, setLocaleFilter] = useState(() => ['ALL', 'KR', 'JP'].includes(savedViewState.localeFilter) ? savedViewState.localeFilter : 'ALL');
  const [kindFilter, setKindFilter] = useState(() => ['all', 'release', 'event', 'notice'].includes(savedViewState.kindFilter) ? savedViewState.kindFilter : 'all');
  const [boxes, setBoxes] = useState(resolvedBoxMarketItems);

  useEffect(() => {
    if (getPageFromPath(window.location.pathname) !== 'calendar') return;
    replaceAppHistoryState({ calendarViewState: { monthKey, selectedDate, localeFilter, kindFilter } });
  }, [monthKey, selectedDate, localeFilter, kindFilter]);

  const events = useMemo(() => buildCalendarEvents(boxes), [boxes]);
  const filteredEvents = useMemo(() => events.filter((event) => (
    (localeFilter === 'ALL' || event.locale === localeFilter)
    && (kindFilter === 'all' || event.kind === kindFilter)
  )), [events, kindFilter, localeFilter]);
  const [calendarYear, calendarMonth] = monthKey.split('-').map(Number);
  const monthStart = `${monthKey}-01`;
  const monthEnd = [calendarYear, String(calendarMonth).padStart(2, '0'), String(new Date(calendarYear, calendarMonth, 0).getDate()).padStart(2, '0')].join('-');
  const getEventDisplayDate = (event) => (event.date < monthStart && event.endDate >= monthStart ? monthStart : event.date);
  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents
      .filter((event) => event.date <= monthEnd && (event.endDate || event.date) >= monthStart)
      .forEach((event) => {
        const displayDate = getEventDisplayDate(event);
        map.set(displayDate, [...(map.get(displayDate) || []), event]);
      });
    return map;
  }, [filteredEvents, monthEnd, monthStart]);
  const monthEvents = useMemo(() => filteredEvents.filter((event) => event.date <= monthEnd && (event.endDate || event.date) >= monthStart), [filteredEvents, monthEnd, monthStart]);
  const highlightedEvents = useMemo(() => monthEvents.filter((event) => event.priority === 'high' && event.kind !== 'event'), [monthEvents]);
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const monthCells = useMemo(() => getCalendarMonthCells(monthKey), [monthKey]);
  const weekCells = useMemo(() => getCalendarWeekCells(selectedDate), [selectedDate]);
  const weekEventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((event) => map.set(event.date, [...(map.get(event.date) || []), event]));
    return map;
  }, [filteredEvents]);
  const monthDate = new Date(`${monthKey}-01T00:00:00`);
  const monthLabel = new Intl.DateTimeFormat(dateLocale, { year: 'numeric', month: 'long' }).format(monthDate);
  const selectedDateLabel = new Intl.DateTimeFormat(dateLocale, { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${selectedDate}T00:00:00`));
  const weekRangeLabel = weekCells.length
    ? `${new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric' }).format(new Date(`${weekCells[0].key}T00:00:00`))} - ${new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric' }).format(new Date(`${weekCells[6].key}T00:00:00`))}`
    : '';
  const mobileGroups = useMemo(() => {
    const groups = new Map();
    monthEvents.forEach((event) => {
      const displayDate = getEventDisplayDate(event);
      groups.set(displayDate, [...(groups.get(displayDate) || []), event]);
    });
    return [...groups.entries()];
  }, [monthEvents, monthStart]);

  const changeMonth = (delta) => {
    const [year, month] = monthKey.split('-').map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setMonthKey(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  };
  const goToday = () => {
    setMonthKey(todayKey.slice(0, 7));
    setSelectedDate(todayKey);
  };
  const selectDate = (dateKey) => {
    setSelectedDate(dateKey);
    if (!dateKey.startsWith(`${monthKey}-`)) setMonthKey(dateKey.slice(0, 7));
  };
  const changeWeek = (delta) => {
    const next = new Date(`${selectedDate}T00:00:00`);
    next.setDate(next.getDate() + (delta * 7));
    selectDate([next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), String(next.getDate()).padStart(2, '0')].join('-'));
  };

  const localeOptions = [
    { key: 'ALL', label: isJp ? 'すべての地域' : isEn ? 'All regions' : '전체 국가' },
    { key: 'KR', label: isJp ? '韓国版' : isEn ? 'Korea' : '한글판' },
    { key: 'JP', label: isJp ? '日本版' : isEn ? 'Japan' : '일본판' }
  ];
  const kindOptions = [
    { key: 'all', label: isJp ? 'すべての日程' : isEn ? 'All schedules' : '전체 일정' },
    { key: 'release', label: isJp ? '発売' : isEn ? 'Releases' : '발매' },
    { key: 'event', label: isJp ? 'イベント' : isEn ? 'Events' : '이벤트' },
    { key: 'notice', label: isJp ? '公式告知' : isEn ? 'Official notices' : '공식 공지' }
  ];
  const hasActiveFilters = localeFilter !== 'ALL' || kindFilter !== 'all';

  return (
    <main className="renew-subpage renew-calendar-main">
      <section className="renew-panel renew-calendar-panel">
        <header className="renew-calendar-head">
          <div>
            <span>SCHEDULE</span>
            <h1 className="renew-sr-only">{isJp ? 'ONE PIECE CARD GAME カレンダー' : isEn ? 'ONE PIECE Card Game Calendar' : '원피스카드 캘린더'}</h1>
          </div>
          <strong>{monthEvents.length}{isJp ? '件の日程' : isEn ? ' schedules' : '개 일정'}</strong>
        </header>

        <div className="renew-calendar-toolbar">
          <div className="renew-calendar-month-control">
            <button type="button" onClick={() => changeMonth(-1)} aria-label={isJp ? '前の月' : isEn ? 'Previous month' : '이전 달'}>‹</button>
            <h2>{monthLabel}</h2>
            <button type="button" onClick={() => changeMonth(1)} aria-label={isJp ? '次の月' : isEn ? 'Next month' : '다음 달'}>›</button>
            <button type="button" className="renew-calendar-today" onClick={goToday}>{isJp ? '今日' : isEn ? 'Today' : '오늘'}</button>
          </div>
          <div className="renew-calendar-filters">
            <div className="renew-calendar-filter-group">
              <span>{isJp ? '地域' : isEn ? 'Region' : '지역'}</span>
              <div role="group" aria-label={isJp ? '地域フィルター' : isEn ? 'Region filter' : '국가 필터'}>
                {localeOptions.map((option) => <button key={option.key} type="button" className={localeFilter === option.key ? 'is-active' : ''} onClick={() => setLocaleFilter(option.key)}>{option.label}</button>)}
              </div>
            </div>
            <div className="renew-calendar-filter-group">
              <span>{isJp ? '種類' : isEn ? 'Type' : '유형'}</span>
              <div role="group" aria-label={isJp ? '日程の種類フィルター' : isEn ? 'Schedule type filter' : '일정 유형 필터'}>
                {kindOptions.map((option) => <button key={option.key} type="button" className={kindFilter === option.key ? 'is-active' : ''} onClick={() => setKindFilter(option.key)}>{option.label}</button>)}
              </div>
            </div>
            <button
              type="button"
              className="renew-calendar-filter-reset"
              disabled={!hasActiveFilters}
              onClick={() => { setLocaleFilter('ALL'); setKindFilter('all'); }}
            >
              {isJp ? 'リセット' : isEn ? 'Reset' : '초기화'}
            </button>
          </div>
        </div>

        {highlightedEvents.length ? (
          <section className="renew-calendar-highlights" aria-label={isJp ? '今月の注目商品スケジュール' : isEn ? 'Featured product schedules this month' : '이번 달 주요 상품 일정'}>
            <header>
              <div>
                <span>MONTHLY PICK</span>
                <h2>{isJp ? '今月の注目商品スケジュール' : isEn ? 'Featured product schedules' : '이번 달 주요 상품 일정'}</h2>
              </div>
              <small>{isJp ? '新パック・ボックス・プロモカードを優先表示' : isEn ? 'New packs, boxes and promo cards' : '신규 팩·박스·프로모 우선'}</small>
            </header>
            <div>
              {highlightedEvents.map((event) => {
                const external = event.url?.startsWith('http');
                return (
                  <a key={`highlight-${event.id}`} href={event.url || '#'} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} onClick={() => { if (!external) rememberCurrentAppView(); }}>
                    <div>
                      <time dateTime={event.date}>{event.date.slice(5).replace('-', '.')}</time>
                      <span>{event.locale} · {event.kind === 'release' ? (isJp ? '発売' : isEn ? 'Release' : '발매') : (isJp ? '公式情報' : isEn ? 'Official news' : '공식 소식')}</span>
                    </div>
                    <strong>{getCalendarDisplayTitle(event, uiLang)}</strong>
                    {!isEn && !isJp && event.locale === 'JP' && event.titleKo !== event.title ? <small lang="ja">{event.title}</small> : null}
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="renew-calendar-layout">
          <div className="renew-calendar-mobile-week">
            <div className="renew-calendar-week-control">
              <button type="button" onClick={() => changeWeek(-1)} aria-label={isJp ? '前の週' : isEn ? 'Previous week' : '이전 주'}>‹</button>
              <strong>{weekRangeLabel}</strong>
              <button type="button" onClick={() => changeWeek(1)} aria-label={isJp ? '次の週' : isEn ? 'Next week' : '다음 주'}>›</button>
            </div>
            <div className="renew-calendar-week-days">
              {weekCells.map((cell) => {
                const eventCount = (weekEventsByDate.get(cell.key) || []).length;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`${cell.key === todayKey ? 'is-today' : ''}${cell.key === selectedDate ? ' is-selected' : ''}${cell.weekday === 0 ? ' is-sunday' : cell.weekday === 6 ? ' is-saturday' : ''}`}
                    onClick={() => selectDate(cell.key)}
                    aria-label={`${cell.key}, ${eventCount}${isEn ? ' schedules' : '개 일정'}`}
                  >
                    <span>{CALENDAR_WEEKDAYS[isJp ? 'JP' : isEn ? 'EN' : 'KR'][cell.weekday]}</span>
                    <time dateTime={cell.key}>{cell.day}</time>
                    {eventCount ? <small>{eventCount}</small> : <small aria-hidden="true">0</small>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="renew-calendar-grid-wrap">
            <div className="renew-calendar-weekdays" aria-hidden="true">
              {CALENDAR_WEEKDAYS[isJp ? 'JP' : isEn ? 'EN' : 'KR'].map((day, index) => <span key={day} className={index === 0 ? 'is-sunday' : index === 6 ? 'is-saturday' : ''}>{day}</span>)}
            </div>
            <div className="renew-calendar-grid">
              {monthCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.key) || [];
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`${cell.inMonth ? '' : 'is-outside'}${cell.key === todayKey ? ' is-today' : ''}${cell.key === selectedDate ? ' is-selected' : ''}${cell.weekday === 0 ? ' is-sunday' : cell.weekday === 6 ? ' is-saturday' : ''}`}
                    onClick={() => selectDate(cell.key)}
                    aria-label={`${cell.key}, ${dayEvents.length}${isEn ? ' schedules' : '개 일정'}`}
                  >
                    <time dateTime={cell.key}>{cell.day}</time>
                    <span className="renew-calendar-day-events">
                      {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`is-${event.kind} is-priority-${event.priority || 'low'}`}>{getCalendarDisplayTitle(event, uiLang)}</span>)}
                      {dayEvents.length > 3 ? <small>+{dayEvents.length - 3}</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="renew-calendar-agenda">
            <div>
              <span>{isJp ? '選択した日付' : isEn ? 'Selected date' : '선택한 날짜'}</span>
              <h2>{selectedDateLabel}</h2>
            </div>
            <div className="renew-calendar-agenda-list">
              {selectedEvents.map((event) => <RenewCalendarEventCard key={event.id} event={event} uiLang={uiLang} />)}
              {!selectedEvents.length ? <p>{isJp ? 'この日に登録された予定はありません。' : isEn ? 'No schedules on this date.' : '이 날짜에 등록된 일정이 없습니다.'}</p> : null}
            </div>
          </aside>
        </div>

        <div className="renew-calendar-mobile-list">
          {mobileGroups.map(([date, dayEvents]) => (
            <section key={date}>
              <time dateTime={date}>{new Intl.DateTimeFormat(dateLocale, { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`))}</time>
              <div>{dayEvents.map((event) => <RenewCalendarEventCard key={event.id} event={event} uiLang={uiLang} />)}</div>
            </section>
          ))}
          {!mobileGroups.length ? <p>{isJp ? '選択した条件に一致する予定はありません。' : isEn ? 'No schedules match the selected filters.' : '선택한 조건에 맞는 일정이 없습니다.'}</p> : null}
        </div>

        <footer className="renew-calendar-note">
          <p>{isJp ? '公式告知は掲載日を基準に表示します。発売日はリンク先の商品情報を基準としており、変更される場合があります。' : isEn ? 'Official notices are shown on their publication date. Release dates come from the linked product source and may change.' : '공식 공지는 게시일 기준입니다. 발매일은 연결된 상품 출처 기준이며 변경될 수 있습니다.'}</p>
        </footer>
      </section>
    </main>
  );
}

function RenewNews({ uiLang, onOpenCalendar }) {
  const t = (key) => getUiText(uiLang, key);
  const isJp = isJapaneseUi(uiLang);
  const savedViewState = getAppHistoryState().newsViewState || {};
  const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialPath = typeof window !== 'undefined' ? getAppPath(window.location.pathname) : '/news';
  const isCardStorageGuide = initialPath === '/guide/card-storage';
  const isShopBuyingGuide = initialPath === '/guide/shops';
  const isCardPriceGuide = initialPath === '/guide/card-price';
  const isCardCatalogGuide = initialPath === '/guide/card-catalog';
  const isBoxRecommendationGuide = initialPath.startsWith('/guide/box-recommendation');
  const initialRouteState = getNewsRouteState(initialPath, typeof window !== 'undefined' ? window.location.search : '');
  const routeSection = initialPath === '/guide' || initialPath === '/faq'
    ? 'guide'
    : initialPath.startsWith('/news/official')
      ? 'notice'
      : initialPath.startsWith('/news/preorder')
        ? 'preorder'
        : initialPath.startsWith('/news/supplies')
          ? 'supplies'
          : '';
  const initialSection = initialRouteState.section || routeSection || initialParams.get('section') || 'all';
  const initialLocale = (initialParams.get('locale') || (isJp ? 'JP' : 'KR')).toUpperCase();
  const [newsFilter, setNewsFilter] = useState(() => {
    const candidate = savedViewState.newsFilter || initialSection;
    return NEWS_FILTERS.some((item) => item.id === candidate) ? candidate : 'all';
  });
  const [noticeLocale, setNoticeLocale] = useState(() => ['KR', 'JP'].includes(savedViewState.noticeLocale) ? savedViewState.noticeLocale : (initialLocale === 'JP' ? 'JP' : 'KR'));
  const [supplyFilter, setSupplyFilter] = useState(() => savedViewState.supplyFilter || 'all');
  const [guideQaMode, setGuideQaMode] = useState(() => ['guide', 'qa'].includes(savedViewState.guideQaMode)
    ? savedViewState.guideQaMode
    : (initialRouteState.mode === 'qa' || initialPath === '/faq' || initialParams.get('mode') === 'qa' ? 'qa' : 'guide'));
  const [guideTarget, setGuideTarget] = useState(null);
  const officialTopics = OFFICIAL_TOPIC_ITEMS
    .filter((item) => (item.locale || '').toUpperCase() === noticeLocale)
    .filter((item, index, items) => !item.url || items.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 3);
  const supplyItems = COUPANG_PARTNER_ITEMS
    .filter((item) => supplyFilter === 'all' || item.category === supplyFilter);
  const visibleLinkGroups = (isJp ? [] : NEWS_LINK_GROUPS)
    .filter((item) => newsFilter === 'all' || item.id === newsFilter);
  const showNotice = isJp || newsFilter === 'all' || newsFilter === 'notice';
  const showGuide = !isJp && (newsFilter === 'all' || newsFilter === 'guide');
  const showSupplies = !isJp && (newsFilter === 'all' || newsFilter === 'supplies');
  const showTopSection = showNotice || visibleLinkGroups.length > 0;
  const visibleGuideQaGroups = GUIDE_QA_GROUPS.filter((group) => group.kind === guideQaMode);

  useEffect(() => {
    if (isJp) setNoticeLocale('JP');
  }, [isJp]);
  useEffect(() => {
    if (getPageFromPath(window.location.pathname) !== 'news') return;
    replaceAppHistoryState({ newsViewState: { newsFilter, noticeLocale, supplyFilter, guideQaMode } });
  }, [newsFilter, noticeLocale, supplyFilter, guideQaMode]);
  return (
    <main className="renew-main renew-news-main">
      <a className="renew-news-calendar-link" href={getLocalizedPagePath('calendar', uiLang)} onClick={(event) => { event.preventDefault(); onOpenCalendar?.(); }}>
        <span>SCHEDULE</span>
        <div>
          <strong>{uiLang === 'JP' ? 'ONE PIECE CARD GAME カレンダー' : uiLang === 'EN' ? 'ONE PIECE Card Game Calendar' : '원피스카드 캘린더'}</strong>
          <small>{uiLang === 'JP' ? '発売日と公式イベント告知を月別に確認できます。' : uiLang === 'EN' ? 'Check releases and official event notices by month.' : '발매일과 공식 이벤트 공지를 월별로 확인하세요.'}</small>
        </div>
        <b aria-hidden="true">›</b>
      </a>
      {!isJp ? <div className="renew-news-filter-tabs" role="group" aria-label="뉴스 분류">
        {NEWS_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={newsFilter === item.id ? 'is-active' : ''}
            onClick={() => setNewsFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div> : null}

      {showTopSection ? (
        <div className={`renew-news-overview ${newsFilter !== 'all' ? 'is-filtered' : ''}`}>
          {showNotice ? (
          <section className="renew-news-card renew-news-notice-card" aria-labelledby="official-news-heading">
            <div className="renew-news-card-head">
              <div>
                <span>OFFICIAL NEWS</span>
                <h2 id="official-news-heading">{isJp ? '公式ニュース' : '공지사항'}</h2>
              </div>
              {!isJp ? <div className="renew-news-toggle" role="group" aria-label="공지 언어 선택">
                <button type="button" className={noticeLocale === 'KR' ? 'is-active' : ''} onClick={() => setNoticeLocale('KR')}>한글판</button>
                <button type="button" className={noticeLocale === 'JP' ? 'is-active' : ''} onClick={() => setNoticeLocale('JP')}>일본판</button>
              </div> : null}
            </div>
            <div className="renew-topic-list renew-topic-list-compact">
              {officialTopics.map((item) => (
                <article key={item.id} className="renew-topic-card">
                  <a className={`renew-topic-thumb${item.imageUrl ? '' : ' is-empty'}`} href={item.url} target="_blank" rel="noreferrer" aria-label={item.title}>
                    <span>{item.locale}</span>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.parentElement?.classList.add('is-empty');
                          event.currentTarget.remove();
                        }}
                      />
                    ) : null}
                  </a>
                  <div className="renew-topic-body">
                    <div className="renew-topic-meta">
                      <span>{isJp ? '公式' : TOPIC_SOURCE_LABEL[item.source] || item.locale || '공식'}</span>
                      <span>{item.category}</span>
                      <time dateTime={item.date}>{item.date}</time>
                    </div>
                    <h2>{uiLang === 'KR' && item.titleKo ? item.titleKo : item.title}</h2>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {isJp ? '公式サイトで見る' : uiLang === 'EN' ? 'View original' : '원문 보기'}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {visibleLinkGroups.length ? (
          <div className={`renew-news-links ${visibleLinkGroups.length === 1 ? 'is-single' : ''}`} aria-label="예약구매">
            {visibleLinkGroups.map((item) => (
              <section key={item.id} className="renew-news-link-card">
                <span>{item.status}</span>
                <div className="renew-news-link-title-row">
                  <h2>{item.title}</h2>
                  {NEWS_GUIDE_CONTENT[item.id] ? (
                    <button
                      type="button"
                      className="renew-news-info-button"
                      onClick={() => setGuideTarget(item.id)}
                      aria-label={`${item.title} 이용 안내`}
                    >
                      i
                    </button>
                  ) : null}
                </div>
                {item.description ? <p>{item.description}</p> : null}
                {Array.isArray(item.links) && item.links.length ? (
                  <div className="renew-news-link-items">
                    {item.links.map((link) => (
                      <a
                        key={`${item.id}-${link.label}`}
                        className="renew-news-link-item"
                        href={link.href}
                        target="_blank"
                        rel="nofollow sponsored noreferrer"
                      >
                        <span className={`renew-news-link-thumb ${link.imageUrl ? '' : 'is-empty'}`} aria-hidden="true">
                          {link.imageUrl ? (
                            <img src={link.imageUrl} alt="" loading="lazy" />
                          ) : (
                            link.badge || link.label.slice(0, 2)
                          )}
                        </span>
                        <span className="renew-news-link-copy">
                          <strong>{link.label}</strong>
                          <small>{link.subLabel}</small>
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
          ) : null}
        </div>
      ) : null}

      {showSupplies ? (
      <section className="renew-panel renew-news-panel renew-news-supplies-panel">
        <div className="renew-section-head">
          <div>
            <span>SUPPLIES</span>
            <h2>카드 보관용품</h2>
          </div>
        </div>
        <div className="renew-news-supply-wrap">
          <div className="renew-news-supply-tabs" role="group" aria-label="카드 보관용품 분류">
            {SUPPLY_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={supplyFilter === item.id ? 'is-active' : ''}
                onClick={() => setSupplyFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="renew-news-supply-grid">
            {supplyItems.map((item) => (
              <a key={`${item.title}-${item.href}`} className="renew-news-supply-card" href={item.href} target="_blank" rel="nofollow sponsored noreferrer">
                <span className={`renew-news-supply-image ${item.embedSrc ? 'has-embed' : ''}`}>
                  {item.embedSrc ? (
                    <iframe
                      src={item.embedSrc}
                      title={`${item.title} 미리보기`}
                      width="120"
                      height="240"
                      frameBorder="0"
                      scrolling="no"
                      referrerPolicy="unsafe-url"
                      browsingtopics=""
                    />
                  ) : (
                    item.title.slice(0, 2)
                  )}
                </span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </a>
            ))}
          </div>
          <p className="renew-news-supply-disclosure">{COUPANG_DISCLOSURE}</p>
        </div>
      </section>
      ) : null}

      {showGuide && !isCardStorageGuide && !isShopBuyingGuide && !isCardPriceGuide && !isCardCatalogGuide && !isBoxRecommendationGuide ? (
      <section className="renew-panel renew-news-panel renew-news-guide-panel" aria-labelledby="guide-qa-heading">
        <div className="renew-section-head">
          <div>
            <span>GUIDE / Q&A</span>
            <h2 id="guide-qa-heading">가이드/Q&A</h2>
          </div>
          <div className="renew-news-toggle renew-guide-qa-toggle" role="group" aria-label="가이드 Q&A 선택">
            <button type="button" className={guideQaMode === 'guide' ? 'is-active' : ''} onClick={() => setGuideQaMode('guide')}>가이드</button>
            <button type="button" className={guideQaMode === 'qa' ? 'is-active' : ''} onClick={() => setGuideQaMode('qa')}>Q&A</button>
          </div>
        </div>
        {guideQaMode === 'guide' ? (
          <>
          <a className="renew-guide-feature-link" href="/guide/card-storage" onClick={() => rememberCurrentAppView()}>
            <span>STORAGE GUIDE</span>
            <strong>원피스카드 보관 방법</strong>
            <small>슬리브, 탑로더, 카드세이버, 바인더 보관 기준을 확인합니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/shops" onClick={() => rememberCurrentAppView()}>
            <span>SHOP GUIDE</span>
            <strong>원피스카드 사는 방법</strong>
            <small>공인점포, 취급점포, 지역별 검색과 내 주변 구매처 찾는 방법을 확인합니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/card-price" onClick={() => rememberCurrentAppView()}>
            <span>PRICE GUIDE</span>
            <strong>원피스카드 시세 보는 방법</strong>
            <small>카드 가격, 박스 가격, 최근 거래 기록과 기간별 그래프를 확인하는 방법을 정리했습니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/card-catalog" onClick={() => rememberCurrentAppView()}>
            <span>CATALOG GUIDE</span>
            <strong>원피스카드 도감 사용법</strong>
            <small>한글판, 일본판, OP/EB/ST/PR 시리즈와 일련번호 검색 방법을 확인합니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/box-recommendation" onClick={() => rememberCurrentAppView()}>
            <span>BOX GUIDE</span>
            <strong>목적별 카드 박스 추천</strong>
            <small>박스 현재가와 수록 카드 Single 시세를 기준으로 최고가, 안정성, 유효 히트를 비교합니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/about" onClick={() => rememberCurrentAppView()}>
            <span>CARD PONE</span>
            <strong>서비스 안내</strong>
            <small>제공 기능과 문의 방법을 확인합니다.</small>
          </a>
          </>
        ) : null}
        <div className="renew-guide-qa-grid">
          {visibleGuideQaGroups.map((group) => (
            <section key={group.id} className="renew-guide-qa-group">
              <h3>{group.title}</h3>
              <div className="renew-guide-qa-list">
                {group.items.map((item) => (
                  <details key={item.question} className="renew-guide-qa-item">
                    <summary>{item.question}</summary>
                    <ul className="renew-guide-qa-answer">
                      {splitGuideAnswer(item.answer).map((line, lineIndex) => (
                        <li key={`${item.question}-${lineIndex}`}>{line}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      ) : null}

      {isCardStorageGuide ? <RenewCardStorageGuide /> : null}
      {isShopBuyingGuide ? <RenewShopBuyingGuide /> : null}
      {isCardPriceGuide ? <RenewCardPriceGuide /> : null}
      {isCardCatalogGuide ? <RenewCardCatalogGuide /> : null}
      {isBoxRecommendationGuide ? <RenewBoxRecommendationGuide /> : null}

      <RenewSeoSummary page="news" titleAs="h1" placement="footer" uiLang={uiLang} />
      {guideTarget ? (
        <RenewNewsGuideModal
          guideId={guideTarget}
          onClose={() => setGuideTarget(null)}
        />
      ) : null}
    </main>
  );
}

function getBoxSeriesId(code = '') {
  const match = String(code).toUpperCase().match(/^(OP|EB|PRB)-(\d{2})$/);
  return match ? `${match[1]}${match[2]}` : '';
}

function getMedian(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function getCoefficientOfVariation(values = []) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!average) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance) / average;
}

const BOX_RECOMMENDATION_CATEGORIES = [
  {
    id: 'jackpot',
    path: '/guide/box-recommendation/high-price',
    eyebrow: 'HIGH CEILING',
    title: '최고가 카드 노리기',
    description: '박스 가격과 관계없이 각 시리즈에 수록된 Single 카드의 현재 최고가 순으로 비교합니다.',
    audience: '최상위 희귀 카드 한 장의 가격을 가장 중요하게 보는 경우',
    caution: '박스 가격과 봉입률은 순위에 반영하지 않아 개봉 결과의 편차가 클 수 있습니다.',
    score: 'maximum'
  },
  {
    id: 'stable',
    path: '/guide/box-recommendation/stable',
    eyebrow: 'BALANCED',
    title: '가격과 히트가 균형적인 박스',
    description: '박스 현재가 대비 카드 가격이 괜찮고, 일부 카드에만 가치가 몰리지 않은 상품을 비교합니다.',
    audience: '최고가 한 장보다 여러 유효 카드의 가격 분포를 함께 보고 싶은 경우',
    caution: '카드별 실제 봉입률을 적용한 기대값은 아니므로 수익을 보장하지 않습니다.',
    score: 'stableScore'
  },
  {
    id: 'hits',
    path: '/guide/box-recommendation/more-hits',
    eyebrow: 'MORE HITS',
    title: '유효 히트가 많은 박스',
    description: '박스 가격의 35% 이상인 Single 히트 카드가 상대적으로 많이 확인되는 박스를 비교합니다.',
    audience: '박스 가격 대비 의미 있는 가격의 카드가 여러 장인 시리즈를 찾는 경우',
    caution: '유효 히트 수는 현재 가격 기준이며 카드 가격이 바뀌면 순위도 달라집니다.',
    score: 'hitScore'
  }
];

function getBoxRecommendationCategory(pathname = '') {
  return BOX_RECOMMENDATION_CATEGORIES.find((category) => category.path === pathname) || null;
}

function getBoxSeriesMeta(seriesId = '') {
  const matched = seriesData.find((series) => (series.locale || 'KR') === 'KR' && getBaseSeriesId(series) === seriesId)
    || seriesData.find((series) => getBaseSeriesId(series) === seriesId);
  const code = String(seriesId).replace(/^(OP|EB|PRB)(\d{2})$/, '$1-$2');
  return {
    code,
    title: matched?.koName || matched?.enName || BOX_SHORT_TITLES[code] || seriesId,
    guidePath: matched ? getSeriesGuideRoutePath(matched) : '/cards'
  };
}

function getBoxRecommendationReason(categoryId, item) {
  if (categoryId === 'jackpot') {
    return `현재 확인된 최고가 카드는 ${formatYen(item.maximum)}이며, 상위 3장 합계는 ${formatYen(item.top3Total)}입니다. 이 순위에는 박스 가격을 반영하지 않습니다.`;
  }
  if (categoryId === 'stable') {
    return `박스 가격 대비 중앙값은 ${Math.round((item.median / item.boxPrice) * 100)}%이며, 최고가 쏠림과 매핑된 히트 카드 ${item.pricedHitCount}장의 가격 분포를 함께 반영했습니다.`;
  }
  return `박스 현재가의 35% 이상인 카드가 ${item.validHitCount}장 확인되며, 대상 카드 가격 데이터 커버리지는 ${Math.round(item.coverage * 100)}%입니다.`;
}

function getBoxRecommendationSummary(categoryId, item) {
  if (categoryId === 'jackpot') return `수록 카드 최고가 ${formatYen(item.maximum)}로 현재 비교 대상 중 가장 높습니다.`;
  if (categoryId === 'stable') return `박스 현재가, 카드 가격 중앙값과 가격 쏠림을 함께 비교한 결과입니다.`;
  return `박스 현재가의 35% 이상인 카드가 ${item.validHitCount}장 확인됩니다.`;
}

function RenewBoxRecommendationGuide() {
  const currentPath = getAppPath(window.location.pathname);
  const activeCategory = getBoxRecommendationCategory(currentPath);
  const [state, setState] = useState({ loading: true, categories: [], updatedAt: '' });

  useEffect(() => {
    if (!activeCategory) {
      setState({ loading: false, categories: [], updatedAt: '' });
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      import('./data/cards.json').then((module) => Array.isArray(module.default) ? module.default : []),
      loadCardMarketLinks(),
      fetch(import.meta.env.DEV ? '/__prod_api/api/market?summary=latest' : '/api/market?summary=latest')
        .then((response) => response.ok ? response.json() : null)
    ]).then(([cards, links, summary]) => {
      if (cancelled) return;
      const cardsById = new Map(cards.map((card) => [card.id, card]));
      const latestByApparelId = new Map(
        (Array.isArray(summary?.items) ? summary.items : [])
          .filter((item) => item?.apparelId)
          .map((item) => [String(item.apparelId), item])
      );
      const pricedCardById = new Map();
      (links || []).forEach((link) => {
        if (link?.status !== 'approved' || !link.cardId || !link.apparelId || pricedCardById.has(link.cardId)) return;
        const latest = latestByApparelId.get(String(link.apparelId));
        const price = Number(latest?.aPriceJpy || 0);
        const card = cardsById.get(link.cardId);
        if (!card || price <= 0) return;
        pricedCardById.set(link.cardId, { card, price, apparelId: link.apparelId });
      });

      const analyses = boxMarketItems
        .filter((box) => getBoxSeriesId(box.code))
        .map((box) => {
          const seriesId = getBoxSeriesId(box.code);
          const eligibleCards = cards.filter((card) => {
            const listedSeriesId = String(card.series || card.baseSeriesId || '').replace(/^JP-/, '');
            if (card.locale !== 'JP' || listedSeriesId !== seriesId) return false;
            const isParallel = /_p\d*$/i.test(card.id || '');
            return isParallel || ['SEC', 'SP'].includes(String(card.rarity || '').toUpperCase());
          });
          const pricedHits = eligibleCards
            .map((card) => pricedCardById.get(card.id))
            .filter(Boolean)
            .sort((a, b) => b.price - a.price);
          const prices = pricedHits.map((item) => item.price);
          const boxLatest = latestByApparelId.get(String(box.apparelId));
          const boxSnapshot = boxMarketPrices?.items?.[String(box.apparelId)] || null;
          const snapshotPriceUsd = Number(boxSnapshot?.minPrice || 0);
          const boxPrice = Number(boxLatest?.aPriceJpy || 0)
            || (snapshotPriceUsd > 0 ? snapshotPriceUsd * MARKET_USD_TO_JPY : 0)
            || (Number(box.minPrice || 0) * MARKET_USD_TO_JPY);
          if (!pricedHits.length) return null;
          const median = getMedian(prices);
          const maximum = prices[0] || 0;
          const validHitCount = boxPrice > 0 ? prices.filter((price) => price >= boxPrice * 0.35).length : 0;
          const coverage = eligibleCards.length ? pricedHits.length / eligibleCards.length : 0;
          const cv = getCoefficientOfVariation(prices);
          const top3Total = prices.slice(0, 3).reduce((sum, price) => sum + price, 0);
          return {
            ...box,
            seriesId,
            boxPrice,
            pricedHitCount: pricedHits.length,
            eligibleHitCount: eligibleCards.length,
            validHitCount,
            coverage,
            median,
            maximum,
            cv,
            top3Total,
            strongestCard: pricedHits[0],
            topCards: pricedHits.slice(0, 3),
            stableScore: boxPrice > 0 && pricedHits.length >= 3 && coverage >= 0.25
              ? (median / boxPrice) * (1 / (1 + cv)) * Math.log2(pricedHits.length + 1) * coverage
              : 0,
            hitScore: boxPrice > 0 && pricedHits.length >= 3 && coverage >= 0.25
              ? validHitCount * Math.max(coverage, 0.35) + Math.min(pricedHits.length, 12) / 12
              : 0
          };
        })
        .filter(Boolean);

      const categoryAnalyses = activeCategory.id === 'jackpot'
        ? analyses
        : analyses.filter((item) => item.boxPrice > 0 && item[activeCategory.score] > 0);

      setState({
        loading: false,
        updatedAt: summary?.generatedAt || summary?.updatedAt || boxMarketPrices?.updatedAt || '',
        categories: [{
          ...activeCategory,
          items: [...categoryAnalyses].sort((a, b) => b[activeCategory.score] - a[activeCategory.score]).slice(0, 5)
        }]
      });
    }).catch(() => {
      if (!cancelled) setState({ loading: false, categories: [], updatedAt: '' });
    });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  if (!activeCategory) {
    return (
      <section className="renew-panel renew-news-panel renew-box-guide" aria-labelledby="box-recommendation-heading">
        <header className="renew-box-guide-head">
          <span>BOX GUIDE</span>
          <h1 id="box-recommendation-heading">원피스카드 박스 구매 가이드</h1>
          <p>원하는 개봉 방향을 선택하면 해당 기준으로 계산된 박스만 따로 확인할 수 있습니다.</p>
        </header>
        <nav className="renew-box-guide-hub" aria-label="박스 구매 가이드 선택">
          {BOX_RECOMMENDATION_CATEGORIES.map((category) => (
            <a key={category.id} href={category.path} onClick={() => rememberCurrentAppView()}>
              <span>{category.eyebrow}</span>
              <strong>{category.title}</strong>
              <p>{category.description}</p>
              <b>추천 박스 보기</b>
            </a>
          ))}
        </nav>
        <section className="renew-box-guide-reading" aria-labelledby="box-guide-reading-heading">
          <h2 id="box-guide-reading-heading">어떤 기준을 선택해야 하나요?</h2>
          <div>
            {BOX_RECOMMENDATION_CATEGORIES.map((category) => (
              <article key={`${category.id}-reading`}>
                <strong>{category.title}</strong>
                <p>{category.audience}</p>
              </article>
            ))}
          </div>
          <p>추천 결과는 Card Pone에 연결된 박스 현재가와 수록 카드의 최신 Single 시세를 비교합니다. 개봉 확률이나 미확인 카드 가격은 임의로 추정하지 않습니다.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="renew-panel renew-news-panel renew-box-guide" aria-labelledby="box-recommendation-heading">
      <header className="renew-box-guide-head">
        <a className="renew-box-guide-back" href="/guide/box-recommendation">박스 구매 가이드</a>
        <span>{activeCategory.eyebrow}</span>
        <h1 id="box-recommendation-heading">{activeCategory.title}</h1>
        <p>{activeCategory.description}</p>
      </header>
      {state.loading ? <p className="renew-box-guide-status">가격 데이터를 계산하고 있습니다.</p> : null}
      {!state.loading && !state.categories.length ? <p className="renew-box-guide-status">추천을 계산할 수 있는 가격 데이터가 부족합니다.</p> : null}
      {!state.loading && state.categories[0]?.items?.[0] ? (() => {
        const firstItem = state.categories[0].items[0];
        const firstSeries = getBoxSeriesMeta(firstItem.seriesId);
        return (
          <aside className="renew-box-guide-summary" aria-label="현재 추천 결과 요약">
            <span>현재 1위</span>
            <strong>{firstSeries.code} · {firstSeries.title}</strong>
            <p>{getBoxRecommendationSummary(activeCategory.id, firstItem)}</p>
            {state.updatedAt ? <time dateTime={state.updatedAt}>데이터 기준 {new Date(state.updatedAt).toLocaleString('ko-KR')}</time> : null}
          </aside>
        );
      })() : null}
      <div className="renew-box-guide-context" aria-label="추천 기준 안내">
        <div>
          <strong>이 기준이 맞는 경우</strong>
          <p>{activeCategory.audience}</p>
        </div>
        <div>
          <strong>확인할 점</strong>
          <p>{activeCategory.caution}</p>
        </div>
      </div>
      <div className="renew-box-guide-categories">
        {state.categories.map((category) => (
          <section key={category.id} className="renew-box-guide-category">
            <div className="renew-box-guide-grid">
              {!category.items.length ? <p className="renew-box-guide-status">박스 가격과 카드 가격이 함께 확인된 시리즈가 없습니다.</p> : null}
              {category.items.map((item, index) => {
                const series = getBoxSeriesMeta(item.seriesId);
                return (
                <article key={`${category.id}-${item.apparelId}`} className="renew-box-guide-item">
                  <div className="renew-box-guide-rank">{index + 1}</div>
                  <img src={item.previewImageUrl || '/card-placeholder.svg'} alt={`${series.code} ${series.title} 박스`} loading="lazy" />
                  <div className="renew-box-guide-item-body">
                    <span>{series.code}</span>
                    <h3>{series.code} · {series.title}</h3>
                    <small className="renew-box-guide-product-name">{item.name}</small>
                    {item.topCards?.length ? (
                      <div className="renew-box-guide-top-cards">
                        <strong>현재가 상위 카드</strong>
                        <ol>
                          {item.topCards.map((topCard) => (
                            <li key={topCard.card.id}>
                              <a href={`/cards?cardId=${encodeURIComponent(topCard.card.id)}`}>
                                <span>{topCard.card.name || topCard.card.koName || topCard.card.id}</span>
                                <b>{formatYen(topCard.price)}</b>
                              </a>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    <dl>
                      <div><dt>박스 현재가</dt><dd>{item.boxPrice > 0 ? formatYen(item.boxPrice) : '수집 중'}</dd></div>
                      <div><dt>최고가 카드</dt><dd>{formatYen(item.maximum)}</dd></div>
                      <div><dt>가격 중앙값</dt><dd>{formatYen(item.median)}</dd></div>
                      <div><dt>유효 히트</dt><dd>{item.validHitCount}장</dd></div>
                    </dl>
                    <p>가격 확인 {item.pricedHitCount}/{item.eligibleHitCount}장 · 데이터 커버리지 {Math.round(item.coverage * 100)}%</p>
                    <div className="renew-box-guide-actions">
                      <a href={`/prices?tab=box&code=${encodeURIComponent(item.code)}&apparelId=${encodeURIComponent(item.apparelId)}`}>박스 시세 보기</a>
                      <a href={series.guidePath}>시리즈 상세 보기</a>
                    </div>
                    <details className="renew-box-guide-detail">
                      <summary>상세 분석 보기</summary>
                      <div>
                        <p>{getBoxRecommendationReason(category.id, item)}</p>
                      </div>
                    </details>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <footer className="renew-box-guide-note">
        <strong>계산 기준</strong>
        <p>미개봉 박스와 패러렐·SEC·SP 카드에 연결된 최신 Single 시세만 사용합니다. 봉입률이 반영된 기대값이나 수익 보장이 아니며, 가격 데이터가 부족한 상품은 추천에서 제외됩니다.</p>
        {state.updatedAt ? <time dateTime={state.updatedAt}>데이터 기준 {new Date(state.updatedAt).toLocaleString('ko-KR')}</time> : null}
      </footer>
    </section>
  );
}

function splitGuideAnswer(answer = '') {
  const normalized = String(answer).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return (normalized.match(/[^.]+(?:\.|$)/g) || [normalized]).map((line) => line.trim()).filter(Boolean);
}

function RenewCardStorageGuide() {
  return (
    <section className="renew-panel renew-news-panel renew-card-storage-guide" aria-labelledby="card-storage-guide-heading">
      <div className="renew-section-head">
        <div>
          <span>STORAGE GUIDE</span>
          <h2 id="card-storage-guide-heading">{CARD_STORAGE_GUIDE.title}</h2>
        </div>
      </div>
      <p className="renew-card-storage-intro">{CARD_STORAGE_GUIDE.intro}</p>
      <div className="renew-card-storage-grid">
        {CARD_STORAGE_GUIDE.sections.map((section) => (
          <article key={section.title} className="renew-card-storage-section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="renew-card-storage-checklist">
        <h3>장기 보관 체크리스트</h3>
        <ul>
          {CARD_STORAGE_GUIDE.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="renew-card-storage-cta">
        <div>
          <span>SUPPLIES</span>
          <strong>카드 보관용품이 필요하다면</strong>
          <p>슬리브, 탑로더, 카드세이버, 바인더 등 카드 보관에 자주 쓰이는 용품을 확인할 수 있습니다.</p>
        </div>
        <a href="/news/supplies">카드 보관용품 보러가기</a>
      </div>
    </section>
  );
}

function RenewShopBuyingGuide() {
  return (
    <section className="renew-panel renew-news-panel renew-card-storage-guide" aria-labelledby="shop-buying-guide-heading">
      <div className="renew-section-head">
        <div>
          <span>SHOP GUIDE</span>
          <h2 id="shop-buying-guide-heading">{SHOP_BUYING_GUIDE.title}</h2>
        </div>
      </div>
      <p className="renew-card-storage-intro">{SHOP_BUYING_GUIDE.intro}</p>
      <div className="renew-card-storage-grid">
        {SHOP_BUYING_GUIDE.sections.map((section) => (
          <article key={section.title} className="renew-card-storage-section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="renew-card-storage-checklist">
        <h3>구매 전 체크리스트</h3>
        <ul>
          {SHOP_BUYING_GUIDE.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="renew-card-storage-cta">
        <div>
          <span>SHOPS</span>
          <strong>가까운 구매처를 찾고 싶다면</strong>
          <p>지역, 시군구, 매장 유형 필터와 내 주변순 정렬을 사용해 방문 가능한 매장을 확인할 수 있습니다.</p>
        </div>
        <a href="/shops">구매처 바로가기</a>
      </div>
    </section>
  );
}

function RenewCardPriceGuide() {
  return (
    <section className="renew-panel renew-news-panel renew-card-storage-guide" aria-labelledby="card-price-guide-heading">
      <div className="renew-section-head">
        <div>
          <span>PRICE GUIDE</span>
          <h2 id="card-price-guide-heading">{CARD_PRICE_GUIDE.title}</h2>
        </div>
      </div>
      <p className="renew-card-storage-intro">{CARD_PRICE_GUIDE.intro}</p>
      <div className="renew-card-storage-grid">
        {CARD_PRICE_GUIDE.sections.map((section) => (
          <article key={section.title} className="renew-card-storage-section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="renew-card-storage-checklist">
        <h3>시세 확인 체크리스트</h3>
        <ul>
          {CARD_PRICE_GUIDE.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="renew-card-storage-cta">
        <div>
          <span>PRICES</span>
          <strong>카드 시세를 바로 확인하려면</strong>
          <p>일련번호 또는 카드명을 검색해 같은 카드의 버전별 가격과 최근 거래 기록을 확인할 수 있습니다.</p>
        </div>
        <a href="/prices">시세 바로가기</a>
      </div>
    </section>
  );
}

function RenewCardCatalogGuide() {
  return (
    <section className="renew-panel renew-news-panel renew-card-storage-guide" aria-labelledby="card-catalog-guide-heading">
      <div className="renew-section-head">
        <div>
          <span>CATALOG GUIDE</span>
          <h2 id="card-catalog-guide-heading">{CARD_CATALOG_GUIDE.title}</h2>
        </div>
      </div>
      <p className="renew-card-storage-intro">{CARD_CATALOG_GUIDE.intro}</p>
      <div className="renew-card-storage-grid">
        {CARD_CATALOG_GUIDE.sections.map((section) => (
          <article key={section.title} className="renew-card-storage-section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="renew-card-storage-checklist">
        <h3>도감 사용 체크리스트</h3>
        <ul>
          {CARD_CATALOG_GUIDE.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="renew-card-storage-cta">
        <div>
          <span>CARDS</span>
          <strong>카드 도감을 바로 사용하려면</strong>
          <p>한글판과 일본판을 선택하고 시리즈, 등급, 일련번호, 카드명 기준으로 원하는 카드를 찾을 수 있습니다.</p>
        </div>
        <a href="/cards">도감 바로가기</a>
      </div>
    </section>
  );
}

function RenewNewsGuideModal({ guideId, onClose }) {
  const guide = NEWS_GUIDE_CONTENT[guideId];
  useBodyScrollLock(Boolean(guide));
  const [platformId, setPlatformId] = useState('');
  const activePlatform = guide?.platforms?.find((item) => item.id === platformId) || null;
  if (!guide) return null;
  const StepList = ({ items }) => (
    <ol className="renew-news-guide-steps">
      {items.map((step) => <li key={step}>{step}</li>)}
    </ol>
  );
  const BulletList = ({ items }) => (
    <ul className="renew-news-guide-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
  const InfoSection = ({ section, index }) => (
    <section key={`${section.title || 'section'}-${index}`} className="renew-news-guide-section">
      {section.title ? <h3>{section.title}</h3> : null}
      {section.highlight ? <p className="renew-news-guide-highlight">{section.highlight}</p> : null}
      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.items?.length ? (
        section.type === 'steps' ? <StepList items={section.items} /> : <BulletList items={section.items} />
      ) : null}
      {section.footer ? <p>{section.footer}</p> : null}
    </section>
  );
  const renderSections = (sections = []) => sections.map((section, index) => (
    <InfoSection key={`${section.title || 'section'}-${index}`} section={section} index={index} />
  ));
  const displayTitle = activePlatform?.title || guide.title;
  const displayDescription = activePlatform?.description || guide.description;
  const displaySections = activePlatform?.sections || guide.sections;
  return (
    <div className="renew-modal-backdrop renew-news-guide-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-news-guide-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{displayTitle}</h2>
            {displayDescription ? <p>{displayDescription}</p> : null}
          </div>
          <button type="button" className="renew-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        {guide.platforms ? (
          <div className="renew-news-guide-tabs" role="group" aria-label="플랫폼 선택">
            {guide.platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                className={platform.id === activePlatform?.id ? 'is-active' : ''}
                onClick={() => setPlatformId(platform.id)}
              >
                {platform.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="renew-news-guide-body">
          {renderSections(displaySections)}
        </div>
      </div>
    </div>
  );
}

function RenewStaticInfoPage({ type }) {
  const page = STATIC_INFO_PAGES[type] || STATIC_INFO_PAGES.about;
  return (
    <main className="renew-main renew-static-info-main">
      <article className="renew-static-info-page">
        <header className="renew-static-info-head">
          <h1>{page.title}</h1>
          <p>{page.lead}</p>
        </header>
        <div className="renew-static-info-grid">
          {page.sections.map((section) => (
            <section id={section.id || undefined} key={section.title} className="renew-static-info-card">
              <h2>{section.title}</h2>
              {Array.isArray(section.body) ? section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              )) : null}
              {Array.isArray(section.list) ? (
                <ul>
                  {section.list.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              {Array.isArray(section.links) ? (
                <div className="renew-static-info-links">
                  {section.links.map((link) => (
                    <a key={link.href} className="renew-static-info-action" href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                  ))}
                </div>
              ) : null}
              {section.actionUrl ? <a className="renew-static-info-action" href={section.actionUrl}>{section.actionLabel}</a> : null}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

function RenewLegalDialog({ type, onClose }) {
  const isPrivacy = type === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  return (
    <div className="renew-info-modal renew-legal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <div className="renew-modal-head">
        <div>
          <h2>{isPrivacy ? '개인정보처리방침' : '이용약관'}</h2>
          {isPrivacy ? <p>Card Pone는 이용자의 개인정보를 중요하게 생각하며, 관련 법령에 따라 개인정보를 안전하게 관리합니다.</p> : null}
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
  );
}

function RenewLegalModal({ type, onClose }) {
  useBodyScrollLock();
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <RenewLegalDialog type={type} onClose={onClose} />
    </div>
  );
}

function RenewSeriesGuide({ onOpenCatalog, onOpenCard, onOpenPrices }) {
  const guideSlug = getAppPath(window.location.pathname).slice('/guides/series/'.length);
  const series = findSeriesByRouteSlug(guideSlug);
  const locale = series?.locale || 'JP';
  const seriesCode = getBaseSeriesId(series);
  const seriesName = series?.koName || series?.enName || seriesCode;
  const localeLabel = locale === 'KR' ? '한글판' : locale === 'EN' ? '영문판' : '일본판';
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const boxImageByCode = useMemo(() => new Map(
    boxMarketItems
      .filter((item) => item.code && item.previewImageUrl)
      .map((item) => [item.code, item.previewImageUrl])
  ), []);
  const productImageUrl = getSeriesBoxPreviewUrl(series, boxImageByCode);
  const cardCount = Number(seriesCardCounts?.[locale]?.series?.[series?.id] || 0);

  useEffect(() => {
    let cancelled = false;
    if (!series?.id) {
      setCards([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    fetchCards({ locale, series: series.id })
      .then((items) => {
        if (!cancelled) setCards(Array.isArray(items) ? items.slice(0, 8) : []);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, series?.id]);

  if (!series) {
    return (
      <main className="renew-series-guide">
        <div className="renew-empty renew-panel">시리즈 정보를 찾을 수 없습니다.</div>
      </main>
    );
  }

  return (
    <main className="renew-series-guide">
      <section className="renew-series-guide-hero renew-panel">
        <div className="renew-series-guide-copy">
          <div className="renew-series-guide-tags">
            <span>{localeLabel}</span>
            <span>{series.kindEn || series.kindKo || 'CARD SERIES'}</span>
          </div>
          <p className="renew-series-guide-code">{seriesCode}</p>
          <h1>{seriesName}</h1>
          {series.enName && series.enName !== seriesName ? <p className="renew-series-guide-en-name">{series.enName}</p> : null}
          <p>상품 기본 정보와 실제 수록 카드를 한 화면에서 확인하고, 도감과 카드별 시세로 바로 이동하는 시리즈 가이드입니다.</p>
          <div className="renew-series-guide-actions">
            <button type="button" onClick={() => onOpenCatalog?.(series)}>수록 카드 전체 보기</button>
            <button type="button" className="is-secondary" onClick={onOpenPrices}>카드 시세 보기</button>
          </div>
        </div>
        <div className="renew-series-guide-product">
          <div className="renew-series-guide-product-image">
            {productImageUrl ? (
              <img src={productImageUrl} alt={`${seriesName} 상품`} onError={placeholderImage} />
            ) : (
              <span className="renew-series-guide-product-fallback">{seriesCode}</span>
            )}
          </div>
          <small>{productImageUrl ? '상품 이미지는 도감에서 사용 중인 데이터를 재사용합니다.' : '등록된 상품 이미지가 없어 시리즈 코드로 표시합니다.'}</small>
        </div>
      </section>

      <section className="renew-series-guide-facts" aria-label="상품 기본 정보">
        <article><span>언어</span><strong>{localeLabel}</strong></article>
        <article><span>분류</span><strong>{series.kindKo || series.kindEn || '-'}</strong></article>
        <article><span>도감 등록</span><strong>{cardCount || cards.length}장</strong></article>
        <article><span>시리즈</span><strong>{seriesCode}</strong></article>
      </section>

      <section className="renew-series-guide-section renew-panel">
        <div className="renew-series-guide-section-head">
          <div>
            <span>CHECK POINT</span>
            <h2>이 시리즈에서 바로 확인할 것</h2>
          </div>
        </div>
        <div className="renew-series-guide-points">
          <article><b>수록 카드</b><p>카드번호, 레어도와 이미지를 기존 {localeLabel} 도감 데이터로 확인합니다.</p></article>
          <article><b>카드별 시세</b><p>시세가 연결된 카드는 도감 상세에서 Single과 PSA10 가격으로 이어집니다.</p></article>
          <article><b>봉입 정보</b><p>공식적으로 확인되지 않은 카톤 봉입률은 임의로 단정하지 않습니다.</p></article>
        </div>
      </section>

      <section className="renew-series-guide-section renew-panel">
        <div className="renew-series-guide-section-head">
          <div>
            <span>CARD PREVIEW</span>
            <h2>수록 카드 미리보기</h2>
          </div>
          <button type="button" onClick={() => onOpenCatalog?.(series)}>전체 보기</button>
        </div>
        {loading ? <div className="renew-empty">카드를 불러오는 중입니다.</div> : null}
        {!loading && !cards.length ? <div className="renew-empty">수록 카드 데이터를 불러오지 못했습니다.</div> : null}
        {!loading && cards.length ? (
          <div className="renew-series-guide-card-grid">
            {cards.map((card) => (
              <button key={card.id} type="button" onClick={() => onOpenCard?.(series, card)}>
                <span className="renew-series-guide-card-image">
                  <img
                    src={getCardThumbnailSrc(card)}
                    data-fallback-src={getCardImageSrc(card)}
                    alt={card.name}
                    onError={fallbackToOriginalCardImage}
                    loading="lazy"
                  />
                </span>
                <small>{card.cardNo} · {card.rarity}</small>
                <strong>{card.name}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="renew-series-guide-section renew-series-guide-faq renew-panel">
        <div className="renew-series-guide-section-head">
          <div>
            <span>QUICK GUIDE</span>
            <h2>처음 보는 사람을 위한 안내</h2>
          </div>
        </div>
        <details open><summary>{seriesCode}은 어떤 시리즈인가요?</summary><p>{series.kindKo || series.kindEn || '원피스 카드게임 상품'}으로 분류된 {localeLabel} 시리즈입니다. 이 페이지에서는 확인되지 않은 설명보다 실제 도감 수록 카드 확인을 우선합니다.</p></details>
        <details><summary>카드 가격은 어디에서 확인하나요?</summary><p>수록 카드를 누르면 기존 도감 상세로 이동하며, 시세가 연결된 카드는 시세 화면에서 최근 가격과 거래 이력을 확인할 수 있습니다.</p></details>
        <details><summary>카톤 봉입률도 확인할 수 있나요?</summary><p>현재는 공식 확인이 가능한 상품 정보만 제공합니다. 확인되지 않은 봉입률이나 체감 확률은 확정 정보처럼 표시하지 않습니다.</p></details>
      </section>
    </main>
  );
}

function RenewCatalog({ authUser, userState, setUserState, initialSearch, initialViewState, viewStateRevision = 0, restoreScrollY = null, onRestoreScrollDone, onViewStateChange, onOpenMarket, onOpenMarketplace, onOpenSeriesGuide, onRequireLogin, marketListings = [], uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const hasInitialSearch = Boolean(initialSearch?.q);
  const initialLocale = hasInitialSearch ? (initialSearch?.locale || 'JP') : (initialViewState?.locale || 'JP');
  const [locale, setLocale] = useState(initialLocale);
  const [selectedSeries, setSelectedSeries] = useState(() => hasInitialSearch ? getDefaultRenewSeriesId(initialLocale) : (initialViewState?.selectedSeries || getDefaultRenewSeriesId(initialLocale)));
  const [openSection, setOpenSection] = useState(() => hasInitialSearch ? '' : (initialViewState?.openSection || ''));
  const [searchKeyword, setSearchKeyword] = useState(hasInitialSearch ? initialSearch.q : (initialViewState?.searchKeyword || ''));
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState(searchKeyword);
  const [activeRarity, setActiveRarity] = useState(hasInitialSearch ? 'ALL' : (initialViewState?.activeRarity || 'ALL'));
  const [collectionFilter, setCollectionFilter] = useState(hasInitialSearch ? 'all' : (initialViewState?.collectionFilter || 'all'));
  const [catalogSortMode, setCatalogSortMode] = useState(hasInitialSearch ? 'rarity' : (initialViewState?.catalogSortMode || 'rarity'));
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [catalogMarketPriceByCardId, setCatalogMarketPriceByCardId] = useState(() => new Map());
  const [expandedDeferredRarities, setExpandedDeferredRarities] = useState(() => new Set());
  const [rarityPanelOpen, setRarityPanelOpen] = useState(false);
  const [seriesBoxImageByCode, setSeriesBoxImageByCode] = useState(() => new Map(
    boxMarketItems
      .filter((item) => item.code && item.previewImageUrl)
      .map((item) => [item.code, item.previewImageUrl])
  ));
  const rarityPanelRef = useRef(null);
  const appliedViewStateRevisionRef = useRef(viewStateRevision);
  const [catalogPending, startCatalogTransition] = useTransition();

  const localeSeries = useMemo(() => seriesData.filter((series) => (series.locale ?? 'KR') === locale), [locale]);
  const sections = useMemo(() => buildRenewSeriesSections(localeSeries), [localeSeries]);
  const mobileCategoryChips = useMemo(() => [
    { id: '', label: 'ALL' },
    { id: 'regular', label: 'OP' },
    { id: 'extra', label: 'EB' },
    { id: 'starter', label: 'ST' },
    { id: 'promo', label: 'PR' }
  ].filter((chip) => !chip.id || sections.some((section) => section.id === chip.id && section.children.length)), [sections]);
  const activeMobileSection = useMemo(() => sections.find((section) => section.id === openSection && section.children.length) || null, [sections, openSection]);
  const currentSeries = useMemo(() => localeSeries.find((series) => series.id === selectedSeries) || localeSeries[0], [localeSeries, selectedSeries]);
  const isAllSeriesMode = selectedSeries === ALL_SERIES_ID;
  const selectedSeriesSectionId = useMemo(() => {
    if (isAllSeriesMode) return '';
    return sections.find((section) => section.children.some((series) => series.id === selectedSeries))?.id || '';
  }, [isAllSeriesMode, sections, selectedSeries]);
  const ownedSet = useMemo(() => new Set(Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds : []), [userState]);
  const wishSet = useMemo(() => new Set(Array.isArray(userState?.wishlistCardIds) ? userState.wishlistCardIds : []), [userState]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadCardMarketLinks(),
      import('./data/market-cards.js'),
      fetch('/api/market?summary=latest')
        .then((res) => res.ok ? res.json() : null)
        .catch(() => null),
      fetch('/api/psa10-market?summary=latest')
        .then((res) => res.ok ? res.json() : null)
        .catch(() => null)
    ])
      .then(([links, marketModule, marketSummary, psaSummary]) => {
        if (cancelled) return;
        const marketItems = Array.isArray(marketModule.default) ? marketModule.default : [];
        const itemByApparelId = new Map(marketItems.map((item) => [String(item.apparelId), item]));
        const latestByApparelId = new Map(
          (Array.isArray(marketSummary?.items) ? marketSummary.items : [])
            .filter((item) => item?.apparelId)
            .map((item) => [String(item.apparelId), item])
        );
        const psaPriceByCardId = new Map(
          (Array.isArray(psaSummary?.items) ? psaSummary.items : [])
            .filter((item) => item?.cardId && Number(item.priceUsd || 0) > 0)
            .map((item) => [item.cardId, Number(item.priceUsd || 0)])
        );
        const nextMap = new Map();
        links.forEach((link) => {
          if (link?.status !== 'approved' || !link.cardId || !link.apparelId) return;
          const item = itemByApparelId.get(String(link.apparelId));
          const latest = latestByApparelId.get(String(link.apparelId));
          const priceUsd = Number(latest?.aPriceUsd || item?.minPrice || 0);
          const psa10PriceUsd = Number(psaPriceByCardId.get(link.cardId) || latest?.psa10PriceUsd || 0);
          if (!item || (priceUsd <= 0 && psa10PriceUsd <= 0)) return;
          nextMap.set(link.cardId, {
            priceUsd,
            psa10PriceUsd,
            apparelId: item.apparelId
          });
        });
        setCatalogMarketPriceByCardId(nextMap);
      })
      .catch(() => {
        if (!cancelled) setCatalogMarketPriceByCardId(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSeries === ALL_SERIES_ID || localeSeries.some((series) => series.id === selectedSeries)) return;
    const nextSeries = getDefaultRenewSeriesId(locale);
    setSelectedSeries(nextSeries);
    setOpenSection('');
    setActiveRarity('ALL');
  }, [locale, localeSeries, selectedSeries]);

  useEffect(() => {
    const q = initialSearch?.q?.trim();
    if (!q) return;
    const nextLocale = initialSearch.locale || 'JP';
    setLocale(nextLocale);
    setSearchKeyword(q);
    setSelectedSeries(getDefaultRenewSeriesId(nextLocale));
    setActiveRarity('ALL');
    setCollectionFilter('all');
  }, [initialSearch?.id, initialSearch?.locale, initialSearch?.q]);

  useEffect(() => {
    if (appliedViewStateRevisionRef.current === viewStateRevision) return;
    appliedViewStateRevisionRef.current = viewStateRevision;
    if (!initialViewState || hasInitialSearch) return;
    if (initialViewState.locale) setLocale(initialViewState.locale);
    if (initialViewState.selectedSeries) setSelectedSeries(initialViewState.selectedSeries);
    setSearchKeyword(initialViewState.searchKeyword || '');
    setActiveRarity(initialViewState.activeRarity || 'ALL');
    setCollectionFilter(initialViewState.collectionFilter || 'all');
    setCatalogSortMode(initialViewState.catalogSortMode || 'rarity');
    setOpenSection(initialViewState.openSection || '');
  }, [hasInitialSearch, initialViewState, viewStateRevision]);

  useEffect(() => {
    setExpandedDeferredRarities(new Set());
  }, [locale, selectedSeries, searchKeyword, activeRarity, collectionFilter]);

  useEffect(() => {
    const timerId = window.setTimeout(() => setDebouncedSearchKeyword(searchKeyword), 180);
    return () => window.clearTimeout(timerId);
  }, [searchKeyword]);

  useEffect(() => {
    if (loading || restoreScrollY == null || typeof window === 'undefined') return undefined;
    return restoreAppScrollPosition(restoreScrollY, { onDone: onRestoreScrollDone });
  }, [loading, restoreScrollY, onRestoreScrollDone]);

  useEffect(() => {
    onViewStateChange?.({
      locale,
      selectedSeries,
      searchKeyword,
      activeRarity,
      collectionFilter,
      catalogSortMode,
      openSection
    });
  }, [locale, selectedSeries, searchKeyword, activeRarity, collectionFilter, catalogSortMode, openSection, onViewStateChange]);

  useEffect(() => {
    let cancelled = false;
    async function loadCards() {
      setLoading(true);
      try {
        const keyword = debouncedSearchKeyword.trim();
        const collectionIds = collectionFilter === 'owned'
          ? (Array.isArray(userState?.ownedCardIds) ? userState.ownedCardIds : [])
          : collectionFilter === 'wish'
            ? (Array.isArray(userState?.wishlistCardIds) ? userState.wishlistCardIds : [])
            : [];
        const result = keyword
          ? await searchCards(keyword, locale)
            : collectionFilter === 'all'
              ? await fetchCards(isAllSeriesMode ? { locale } : { locale, series: selectedSeries })
            : collectionIds.length
              ? await fetchCards({ locale })
              : [];
        if (!cancelled) {
          startCatalogTransition(() => {
            setCards(Array.isArray(result) ? result : []);
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCards();
    return () => {
      cancelled = true;
    };
  }, [locale, selectedSeries, debouncedSearchKeyword, collectionFilter, userState]);

  const getCatalogPriceRank = useCallback((card) => {
    const price = catalogMarketPriceByCardId.get(card.id);
    return Math.max(Number(price?.priceUsd || 0), Number(price?.psa10PriceUsd || 0));
  }, [catalogMarketPriceByCardId]);

  const visibleCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      const rarityOk = activeRarity === 'ALL' || getRarityBucket(card.rarity) === activeRarity;
      const collectionOk = collectionFilter === 'owned'
        ? ownedSet.has(card.id)
        : collectionFilter === 'wish'
          ? wishSet.has(card.id)
          : true;
      return rarityOk && collectionOk;
    });
    if (catalogSortMode !== 'price') return filtered;
    return [...filtered].sort((a, b) => {
      const priceDiff = getCatalogPriceRank(b) - getCatalogPriceRank(a);
      if (priceDiff) return priceDiff;
      return String(a.cardNo || '').localeCompare(String(b.cardNo || ''), 'en', { numeric: true });
    });
  }, [cards, activeRarity, collectionFilter, ownedSet, wishSet, catalogSortMode, getCatalogPriceRank]);

  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cards)], [cards]);
  const mobileRarityOptions = ['ALL', 'SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C'];
  const groupedCards = useMemo(() => (
    catalogSortMode === 'price'
    ? [{ rarity: t('catalogSortPrice'), cards: visibleCards }]
      : groupByRarity(visibleCards)
  ), [catalogSortMode, visibleCards]);
  const listingCountByCardId = useMemo(() => {
    const counts = new Map();
    marketListings.forEach((item) => {
      if (!item?.cardId) return;
      counts.set(item.cardId, (counts.get(item.cardId) || 0) + 1);
    });
    return counts;
  }, [marketListings]);

  useEffect(() => {
    if (!rarityPanelOpen) return undefined;
    const closeOnOutside = (event) => {
      if (rarityPanelRef.current && !rarityPanelRef.current.contains(event.target)) {
        setRarityPanelOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [rarityPanelOpen]);

  async function persistState(nextState, changedFields = []) {
    const previousState = userState;
    setUserState(nextState);
    if (!authUser) return;
    const payload = changedFields.length
      ? Object.fromEntries(changedFields.map((field) => [field, nextState?.[field]]))
      : nextState;
    try {
      await saveMyState({ ...payload, __changedFields: changedFields });
    } catch (error) {
      setUserState(previousState);
      window.alert(`저장에 실패했습니다: ${error?.message || 'server_error'}`);
      throw error;
    }
  }

  async function toggleListValue(field, cardId) {
    if (!authUser) {
      window.alert(t('loginRequired'));
      return;
    }
    if (!cardId) {
      window.alert('카드 정보를 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }
    const current = Array.isArray(userState?.[field]) ? userState[field] : [];
    const nextList = current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId];
    await persistState({ ...(userState || {}), [field]: nextList }, [field]);
  }

  function openCard(cardId) {
    const summary = cards.find((card) => card.id === cardId) || null;
    setSelectedCard(summary);
    fetchCardById(cardId)
      .then((detail) => {
        if (!detail) return;
        setSelectedCard((current) => (
          !current || current.id === cardId ? { ...(current || {}), ...detail } : current
        ));
      })
      .catch(() => {});
  }

  useEffect(() => {
    const routeCardId = new URLSearchParams(window.location.search).get('cardId');
    if (routeCardId) openCard(routeCardId);
  }, [viewStateRevision]);

  useEffect(() => {
    if (!selectedCard) {
      setJsonLd('optcg-detail-jsonld', null);
      return;
    }
    setJsonLd('optcg-detail-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: selectedCard.name,
      identifier: selectedCard.cardNo,
      image: selectedCard.imageUrl,
      inLanguage: locale === 'JP' ? 'ja-JP' : 'ko-KR',
      description: `${selectedCard.cardNo} ${selectedCard.rarity} ${selectedCard.seriesName || ''}`.trim(),
      url: `${SITE_ORIGIN}${localizeAppPath(`/prices/card/${encodeURIComponent(selectedCard.cardNo)}`, uiLang)}`
    });
  }, [selectedCard, locale, uiLang]);

  const selectCatalogSeries = (series, options = {}) => {
    setSelectedSeries(series.id);
    setSearchKeyword('');
    setActiveRarity('ALL');
    if (options.closeSection) setOpenSection('');
    if (typeof window !== 'undefined') {
      const nextPath = localizeAppPath(getSeriesRoutePath(series), uiLang);
      if (window.location.pathname !== nextPath) {
        pushAppHistory(nextPath);
      }
    }
  };

  const changeCatalogLocale = (nextLocale) => {
    if (locale === nextLocale) return;
    setLocale(nextLocale);
    setSelectedSeries(getDefaultRenewSeriesId(nextLocale));
    setOpenSection('');
    setActiveRarity('ALL');
    setRarityPanelOpen(false);
  };

  return (
    <main className="renew-catalog">
      <aside className="renew-catalog-side">
        <div className="renew-catalog-headline">
          <span>{t('category')}</span>
          <div className="renew-catalog-locale">
            <button type="button" className={locale === 'KR' ? 'is-active' : ''} onClick={() => changeCatalogLocale('KR')}>{t('searchKr')}</button>
            <button type="button" className={locale === 'JP' ? 'is-active' : ''} onClick={() => changeCatalogLocale('JP')}>{t('searchJp')}</button>
          </div>
        </div>
        <div className="renew-mobile-category-panel">
          <div className="renew-mobile-category-chips" role="tablist" aria-label={t('category')}>
            {mobileCategoryChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={(!chip.id && isAllSeriesMode && !openSection) || (!!chip.id && (openSection === chip.id || (!openSection && selectedSeriesSectionId === chip.id))) ? 'is-active' : ''}
                onClick={() => {
                  setOpenSection(chip.id);
                  if (!chip.id) setSelectedSeries(ALL_SERIES_ID);
                  setSearchKeyword('');
                  setCollectionFilter('all');
                  setActiveRarity('ALL');
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {activeMobileSection ? (
            <div className="renew-mobile-series-list">
              <div className="renew-mobile-series-heading">{activeMobileSection.label} 전체</div>
              {activeMobileSection.children.map((series) => (
                <a
                  key={series.id}
                  href={localizeAppPath(getSeriesRoutePath(series), uiLang)}
                  className={`renew-series-item ${selectedSeries === series.id && !searchKeyword.trim() ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.preventDefault();
                    selectCatalogSeries(series, { closeSection: true });
                  }}
                >
                  <RenewSeriesOptionContent series={series} boxImageByCode={seriesBoxImageByCode} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="renew-catalog-desktop-categories">
          <button type="button" className={`renew-category-row ${isAllSeriesMode ? 'is-open' : ''}`} onClick={() => { setSelectedSeries(ALL_SERIES_ID); setOpenSection(''); setSearchKeyword(''); setCollectionFilter('all'); setActiveRarity('ALL'); }}>
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
                    <a
                      key={series.id}
                      href={localizeAppPath(getSeriesRoutePath(series), uiLang)}
                      className={`renew-series-item ${selectedSeries === series.id && !searchKeyword.trim() ? 'is-active' : ''}`}
                      onClick={(event) => {
                        event.preventDefault();
                        selectCatalogSeries(series);
                      }}
                    >
                      <RenewSeriesOptionContent series={series} boxImageByCode={seriesBoxImageByCode} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <section className="renew-catalog-main" aria-busy={loading || catalogPending}>
        <div className="renew-catalog-toolbar">
          <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder={t('searchPlaceholder')} />
          <div className="renew-mobile-rarity-filter" ref={rarityPanelRef}>
            <button
              type="button"
              className={rarityPanelOpen ? 'is-open' : ''}
              aria-label={rarityPanelOpen ? '필터 닫기' : '필터 열기'}
              onClick={() => setRarityPanelOpen((value) => !value)}
            >
              {rarityPanelOpen ? '×' : '필터'}
            </button>
            {rarityPanelOpen ? (
              <div className="renew-mobile-rarity-menu">
                {mobileRarityOptions.map((rarity) => (
                  <button
                    key={rarity}
                    type="button"
                    className={activeRarity === rarity ? 'is-active' : ''}
                    onClick={() => {
                      setActiveRarity(rarity);
                      setRarityPanelOpen(false);
                    }}
                  >
                    {rarity}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => setSearchKeyword(searchKeyword.trim())}>{t('search')}</button>
        </div>

        <div className="renew-filter-line">
          <div className="renew-chip-group renew-catalog-view-group">
            <span className="renew-chip-group-label">{getLocaleText(uiLang, '보기', 'View', '表示')}</span>
            <button type="button" className={collectionFilter === 'all' ? 'is-active' : ''} onClick={() => setCollectionFilter('all')}>{t('all')}</button>
            <button type="button" className={collectionFilter === 'owned' ? 'is-active' : ''} onClick={() => setCollectionFilter('owned')}>{t('owned')}</button>
            <button type="button" className={collectionFilter === 'wish' ? 'is-active' : ''} onClick={() => setCollectionFilter('wish')}>{t('wishlist')}</button>
          </div>
          <div className="renew-chip-group renew-catalog-sort-group">
            <span className="renew-chip-group-label">{getLocaleText(uiLang, '정렬', 'Sort', '並び替え')}</span>
            <button type="button" className={catalogSortMode === 'rarity' ? 'is-active' : ''} onClick={() => setCatalogSortMode('rarity')}>{t('catalogSortRarity')}</button>
            <button type="button" className={catalogSortMode === 'price' ? 'is-active' : ''} onClick={() => setCatalogSortMode('price')}>{t('catalogSortPrice')}</button>
          </div>
          <div className="renew-chip-group renew-rarity-chip-group">
            {rarityOptions.map((rarity) => (
              <button key={rarity} type="button" className={activeRarity === rarity ? 'is-active' : ''} onClick={() => setActiveRarity(rarity)}>{rarity}</button>
            ))}
          </div>
        </div>

        <div className="renew-catalog-title">
          <div>
            <h2>{searchKeyword.trim() ? t('searchResults') : isAllSeriesMode ? t('all') : currentSeries?.koName}</h2>
            <p>{locale}-{searchKeyword.trim() ? 'SEARCH' : isAllSeriesMode ? 'ALL' : getBaseSeriesId(currentSeries)} {visibleCards.length}{t('cardsUnit')}</p>
          </div>
          {!searchKeyword.trim() && !isAllSeriesMode && currentSeries?.id ? (
            <button type="button" className="renew-series-guide-link" onClick={() => onOpenSeriesGuide?.(currentSeries)}>시리즈 가이드</button>
          ) : null}
        </div>

        {loading ? <div className="renew-empty">{t('loading')}</div> : null}
        {!loading && !visibleCards.length ? <div className="renew-empty">{t('noResults')}</div> : null}
        {!loading ? groupedCards.map((group, groupIndex) => {
          const shouldLimitGroup = catalogSortMode !== 'price' && activeRarity === 'ALL' && collectionFilter === 'all' && (
            isAllSeriesMode || DEFERRED_RARITIES.has(group.rarity)
          ) && !expandedDeferredRarities.has(group.rarity);
          const renderCards = shouldLimitGroup ? group.cards.slice(0, 8) : group.cards;
          const hasMoreCards = shouldLimitGroup && group.cards.length > renderCards.length;
          return (
          <section key={group.rarity} className="renew-grade-section">
            <header>
              <h2>{group.rarity}</h2>
              <span>{group.cards.length}{t('cardsUnit')}</span>
            </header>
            <div className="renew-card-grid">
              {renderCards.map((card, index) => {
                const owned = ownedSet.has(card.id);
                const wished = wishSet.has(card.id);
                const listingCount = MARKETPLACE_ENABLED ? (listingCountByCardId.get(card.id) || 0) : 0;
                const catalogMarketPrice = catalogMarketPriceByCardId.get(card.id);
                return (
                  <article key={card.id} className={`renew-card-tile ${owned ? 'is-owned' : ''} ${wished ? 'is-wished' : ''}`} onClick={() => openCard(card.id)}>
                    <div className="renew-card-image">
                      <img
                        src={getCardThumbnailSrc(card)}
                        data-proxy-fallback-src={getCardThumbnailProxySrc(card)}
                        data-fallback-src={getCardImageSrc(card)}
                        alt={card.name}
                        onError={fallbackToOriginalCardImage}
                        loading={groupIndex === 0 && index < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={groupIndex === 0 && index < 6 ? 'high' : 'auto'}
                      />
                      <button
                        type="button"
                        className={`renew-card-wish-button ${wished ? 'is-wished' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleListValue('wishlistCardIds', card.id);
                        }}
                        aria-label={wished ? '위시리스트에서 제거' : '위시리스트에 추가'}
                        title={wished ? '위시리스트에서 제거' : '위시리스트에 추가'}
                      >
                        ♥
                      </button>
                      {listingCount ? <span className="renew-market-badge">매물 {listingCount}</span> : null}
                    </div>
                      <div className="renew-card-body">
                        <a
                          className="renew-card-code-link"
                          href={localizeAppPath(`/prices/card/${encodeURIComponent(card.cardNo)}`, uiLang)}
                          title={`${card.cardNo} ${card.name} ${getLocaleText(uiLang, '시세', 'price', '相場')}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openCard(card.id);
                          }}
                        >
                          {card.cardNo}
                        </a>
                        <div className="renew-card-price-row" title={card.name}>
                          <span className="renew-card-price-chip">
                            <em>Single</em>
                            <b>{catalogMarketPrice?.priceUsd ? (isJapaneseUi(uiLang) ? formatYen(catalogMarketPrice.priceUsd * MARKET_USD_TO_JPY) : formatCatalogWonFromUsd(catalogMarketPrice.priceUsd)) : '-'}</b>
                          </span>
                          <span className="renew-card-price-chip">
                            <em>PSA10</em>
                            <b>{catalogMarketPrice?.psa10PriceUsd ? (isJapaneseUi(uiLang) ? formatYen(catalogMarketPrice.psa10PriceUsd * MARKET_USD_TO_JPY) : formatCatalogWonFromUsd(catalogMarketPrice.psa10PriceUsd)) : '-'}</b>
                          </span>
                        </div>
                        <div className="renew-card-actions" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className={owned ? 'is-owned' : ''}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleListValue('ownedCardIds', card.id);
                            }}
                          >
                            {owned ? t('cardOwned') : t('cardNotOwned')}
                          </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {hasMoreCards ? (
              <button
                type="button"
                className="renew-deferred-rarity-button"
                onClick={() => setExpandedDeferredRarities((current) => new Set([...current, group.rarity]))}
              >
                {group.rarity} {group.cards.length - renderCards.length}{t('cardsUnit')} 더보기 +
              </button>
            ) : null}
          </section>
        );}) : null}
      </section>

      <RenewSeoSummary page="cards" titleAs="h1" placement="footer" uiLang={uiLang} />
      {selectedCard ? (
        <RenewCardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onOpenMarket={async (card) => {
            const marketLink = await findApprovedCardMarketLink(card);
            setSelectedCard(null);
            onOpenMarket?.({
              code: card?.marketCode || card?.cardNo || '',
              apparelId: marketLink?.apparelId || null,
              cardId: card?.id || card?.cardId || ''
            });
          }}
          onSearchSameName={(name) => {
            setSearchKeyword(name || '');
            setSelectedCard(null);
          }}
          marketListingCount={MARKETPLACE_ENABLED ? (listingCountByCardId.get(selectedCard.id) || 0) : 0}
          authUser={authUser}
          onRequireLogin={onRequireLogin}
          onOpenMarketplace={MARKETPLACE_ENABLED ? ((card) => {
            setSelectedCard(null);
            onOpenMarketplace?.(card);
          }) : undefined}
          uiLang={uiLang}
        />
      ) : null}
    </main>
  );
}

function RenewCardModal({ card, onClose, onOpenMarket, onSearchSameName, marketListingCount = 0, onOpenMarketplace, authUser, onRequireLogin, uiLang }) {
  useBodyScrollLock();
  const t = (key) => getUiText(uiLang, key);
  const [snkrdunkApparelId, setSnkrdunkApparelId] = useState(null);
  const [priceAlertOpen, setPriceAlertOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    setImageLoaded(false);
  }, [card?.id, card?.cardId]);
  useEffect(() => {
    let cancelled = false;
    setSnkrdunkApparelId(null);
    findApprovedCardMarketLink(card)
      .then((link) => {
        if (!cancelled) setSnkrdunkApparelId(link?.apparelId || null);
      })
      .catch(() => {
        if (!cancelled) setSnkrdunkApparelId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [card?.id, card?.cardId, card?.cardNo, card?.locale, card?.parallelIndex]);
  const snkrdunkUrl = snkrdunkApparelId
    ? `https://snkrdunk.com/en/trading-cards/${snkrdunkApparelId}?slide=right`
    : '';
  const openPriceAlert = () => {
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    setPriceAlertOpen(true);
  };
  return (
    <>
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-card-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="renew-modal-close renew-card-modal-close" onClick={onClose}>×</button>
        <div className={`renew-card-modal-image ${imageLoaded ? 'is-loaded' : 'is-loading'}`}>
          <img
            src={getCardThumbnailSrc(card)}
            data-proxy-fallback-src={getCardThumbnailProxySrc(card)}
            data-fallback-src={getCardImageSrc(card)}
            alt={card.name}
            onLoad={() => setImageLoaded(true)}
            onError={fallbackToOriginalCardImage}
            decoding="async"
            fetchPriority="high"
          />
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
            {snkrdunkApparelId && !isJapaneseUi(uiLang) ? <button type="button" className="renew-alert-button" onClick={openPriceAlert}>{getLocaleText(uiLang, '시세 알림', 'Price alert', '相場アラート')}</button> : null}
            {snkrdunkUrl ? <a href={snkrdunkUrl} target="_blank" rel="noreferrer">{t('openSnkrdunk')}</a> : null}
            {marketListingCount ? (
              <button type="button" className="renew-modal-market-link" onClick={() => onOpenMarketplace?.(card)}>
                {getLocaleText(uiLang, `관련 매물 ${marketListingCount}개 보기`, `View ${marketListingCount} related listings`, `関連出品 ${marketListingCount}件を見る`)}
              </button>
            ) : null}
            <button type="button" onClick={() => onSearchSameName?.(card.name)}>{t('searchSameName')}</button>
            {card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer">{t('officialInfo')}</a> : null}
          </div>
        </div>
      </div>
    </div>
    {priceAlertOpen && snkrdunkApparelId ? (
      <RenewPriceAlertModal
        item={{
          apparelId: snkrdunkApparelId,
          cardId: card?.id || card?.cardId || '',
          code: card?.marketCode || card?.cardNo || '',
          name: card?.name || '',
          previewImageUrl: getCardImageSrc(card)
        }}
        isAdmin={authUser?.app_metadata?.role === 'admin'}
        onClose={() => setPriceAlertOpen(false)}
      />
    ) : null}
    </>
  );
}

function RenewMarketplaceHidden() {
  return (
    <main className="renew-subpage">
      <section className="renew-panel renew-marketplace">
        <div className="renew-empty">
          <strong>제휴 채널 준비 중</strong>
          <p>기존 유저 거래 매물은 잠시 숨김 처리했습니다. 제휴 채널로 전환 후 다시 안내하겠습니다.</p>
        </div>
      </section>
    </main>
  );
}

function shuffleSimulatorItems(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function getSimulatorPoolKey(card) {
  if (card?.isSimulatorOnly && card?.category === 'DON') return 'GOLD_DON';
  if (PACK_SIMULATOR_MANGA_CARD_IDS.has(card?.id)) return 'MANGA';
  const raritySource = String(card?.rarity || '').trim().toUpperCase();
  const rarity = getRarityBucket(card?.rarity);
  if (rarity === 'SP' || raritySource.startsWith('SP')) return 'SP';
  const variantSource = `${card?.id || ''} ${card?.variantKey || ''} ${card?.imageUrl || ''}`;
  if (/_p\d+\b/i.test(variantSource) && String(card?.category || '').toUpperCase() === 'LEADER') {
    return 'LEADER_PARALLEL';
  }
  if (/_p\d+\b/i.test(variantSource)) return 'PARALLEL';
  return rarity || 'C';
}

function getSimulatorRarityScore(card) {
  return {
    MANGA: 9,
    GOLD_DON: 9,
    SP: 8,
    LEADER_PARALLEL: 7,
    PARALLEL: 6,
    SEC: 5,
    L: 4,
    SR: 3,
    R: 2,
    UC: 1,
    C: 0,
    P: 0
  }[getSimulatorPoolKey(card)] ?? 0;
}

function pickSimulatorCard(poolMap, keys, usedIds = new Set()) {
  const candidates = keys.flatMap((key) => poolMap.get(key) || []);
  if (!candidates.length) return null;
  const unused = candidates.filter((card) => !usedIds.has(card.id));
  const source = unused.length ? unused : candidates;
  return source[Math.floor(Math.random() * source.length)] || null;
}

function getSimulatorGroupDrawKeys(group) {
  return {
    SP: ['SP', 'PARALLEL'],
    LEADER_PARALLEL: ['LEADER_PARALLEL', 'PARALLEL'],
    SEC: ['SEC', 'PARALLEL'],
    PARALLEL: ['PARALLEL', 'SR'],
    L: ['L'],
    SR: ['SR']
  }[group] || [group];
}

function pickSimulatorGroupCard(poolMap, group, usedIds) {
  for (const key of getSimulatorGroupDrawKeys(group)) {
    const card = pickSimulatorCard(poolMap, [key], usedIds);
    if (card) return card;
  }
  return null;
}

function replaceSimulatorPackHit(box, packIndex, card) {
  const pack = box?.packs?.[packIndex];
  if (!pack?.length || !card) return false;
  pack[Math.max(0, pack.length - 1)] = card;
  return true;
}

function resolveSimulatorGodPack(cardsById, poolMap, config) {
  if (!config) return null;
  const variants = config.variants?.length ? config.variants : [config];
  const selected = variants[Math.floor(Math.random() * variants.length)];
  const cards = selected.cardIds?.length
    ? selected.cardIds.map((cardId) => cardsById.get(cardId)).filter(Boolean)
    : [];
  if (selected.cardIds?.length && cards.length !== selected.cardIds.length) return null;
  const selectedCards = selected.cardIds?.length && selected.count
    ? shuffleSimulatorItems(cards).slice(0, selected.count)
    : cards;
  if (selected.cardIds?.length && selected.count && selectedCards.length !== selected.count) return null;

  const groupCards = (selected.groups || []).flatMap((group) => poolMap.get(group) || []);
  const selectedGroupCards = selected.groups?.length && selected.count
    ? shuffleSimulatorItems(groupCards).slice(0, selected.count)
    : groupCards;
  if (selected.groups?.length && selected.count && selectedGroupCards.length !== selected.count) return null;

  const appendCards = shuffleSimulatorItems(
    (selected.appendGroups || []).flatMap((group) => poolMap.get(group) || [])
  ).slice(0, selected.appendCount || 0);
  if (selected.appendCount && appendCards.length !== selected.appendCount) return null;

  return {
    label: selected.label,
    cards: [...selectedCards, ...selectedGroupCards, ...appendCards]
  };
}

function createSimulatorCarton(cards, seriesId) {
  const seriesRule = PACK_SIMULATOR_RULES_BY_SERIES[seriesId] || {};
  const rule = {
    ...PACK_SIMULATOR_DEFAULT_RULE,
    ...seriesRule,
    cartonBoxHits: seriesRule.cartonBoxHits || PACK_SIMULATOR_DEFAULT_RULE.cartonBoxHits,
    boxBaseHits: seriesRule.boxBaseHits || PACK_SIMULATOR_DEFAULT_RULE.boxBaseHits
  };
  const virtualCards = PACK_SIMULATOR_VIRTUAL_CARDS_BY_SERIES[seriesId] || [];
  const usableCards = [...cards, ...virtualCards].filter((card) => card?.id && card?.imageUrl);
  const cardsById = new Map(usableCards.map((card) => [card.id, card]));
  const poolMap = new Map();
  usableCards.forEach((card) => {
    const key = getSimulatorPoolKey(card);
    poolMap.set(key, [...(poolMap.get(key) || []), card]);
  });
  const fallbackKeys = ['C', 'UC', 'R', 'SR', 'L', 'SEC'];
  const draw = (keys, usedIds) => pickSimulatorCard(poolMap, keys, usedIds)
    || pickSimulatorCard(poolMap, fallbackKeys, usedIds);
  const createBasePack = () => {
    const pack = [];
    const usedIds = new Set();
    [
      ['C'],
      ['C', 'UC'],
      ['C', 'UC'],
      ['UC', 'C'],
      ['R', 'UC', 'C'],
      ['R', 'UC', 'C']
    ].slice(0, rule.cardsPerPack).forEach((keys) => {
      const card = draw(keys, usedIds);
      if (!card) return;
      pack.push(card);
      usedIds.add(card.id);
    });
    while (pack.length < rule.cardsPerPack && usableCards.length) {
      const card = draw(fallbackKeys, usedIds);
      if (!card) break;
      pack.push(card);
      usedIds.add(card.id);
    }
    return pack;
  };
  const boxes = Array.from({ length: rule.boxesPerCarton }, () => ({
    packs: Array.from({ length: rule.packsPerBox }, createBasePack)
  }));

  const boxHitGroups = shuffleSimulatorItems(rule.cartonBoxHits.flatMap(({ group, count }) => (
    Array.from({ length: count }, () => group)
  ))).slice(0, boxes.length);
  boxes.forEach((box, boxIndex) => {
    const packIndexes = shuffleSimulatorItems(Array.from({ length: box.packs.length }, (_, index) => index));
    const mainGroup = boxHitGroups[boxIndex] || 'PARALLEL';
    const mainPackIndex = packIndexes.shift() ?? 0;
    const mainPack = box.packs[mainPackIndex] || [];
    const mainCard = pickSimulatorGroupCard(poolMap, mainGroup, new Set(mainPack.map((item) => item.id)));
    replaceSimulatorPackHit(box, mainPackIndex, mainCard);
    box.mainHit = { group: mainGroup, packIndex: mainPackIndex, cardId: mainCard?.id || '' };

    rule.boxBaseHits.forEach(({ group, count }) => {
      for (let index = 0; index < count; index += 1) {
        const packIndex = packIndexes.shift();
        if (packIndex === undefined) return;
        const pack = box.packs[packIndex] || [];
        const card = pickSimulatorGroupCard(poolMap, group, new Set(pack.map((item) => item.id)));
        replaceSimulatorPackHit(box, packIndex, card);
      }
    });
  });

  const mangaCards = (PACK_SIMULATOR_MANGA_CARD_IDS_BY_SERIES[seriesId] || [])
    .map((cardId) => cardsById.get(cardId))
    .filter(Boolean);
  const godPack = resolveSimulatorGodPack(cardsById, poolMap, PACK_SIMULATOR_GOD_PACKS_BY_SERIES[seriesId]);
  const rareRoll = Math.random();
  let rareCursor = 0;
  let specialEvent = null;

  if (mangaCards.length) {
    rareCursor += rule.mangaRate;
    if (rareRoll < rareCursor) {
      const parallelBoxIndexes = boxes
        .map((box, boxIndex) => (box.mainHit?.group === 'PARALLEL' ? boxIndex : -1))
        .filter((boxIndex) => boxIndex >= 0);
      const boxIndex = parallelBoxIndexes[Math.floor(Math.random() * parallelBoxIndexes.length)]
        ?? Math.floor(Math.random() * boxes.length);
      const packIndex = boxes[boxIndex]?.mainHit?.packIndex ?? 0;
      const card = mangaCards[Math.floor(Math.random() * mangaCards.length)];
      if (replaceSimulatorPackHit(boxes[boxIndex], packIndex, card)) {
        boxes[boxIndex].mainHit = { group: 'MANGA', packIndex, cardId: card.id };
        specialEvent = { type: 'manga', label: 'MANGA RARE', boxIndex, packIndex };
      }
    }
  }

  if (!specialEvent && godPack?.cards.length) {
    rareCursor += rule.godPackRate;
    if (rareRoll < rareCursor) {
      const boxIndex = Math.floor(Math.random() * boxes.length);
      const packIndexes = Array.from({ length: boxes[boxIndex]?.packs.length || 0 }, (_, index) => index)
        .filter((packIndex) => packIndex !== boxes[boxIndex]?.mainHit?.packIndex);
      const packIndex = packIndexes[Math.floor(Math.random() * packIndexes.length)] ?? 0;
      boxes[boxIndex].packs[packIndex] = godPack.cards;
      specialEvent = {
        type: 'god-pack',
        label: godPack.label,
        boxIndex,
        packIndex
      };
    }
  }

  return { boxes, rule, specialEvent };
}

function createPackSimulatorResult(unit, cards, seriesId) {
  const carton = createSimulatorCarton(cards, seriesId);
  if (unit === 'carton') {
    return {
      unit,
      boxes: carton.boxes,
      rule: carton.rule,
      specialEvent: carton.specialEvent
    };
  }
  const boxIndex = Math.floor(Math.random() * carton.boxes.length);
  const box = carton.boxes[boxIndex] || carton.boxes[0];
  if (unit === 'box') {
    return {
      unit,
      boxes: box ? [box] : [],
      rule: carton.rule,
      specialEvent: carton.specialEvent?.boxIndex === boxIndex ? carton.specialEvent : null
    };
  }
  const packIndex = Math.floor(Math.random() * (box?.packs.length || 1));
  const pack = box?.packs[packIndex] || box?.packs[0] || [];
  return {
    unit: 'pack',
    boxes: [{ packs: [pack] }],
    rule: carton.rule,
    specialEvent: carton.specialEvent?.boxIndex === boxIndex && carton.specialEvent?.packIndex === packIndex
      ? carton.specialEvent
      : null
  };
}

function groupSimulatorCards(cards, priceByCardId) {
  const grouped = new Map();
  cards.forEach((card) => {
    if (!card?.id) return;
    const current = grouped.get(card.id) || {
      card,
      quantity: 0,
      priceUsd: Number(priceByCardId.get(card.id)?.priceUsd || 0)
    };
    current.quantity += 1;
    grouped.set(card.id, current);
  });
  return [...grouped.values()].sort((a, b) => (
    getSimulatorRarityScore(b.card) - getSimulatorRarityScore(a.card)
    || b.priceUsd - a.priceUsd
    || String(a.card.cardNo || '').localeCompare(String(b.card.cardNo || ''), 'en', { numeric: true })
  ));
}

function formatSimulatorPrice(priceUsd, uiLang) {
  if (!Number(priceUsd || 0)) return getLocaleText(uiLang, '가격 정보 없음', 'No price data', '価格情報なし');
  if (isJapaneseUi(uiLang)) return formatYen(Number(priceUsd) * MARKET_USD_TO_JPY);
  if (uiLang === 'EN') return formatUsd(priceUsd);
  return formatCatalogWonFromUsd(priceUsd);
}

function RenewPackSimulator({ uiLang, onOpenCard, onOpenGuide }) {
  const [locale, setLocale] = useState('JP');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [unit, setUnit] = useState('pack');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(1);
  const [fastOpened, setFastOpened] = useState(false);
  const [autoOpening, setAutoOpening] = useState(false);
  const [priceByCardId, setPriceByCardId] = useState(() => new Map());
  const [boxImageByCode, setBoxImageByCode] = useState(() => new Map(
    boxMarketItems
      .filter((item) => item.code && item.previewImageUrl)
      .map((item) => [item.code, item.previewImageUrl])
  ));
  const openingTimerRef = useRef(null);
  const sequenceTimerRef = useRef(null);
  const simulatorSeries = useMemo(() => sortDescByCode(seriesData.filter((series) => {
    const baseId = getBaseSeriesId(series);
    return (series.locale || 'KR') === locale
      && /^(OP|EB|PRB)\d+$/.test(baseId)
      && /BOOSTER/.test(String(series.kindEn || ''))
      && Number(seriesCardCounts?.[series.id] || 1) > 0;
  })), [locale]);
  const selectedSeries = useMemo(() => (
    simulatorSeries.find((series) => series.id === selectedSeriesId) || simulatorSeries[0] || null
  ), [selectedSeriesId, simulatorSeries]);
  const productImageUrl = getSeriesBoxPreviewUrl(selectedSeries, boxImageByCode);

  useEffect(() => {
    const nextSeriesId = simulatorSeries[0]?.id || '';
    if (!simulatorSeries.some((series) => series.id === selectedSeriesId)) setSelectedSeriesId(nextSeriesId);
  }, [selectedSeriesId, simulatorSeries]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedSeries?.id) {
      setCards([]);
      return undefined;
    }
    setLoading(true);
    fetchCards({ locale, series: selectedSeries.id })
      .then((items) => {
        if (!cancelled) setCards(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, selectedSeries?.id]);

  useEffect(() => {
    setResult(null);
    setOpening(false);
    setProgressIndex(0);
    setRevealedCount(1);
    setFastOpened(false);
    setAutoOpening(false);
  }, [locale, selectedSeriesId, unit]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadCardMarketLinks(),
      import('./data/market-cards.js'),
      fetch('/api/market?summary=latest')
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
    ])
      .then(([links, marketModule, marketSummary]) => {
        if (cancelled) return;
        const marketItems = Array.isArray(marketModule.default) ? marketModule.default : [];
        const itemByApparelId = new Map(marketItems.map((item) => [String(item.apparelId), item]));
        const latestByApparelId = new Map(
          (Array.isArray(marketSummary?.items) ? marketSummary.items : [])
            .filter((item) => item?.apparelId)
            .map((item) => [String(item.apparelId), item])
        );
        const next = new Map();
        links.forEach((link) => {
          if (link?.status !== 'approved' || !link.cardId || !link.apparelId) return;
          const item = itemByApparelId.get(String(link.apparelId));
          const latest = latestByApparelId.get(String(link.apparelId));
          const priceUsd = Number(latest?.aPriceUsd || item?.minPrice || 0);
          if (item && priceUsd > 0) next.set(link.cardId, { priceUsd, apparelId: item.apparelId });
        });
        setPriceByCardId(next);
      })
      .catch(() => {
        if (!cancelled) setPriceByCardId(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (openingTimerRef.current) window.clearTimeout(openingTimerRef.current);
    if (sequenceTimerRef.current) window.clearTimeout(sequenceTimerRef.current);
  }, []);

  useEffect(() => {
    if (!result || result.unit === 'pack' || fastOpened || !autoOpening) return undefined;
    const finalIndex = result.unit === 'box'
      ? Math.max(0, (result.boxes[0]?.packs.length || 1) - 1)
      : Math.max(0, result.boxes.length - 1);
    if (progressIndex >= finalIndex) {
      setAutoOpening(false);
      return undefined;
    }
    const isSpecialStep = result.unit === 'box'
      ? result.specialEvent?.packIndex === progressIndex
      : result.specialEvent?.boxIndex === progressIndex;
    const delay = result.unit === 'box'
      ? (isSpecialStep ? 1250 : 480)
      : (isSpecialStep ? 1600 : 900);
    sequenceTimerRef.current = window.setTimeout(() => {
      setProgressIndex((value) => Math.min(finalIndex, value + 1));
      sequenceTimerRef.current = null;
    }, delay);
    return () => {
      if (sequenceTimerRef.current) window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    };
  }, [autoOpening, fastOpened, progressIndex, result]);

  function startOpening() {
    if (!selectedSeries?.id || !cards.length || loading || opening) return;
    if (openingTimerRef.current) window.clearTimeout(openingTimerRef.current);
    setOpening(true);
    setResult(null);
    setProgressIndex(0);
    setRevealedCount(1);
    setFastOpened(false);
    setAutoOpening(false);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    openingTimerRef.current = window.setTimeout(() => {
      const nextResult = createPackSimulatorResult(unit, cards, selectedSeries.id);
      const packLength = nextResult.boxes[0]?.packs[0]?.length || 0;
      setResult(nextResult);
      setRevealedCount(nextResult.unit === 'pack' ? packLength : 1);
      setAutoOpening(nextResult.unit !== 'pack' && !reducedMotion);
      setOpening(false);
      openingTimerRef.current = null;
    }, reducedMotion ? 120 : 900);
  }

  const unitLabel = {
    pack: getLocaleText(uiLang, '1팩', '1 Pack', '1パック'),
    box: getLocaleText(uiLang, '1박스', '1 Box', '1ボックス'),
    carton: getLocaleText(uiLang, '1카톤', '1 Carton', '1カートン')
  }[unit];
  const currentPack = result?.unit === 'pack'
    ? result.boxes[0]?.packs[0] || []
    : result?.unit === 'box'
      ? result.boxes[0]?.packs[progressIndex] || []
      : [];
  const currentBoxCards = result?.unit === 'carton'
    ? result.boxes[progressIndex]?.packs.flat() || []
    : [];
  const currentBoxHits = useMemo(() => {
    const hits = currentBoxCards
      .filter((card) => getSimulatorRarityScore(card) >= 3)
      .sort((a, b) => getSimulatorRarityScore(b) - getSimulatorRarityScore(a));
    return hits.length ? hits : [...currentBoxCards].sort((a, b) => getSimulatorRarityScore(b) - getSimulatorRarityScore(a)).slice(0, 8);
  }, [currentBoxCards]);
  const isComplete = Boolean(result) && (
    result.unit === 'pack'
      ? revealedCount >= currentPack.length
      : result.unit === 'box'
        ? fastOpened || progressIndex >= (result.boxes[0]?.packs.length || 1) - 1
        : fastOpened || progressIndex >= result.boxes.length - 1
  );
  const visibleSpecialEvent = result?.specialEvent && (
    result.unit === 'pack'
      || (result.unit === 'box' && progressIndex >= result.specialEvent.packIndex)
      || (result.unit === 'carton' && progressIndex >= result.specialEvent.boxIndex)
  ) ? result.specialEvent : null;
  const visibleCards = useMemo(() => {
    if (!result) return [];
    if (result.unit === 'pack') return currentPack.slice(0, revealedCount);
    if (result.unit === 'box') {
      return (fastOpened ? result.boxes[0]?.packs : result.boxes[0]?.packs.slice(0, progressIndex + 1))?.flat() || [];
    }
    return (fastOpened ? result.boxes : result.boxes.slice(0, progressIndex + 1)).flatMap((box) => box.packs.flat());
  }, [currentPack, fastOpened, progressIndex, result, revealedCount]);
  const groupedCards = useMemo(() => groupSimulatorCards(visibleCards, priceByCardId), [priceByCardId, visibleCards]);
  const totalPriceUsd = useMemo(() => groupedCards.reduce((total, item) => (
    total + (item.priceUsd * item.quantity)
  ), 0), [groupedCards]);
  const displayCards = result?.unit === 'carton' ? currentBoxHits : currentPack;

  function showNextResult() {
    if (!result || result.unit === 'pack') return;
    setAutoOpening(false);
    setProgressIndex((value) => (
      result.unit === 'box'
        ? Math.min((result.boxes[0]?.packs.length || 1) - 1, value + 1)
        : Math.min(result.boxes.length - 1, value + 1)
    ));
  }

  function revealAllResults() {
    if (!result || result.unit === 'pack') return;
    setAutoOpening(false);
    setFastOpened(true);
    setProgressIndex(
      result.unit === 'box'
        ? Math.max(0, (result.boxes[0]?.packs.length || 1) - 1)
        : Math.max(0, result.boxes.length - 1)
    );
  }

  return (
    <main className="renew-subpage renew-pack-simulator-page">
      <header className="renew-pack-simulator-header renew-profit-head">
        <div><span>PACK SIMULATOR</span></div>
        <button type="button" className="renew-profit-primary-button" onClick={onOpenGuide}>
          {getLocaleText(uiLang, '사용 가이드', 'User guide', '利用ガイド')}
        </button>
      </header>

      <section className="renew-pack-simulator-setup" aria-label={getLocaleText(uiLang, '개봉 설정', 'Opening settings', '開封設定')}>
        <div className="renew-pack-locale-control" role="group" aria-label={getLocaleText(uiLang, '카드 언어', 'Card language', 'カード言語')}>
          {['JP', 'KR'].map((value) => (
            <button key={value} type="button" className={locale === value ? 'is-active' : ''} onClick={() => setLocale(value)}>
              {value}
            </button>
          ))}
        </div>
        <label className="renew-pack-series-select">
          <span>{getLocaleText(uiLang, '카드 시리즈', 'Card series', 'カードシリーズ')}</span>
          <select value={selectedSeries?.id || ''} onChange={(event) => setSelectedSeriesId(event.target.value)}>
            {simulatorSeries.map((series) => (
              <option key={series.id} value={series.id}>
                {getBaseSeriesId(series)} · {series.koName || series.enName}
              </option>
            ))}
          </select>
        </label>
        <div className="renew-pack-unit-control" role="group" aria-label={getLocaleText(uiLang, '개봉 단위', 'Opening unit', '開封単位')}>
          {[
            ['pack', getLocaleText(uiLang, '1팩', '1 Pack', '1パック')],
            ['box', getLocaleText(uiLang, '1박스', '1 Box', '1ボックス')],
            ['carton', getLocaleText(uiLang, '1카톤', '1 Carton', '1カートン')]
          ].map(([value, label]) => (
            <button key={value} type="button" className={unit === value ? 'is-active' : ''} onClick={() => setUnit(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={`renew-pack-opening-stage ${opening ? 'is-opening' : ''} ${result ? 'has-result' : ''}`}>
        {!result ? (
          <>
            <div className="renew-pack-product-visual" aria-hidden="true">
              {productImageUrl ? (
                <img src={productImageUrl} alt="" onError={placeholderImage} />
              ) : (
                <span>{getBaseSeriesId(selectedSeries)}</span>
              )}
              <i>{unitLabel}</i>
            </div>
            <div className="renew-pack-opening-copy">
              <strong>{opening
                ? getLocaleText(uiLang, '개봉 중...', 'Opening...', '開封中...')
                : selectedSeries
                  ? `${getBaseSeriesId(selectedSeries)} · ${unitLabel}`
                  : getLocaleText(uiLang, '시리즈를 선택해 주세요.', 'Select a series.', 'シリーズを選択してください。')}</strong>
              <button type="button" onClick={startOpening} disabled={loading || opening || !cards.length}>
                {loading
                  ? getLocaleText(uiLang, '카드 불러오는 중', 'Loading cards', 'カード読込中')
                  : getLocaleText(uiLang, '개봉하기', 'Open', '開封する')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="renew-pack-result-heading">
              <div>
                <span>{getBaseSeriesId(selectedSeries)}</span>
                <h2>{result.unit === 'pack'
                  ? getLocaleText(uiLang, '팩 개봉 결과', 'Pack result', 'パック結果')
                  : result.unit === 'box'
                    ? `${getLocaleText(uiLang, '팩 개봉', 'Pack', 'パック')} ${progressIndex + 1} / ${result.boxes[0]?.packs.length || 0}`
                    : `${getLocaleText(uiLang, '박스 결과', 'Box', 'ボックス')} ${progressIndex + 1} / ${result.boxes.length}`}</h2>
                {visibleSpecialEvent ? (
                  <mark className="renew-pack-special-event">{visibleSpecialEvent.label}</mark>
                ) : null}
              </div>
              <button type="button" onClick={startOpening}>{getLocaleText(uiLang, '다시 개봉', 'Open again', 'もう一度')}</button>
            </div>
            <div className={`renew-pack-reveal-grid is-${result.unit}`}>
              {displayCards.map((card, index) => {
                const hidden = result.unit === 'pack' && index >= revealedCount;
                const price = priceByCardId.get(card.id)?.priceUsd || 0;
                return (
                  <article key={`${result.unit}-${progressIndex}-${card.id}-${index}`} className={`renew-pack-reveal-card ${hidden ? 'is-hidden' : ''} ${getSimulatorRarityScore(card) >= 5 ? 'is-premium' : ''}`}>
                    {hidden ? (
                      <button type="button" className="renew-pack-card-back" onClick={() => setRevealedCount((value) => Math.min(currentPack.length, Math.max(value, index + 1)))}>
                        <span>CARD Pone</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="renew-pack-card-image"
                          disabled={card.isSimulatorOnly}
                          onClick={() => onOpenCard?.(card)}
                        >
                          <img src={getCardThumbnailSrc(card)} data-proxy-fallback-src={getCardThumbnailProxySrc(card)} data-fallback-src={getCardImageSrc(card)} alt={card.name || card.cardNo} onError={fallbackToOriginalCardImage} />
                        </button>
                        <div>
                          <span>{getSimulatorPoolKey(card)}</span>
                          <strong>{card.cardNo}</strong>
                          <p>{card.name}</p>
                          <small>{formatSimulatorPrice(price, uiLang)}</small>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="renew-pack-progress-actions">
              {result.unit !== 'pack' && !isComplete ? (
                <>
                  <button type="button" onClick={() => setAutoOpening((value) => !value)}>
                    {autoOpening
                      ? getLocaleText(uiLang, '일시 정지', 'Pause', '一時停止')
                      : getLocaleText(uiLang, '자동 개봉', 'Auto open', '自動開封')}
                  </button>
                  <button type="button" className="is-secondary" onClick={showNextResult}>
                    {result.unit === 'box'
                      ? getLocaleText(uiLang, '다음 팩', 'Next pack', '次のパック')
                      : getLocaleText(uiLang, '다음 박스', 'Next box', '次のボックス')}
                  </button>
                  <button type="button" className="is-secondary" onClick={revealAllResults}>
                    {getLocaleText(uiLang, '전체 건너뛰기', 'Skip all', 'すべてスキップ')}
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </section>

      {result ? (
        <section className="renew-pack-summary">
          <header>
            <div>
              <span>{isComplete ? getLocaleText(uiLang, '전체 결과', 'Full result', '全体結果') : getLocaleText(uiLang, '현재까지', 'Revealed', '現在まで')}</span>
              <strong>{visibleCards.length.toLocaleString('ko-KR')}{getLocaleText(uiLang, '장', ' cards', '枚')}</strong>
            </div>
            <div>
              <span>{getLocaleText(uiLang, '확인된 시세 합계', 'Known price total', '価格合計')}</span>
              <strong>{formatSimulatorPrice(totalPriceUsd, uiLang)}</strong>
            </div>
          </header>
          <div className="renew-pack-summary-list">
            {groupedCards.map(({ card, quantity, priceUsd }) => (
              <button key={card.id} type="button" disabled={card.isSimulatorOnly} onClick={() => onOpenCard?.(card)}>
                <img src={getCardThumbnailSrc(card)} data-proxy-fallback-src={getCardThumbnailProxySrc(card)} data-fallback-src={getCardImageSrc(card)} alt="" onError={fallbackToOriginalCardImage} />
                <span>
                  <small>{getSimulatorPoolKey(card)} · {card.cardNo}</small>
                  <strong>{card.name}</strong>
                  <em>{formatSimulatorPrice(priceUsd, uiLang)}</em>
                </span>
                <b>×{quantity}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function getLabToolGuideContent(type, uiLang = 'KR') {
  const locale = uiLang === 'JP' ? 'JP' : uiLang === 'EN' ? 'EN' : 'KR';
  const copy = {
    centering: {
      KR: {
        eyebrow: 'CENTERING GUIDE',
        title: '센터링 측정기 사용 가이드',
        tool: '측정기로 돌아가기',
        sections: [
          ['1. 촬영 준비', '슬리브와 탑로더를 제거하고 반사가 적은 단색 바닥에 카드 전체가 보이도록 촬영합니다. 네 모서리가 사진 안에 있어야 원근 보정이 가능합니다.'],
          ['2. 카드 외곽 조정', '네 모서리 점을 카드의 실제 바깥 모서리에 맞춥니다. 사진이 기울었거나 사다리꼴이어도 외곽을 정확히 지정하면 정면 형태로 보정됩니다.'],
          ['3. 내부 테두리 조정', '보정된 카드에서 실제 인쇄 경계의 좌우·상하 선을 맞춥니다. 카드 그림이나 문자 위치가 아니라 인쇄 테두리를 기준으로 조정합니다.'],
          ['4. 결과 확인', '좌우와 상하 비율, 참고 구간, 측정 신뢰도를 함께 확인합니다. 결과는 센터링만 다루며 모서리·표면·인쇄 결함은 평가하지 않습니다.']
        ],
        faq: [
          { question: '사진이 조금 기울어져도 측정할 수 있나요?', answer: '네 모서리가 모두 보이고 카드 외곽을 정확히 맞출 수 있으면 원근 보정 후 측정할 수 있습니다. 기울기가 과도하거나 일부 모서리가 가려지면 신뢰도가 낮아질 수 있습니다.' },
          { question: '표시된 점수가 실제 감정 등급인가요?', answer: '아닙니다. 센터링 비율을 감정사 기준과 비교한 참고값이며 표면, 모서리, 엣지, 인쇄 상태를 포함한 최종 감정 등급이 아닙니다.' },
          { question: '촬영한 사진이 서버에 저장되나요?', answer: '아닙니다. 센터링 분석은 현재 기기 안에서 처리하며 촬영하거나 선택한 이미지를 서버에 저장하지 않습니다.' }
        ],
        note: '조명 반사와 내부 인쇄 경계의 위치에 따라 결과가 달라질 수 있으므로 최종 감정 판단이 아닌 비교용 참고값으로 이용하세요.'
      },
      EN: {
        eyebrow: 'CENTERING GUIDE',
        title: 'Centering Check Guide',
        tool: 'Back to checker',
        sections: [
          ['1. Prepare the card', 'Remove sleeves and holders, use a low-glare plain background, and keep all four card corners visible.'],
          ['2. Set the card outline', 'Place the four points on the actual outer corners. The tool corrects perspective after the outline is confirmed.'],
          ['3. Set the print border', 'Align the left, right, top, and bottom lines with the printed inner border rather than artwork or text.'],
          ['4. Read the result', 'Review horizontal and vertical ratios with the confidence indicator. Surface, corner, edge, and print defects are not graded.']
        ],
        faq: [
          { question: 'Can I use a tilted photo?', answer: 'Yes, if all four corners are visible and the outer outline can be placed accurately. Extreme perspective may lower reliability.' },
          { question: 'Is the result a final grading score?', answer: 'No. It is a centering-only reference and does not include surface, corners, edges, or print quality.' },
          { question: 'Is my image uploaded?', answer: 'No. The image is processed on the current device and is not stored on the server.' }
        ],
        note: 'Use the result as a centering reference. Reflections and uncertain print borders can affect the measurement.'
      },
      JP: {
        eyebrow: 'CENTERING GUIDE',
        title: 'センタリング測定ガイド',
        tool: '測定に戻る',
        sections: [
          ['1. 撮影準備', 'スリーブとローダーを外し、反射の少ない単色の背景でカードの四隅がすべて見えるように撮影します。'],
          ['2. カード外枠の調整', '4つの点を実際のカード外側の角に合わせます。確定後に傾きと台形歪みを補正します。'],
          ['3. 印刷境界の調整', '絵柄や文字ではなく、実際の印刷境界に左右・上下の線を合わせます。'],
          ['4. 結果の確認', '左右・上下の比率と測定信頼度を確認します。表面、角、エッジ、印刷欠陥は評価しません。']
        ],
        faq: [
          { question: '写真が少し傾いていても測定できますか？', answer: '四隅がすべて見え、外枠を正確に指定できれば補正後に測定できます。強い傾きは信頼度を下げます。' },
          { question: '結果は鑑定の最終グレードですか？', answer: 'いいえ。センタリングのみの参考値で、表面、角、エッジ、印刷状態は含みません。' },
          { question: '画像はサーバーに保存されますか？', answer: 'いいえ。画像は現在の端末内で処理され、サーバーには保存されません。' }
        ],
        note: '反射や印刷境界の判定によって結果が変わるため、最終鑑定ではなく比較用の参考値として利用してください。'
      }
    },
    packSimulator: {
      KR: {
        eyebrow: 'PACK SIMULATOR GUIDE',
        title: '카드깡 시뮬레이터 사용 가이드',
        tool: '시뮬레이터로 돌아가기',
        sections: [
          ['1. 시리즈 선택', '개봉할 카드 언어와 부스터 시리즈를 선택합니다. 결과 카드는 현재 Card Pone 도감에 연결된 해당 시리즈 카드로 구성됩니다.'],
          ['2. 개봉 단위 선택', '1팩은 한 팩 결과, 1박스는 팩 단위 진행, 1카톤은 박스별 주요 결과를 순서대로 보여줍니다. 빠른 개봉으로 남은 결과를 한 번에 확인할 수 있습니다.'],
          ['3. 확률 구조', '박스와 팩은 내부에서 가상 카톤을 먼저 구성한 뒤 그 안의 박스와 팩을 무작위로 선택합니다. 반복 횟수가 많아질수록 설정된 카톤 봉입 규칙의 기댓값에 가까워지는 구조입니다.'],
          ['4. 결과와 시세', '획득 카드의 이미지, 번호, 등급과 확인 가능한 참고 시세를 보여주며 도감 상세로 이동할 수 있습니다. 시세가 연결되지 않은 카드는 가격 합계에서 제외됩니다.']
        ],
        faq: [
          { question: '실제 상품의 봉입 결과를 보장하나요?', answer: '아닙니다. 제공된 봉입 규칙을 바탕으로 만든 가상 개봉이며 실제 상품의 구성과 결과를 보장하지 않습니다.' },
          { question: '같은 시리즈를 다시 열면 결과가 같나요?', answer: '아닙니다. 개봉할 때마다 새로운 가상 카톤과 무작위 선택을 사용하므로 결과가 달라집니다.' },
          { question: '결과 가격은 실제 판매가인가요?', answer: 'Card Pone에 연결된 최근 참고 시세입니다. 카드 상태, 거래 시점과 판매처에 따라 실제 가격은 달라질 수 있습니다.' }
        ],
        note: '가상 개봉은 구매 결과를 예측하거나 보장하지 않습니다. 봉입 규칙은 확인된 자료에 따라 시리즈별로 조정될 수 있습니다.'
      },
      EN: {
        eyebrow: 'PACK SIMULATOR GUIDE',
        title: 'Pack Simulator Guide',
        tool: 'Back to simulator',
        sections: [
          ['1. Select a series', 'Choose the card language and booster series. Results use cards linked to that series in the Card Pone catalog.'],
          ['2. Select an opening unit', 'Open one pack, step through a box pack by pack, or review a carton by box. Skip controls reveal the remaining result.'],
          ['3. Probability model', 'The simulator creates a virtual carton first, then randomly selects a box and pack. Repeated openings approach the configured carton expectations.'],
          ['4. Results and prices', 'Review card images, numbers, rarities, and available reference prices. Cards without a linked price are excluded from the total.']
        ],
        faq: [
          { question: 'Does this guarantee real product pulls?', answer: 'No. It is a virtual opening based on configured rules and cannot guarantee the contents of a real product.' },
          { question: 'Will repeated openings give the same result?', answer: 'No. Each opening creates a new virtual carton and random selection.' },
          { question: 'Are result prices actual sale prices?', answer: 'They are recent reference prices linked in Card Pone and may differ by condition, date, and marketplace.' }
        ],
        note: 'The simulator does not predict or guarantee purchase results. Series rules may be updated when better information becomes available.'
      },
      JP: {
        eyebrow: 'PACK SIMULATOR GUIDE',
        title: '開封シミュレーターガイド',
        tool: 'シミュレーターに戻る',
        sections: [
          ['1. シリーズ選択', 'カード言語とブースターシリーズを選択します。結果はCard Poneの図鑑に接続されたカードで構成されます。'],
          ['2. 開封単位選択', '1パック、パック単位で進む1ボックス、ボックス別に確認する1カートンから選択できます。'],
          ['3. 確率モデル', '内部で仮想カートンを作成し、その中からボックスとパックをランダムに選びます。試行回数が増えると設定された封入ルールの期待値に近づきます。'],
          ['4. 結果と価格', 'カード画像、番号、レアリティ、確認できる参考価格を表示します。価格未接続のカードは合計から除外されます。']
        ],
        faq: [
          { question: '実際の商品の封入結果を保証しますか？', answer: 'いいえ。設定された封入ルールによる仮想開封であり、実際の商品の内容を保証しません。' },
          { question: '同じシリーズを再度開封すると同じ結果ですか？', answer: 'いいえ。開封ごとに新しい仮想カートンとランダム選択を使用します。' },
          { question: '表示価格は実売価格ですか？', answer: 'Card Poneに接続された最近の参考価格で、状態、時期、販売先によって異なる場合があります。' }
        ],
        note: '仮想開封は購入結果を予測・保証するものではありません。封入ルールは確認資料に応じて更新される場合があります。'
      }
    },
    deckBuilder: {
      KR: {
        eyebrow: 'DECK BUILDER GUIDE',
        title: '덱 빌더 사용 가이드',
        tool: '덱 빌더로 돌아가기',
        sections: [
          ['1. 카드 환경과 리더 선택', '한국판, 일본판, 영어판 환경을 먼저 선택한 뒤 사용할 리더를 고릅니다. 리더를 선택하면 해당 리더 색상으로 사용할 수 있는 카드만 검색됩니다.'],
          ['2. 시작할 덱 선택', '검증된 입상 덱을 불러오거나 리더만 선택해 빈 덱에서 시작할 수 있습니다. 불러온 덱도 카드 매수를 자유롭게 조정할 수 있습니다.'],
          ['3. 카드 추가와 규칙 확인', '메인 덱은 50장으로 구성하며 같은 카드번호는 기본적으로 최대 4장까지 넣을 수 있습니다. 화면의 규칙 검사에서 매수, 색상, 금지·제한 카드 상태를 확인하세요.'],
          ['4. 덱 저장과 비교', '구성한 덱은 현재 계정 또는 기기에 저장됩니다. 검증된 덱을 다시 불러와 카드 구성을 비교하거나 다른 버전으로 조정할 수 있습니다.']
        ],
        faq: [
          { question: '처음 시작하는 사람도 사용할 수 있나요?', answer: '네. 첫 화면의 검증된 입상 덱을 불러오면 완성된 50장 구성에서 카드를 한 장씩 바꾸며 익힐 수 있습니다.' },
          { question: '찾는 카드가 검색되지 않는 이유는 무엇인가요?', answer: '선택한 리더의 색상과 맞지 않거나 현재 선택한 한국판·일본판·영어판 환경에 없는 카드일 수 있습니다.' },
          { question: '검증된 덱은 항상 현재 대회 환경과 같나요?', answer: '등록된 출처와 당시 카드 환경을 기준으로 구성된 참고 덱입니다. 금지·제한 카드와 발매 환경이 바뀌면 현재 사용 가능 여부가 달라질 수 있습니다.' }
        ],
        note: '덱 규칙 검사는 구성 보조 기능입니다. 실제 대회 참가 전에는 해당 지역의 최신 공식 규정과 금지·제한 카드 공지를 함께 확인하세요.'
      },
      EN: {
        eyebrow: 'DECK BUILDER GUIDE',
        title: 'Deck Builder Guide',
        tool: 'Back to deck builder',
        sections: [
          ['1. Choose an environment and leader', 'Select KR, JP, or EN, then choose a leader. Card search is filtered to colors that the selected leader can use.'],
          ['2. Choose a starting deck', 'Load a verified tournament deck or start from an empty deck with only a leader. Loaded deck counts remain editable.'],
          ['3. Add cards and check rules', 'Build a 50-card main deck with up to four copies of the same card number by default. Review count, color, and restriction checks as you edit.'],
          ['4. Save and compare', 'Your deck is stored for the current account or device. Reload a verified list to compare it with your changes or create another version.']
        ],
        faq: [
          { question: 'Can a beginner use the deck builder?', answer: 'Yes. Load a verified 50-card list first, then learn the deck by replacing cards one at a time.' },
          { question: 'Why is a card missing from search?', answer: 'It may not match the leader colors or may not exist in the selected KR, JP, or EN environment.' },
          { question: 'Are verified decks always legal in the current format?', answer: 'They reflect their listed source and format. Always check current regional restrictions before entering an event.' }
        ],
        note: 'The rule checker assists deck construction. Confirm the latest official regional rules and restricted-card announcements before tournament play.'
      },
      JP: {
        eyebrow: 'DECK BUILDER GUIDE',
        title: 'デッキビルダーガイド',
        tool: 'デッキビルダーに戻る',
        sections: [
          ['1. 環境とリーダーを選択', 'KR・JP・ENの環境を選び、使用するリーダーを選択します。カード検索はリーダーが使用できる色に絞り込まれます。'],
          ['2. 開始デッキを選択', '検証済み大会デッキを読み込むか、リーダーだけを選んで空のデッキから開始できます。読み込んだ枚数も変更できます。'],
          ['3. カード追加とルール確認', 'メインデッキは50枚で、同じカード番号は基本4枚までです。枚数、色、禁止・制限カードの確認結果を見ながら編集します。'],
          ['4. 保存と比較', '作成したデッキは現在のアカウントまたは端末に保存されます。検証済みデッキを再度読み込み、変更内容を比較できます。']
        ],
        faq: [
          { question: '初心者でも利用できますか？', answer: 'はい。検証済みの50枚デッキを読み込み、カードを少しずつ入れ替えながら構成を学べます。' },
          { question: '検索にカードが表示されないのはなぜですか？', answer: 'リーダーの色と一致しないか、選択したKR・JP・EN環境に存在しない可能性があります。' },
          { question: '検証済みデッキは現在も使用できますか？', answer: '登録された出典と当時の環境に基づく参考デッキです。大会前に最新の禁止・制限カードを確認してください。' }
        ],
        note: 'ルール確認はデッキ構築を補助する機能です。大会参加前に地域別の最新公式ルールを確認してください。'
      }
    }
  };
  return copy[type]?.[locale] || copy[type]?.KR;
}

function RenewLabToolGuide({ type, uiLang, onOpenTool }) {
  const copy = getLabToolGuideContent(type, uiLang);
  return (
    <main className="renew-subpage renew-profit-guide-page">
      <header className="renew-profit-head">
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
        </div>
        <button type="button" className="renew-profit-primary-button" onClick={onOpenTool}>{copy.tool}</button>
      </header>
      <section className="renew-profit-guide-grid">
        {copy.sections.map(([title, body]) => (
          <article key={title} className="renew-panel renew-profit-guide-card">
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="renew-panel renew-profit-faq-panel">
        <h2>FAQ</h2>
        <div>
          {copy.faq.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <p className="renew-profit-guide-note">{copy.note}</p>
      </section>
    </main>
  );
}

function RenewLabHome({ uiLang, onOpenCentering, onOpenSimulator, onOpenPortfolioCalculator, onOpenDeckLab }) {
  const tools = [
    {
      id: 'centering',
      icon: 'lab',
      status: getLocaleText(uiLang, '사용 가능', 'Available', '利用可能'),
      title: getLocaleText(uiLang, '센터링 측정기', 'Centering Check', 'センタリング測定'),
      description: getLocaleText(uiLang, '카드 인쇄 영역의 좌우·상하 비율을 확인합니다.', 'Check the left/right and top/bottom print balance.', 'カード印刷領域の左右・上下バランスを確認します。'),
      onClick: onOpenCentering
    },
    {
      id: 'simulator',
      icon: 'supplies',
      status: getLocaleText(uiLang, '사용 가능', 'Available', '利用可能'),
      title: getLocaleText(uiLang, '카드깡 시뮬레이터', 'Pack Simulator', 'パックシミュレーター'),
      description: getLocaleText(uiLang, '카드 팩을 가상으로 개봉하는 도구입니다.', 'Open card packs virtually.', 'カードパックをバーチャルで開封します。'),
      onClick: onOpenSimulator
    },
    {
      id: 'portfolio-calculator',
      icon: 'prices',
      status: getLocaleText(uiLang, '사용 가능', 'Available', '利用可能'),
      title: getLocaleText(uiLang, '포트폴리오 수익률 계산기', 'Portfolio Return Calculator', 'ポートフォリオ収益率計算'),
      description: getLocaleText(uiLang, '매입 정보와 현재 참고 시세로 평가손익을 계산합니다.', 'Compare purchase details with the current reference price.', '購入情報と現在の参考価格から評価損益を計算します。'),
      onClick: onOpenPortfolioCalculator
    },
    {
      id: 'deck-builder',
      icon: 'cards',
      status: getLocaleText(uiLang, '사용 가능', 'Available', '利用可能'),
      title: getLocaleText(uiLang, '덱 빌더', 'Deck Builder', 'デッキビルダー'),
      description: getLocaleText(uiLang, '리더를 선택하고 덱 규칙을 확인하며 카드를 구성합니다.', 'Choose a leader, build a deck, and check its rules.', 'リーダーを選び、ルールを確認しながらデッキを構築します。'),
      onClick: onOpenDeckLab
    }
  ];

  return (
    <main className="renew-subpage renew-lab-page">
      <section className="renew-lab-grid" aria-label={getLocaleText(uiLang, '실험실 도구', 'Lab tools', 'ラボツール')}>
        {tools.map((tool) => tool.onClick ? (
          <button key={tool.id} type="button" className="renew-lab-tool is-available" onClick={tool.onClick}>
            <span className="renew-lab-tool-icon"><MobileNavIcon type={tool.icon} /></span>
            <span className="renew-lab-tool-copy">
              <strong>{tool.title}</strong>
              <span>{tool.description}</span>
            </span>
            <span className="renew-lab-tool-arrow" aria-hidden="true">→</span>
          </button>
        ) : (
          <article key={tool.id} className="renew-lab-tool is-coming" aria-label={`${tool.title} ${tool.status}`}>
            <span className="renew-lab-tool-icon"><MobileNavIcon type={tool.icon} /></span>
            <span className="renew-lab-tool-copy">
              <small>{tool.status}</small>
              <strong>{tool.title}</strong>
              <span>{tool.description}</span>
            </span>
          </article>
        ))}
      </section>
      <section className="renew-lab-context" aria-label={getLocaleText(uiLang, '실험실 이용 안내', 'Lab usage notes', 'ラボ利用案内')}>
        <article>
          <h2>{getLocaleText(uiLang, '로그인 없이 사용', 'Available without login', 'ログイン不要')}</h2>
          <p>{getLocaleText(
            uiLang,
            '센터링 측정, 가상 개봉, 덱 구성과 수익률 계산은 로그인하지 않아도 사용할 수 있습니다. 저장이 필요한 기능만 로그인을 요청합니다.',
            'Centering checks, virtual openings, deck building, and return calculations are available without signing in. Sign-in is requested only when saving data.',
            'センタリング測定、開封シミュレーション、デッキ構築、収益率計算はログインなしで利用できます。保存時のみログインが必要です。'
          )}</p>
        </article>
        <article>
          <h2>{getLocaleText(uiLang, '결과의 범위', 'How to read results', '結果の範囲')}</h2>
          <p>{getLocaleText(
            uiLang,
            '측정값, 가상 봉입 결과, 덱 검사와 참고 시세 계산은 수집을 돕는 보조 정보이며 감정 등급, 실제 개봉 결과, 대회 적합성 또는 거래 수익을 보장하지 않습니다.',
            'Measurements, simulated pulls, deck checks, and reference-price calculations are supporting information and do not guarantee grading, actual pulls, tournament legality, or profit.',
            '測定値、仮想封入結果、デッキチェック、参考相場の計算は補助情報であり、鑑定結果、実際の開封結果、大会適合性、利益を保証しません。'
          )}</p>
        </article>
      </section>
    </main>
  );
}

const MARKETPLACE_SAMPLE_LISTINGS = [
  {
    id: 'sample-yamato',
    cardId: 'JP::OP01-121_p2',
    cardNo: 'OP01-121',
    locale: 'JP',
    title: 'Yamato SEC-SPC 판매/교환',
    subtitle: 'OP01-121 · JP · PSA10',
    price: '₩ 가격 협의',
    time: '방금 전 등록',
    seller: '판매자 프로필',
    sellerNote: '카페 인증 완료 표시와 거래 상태를 보여주는 영역입니다.',
    sellerStatus: '인증 완료',
    description: '거래글 설명 영역입니다. 카드 상태, 원하는 교환 카드, 직거래 가능 지역, 택배 거래 조건을 판매자가 간단히 남기는 구조로 구성합니다.',
    tradeType: '교환',
    tags: ['JP', 'PSA10', '교환 가능'],
    likes: '관심 0',
    views: '조회 0'
  },
  {
    id: 'sample-luffy',
    cardId: 'JP::ST21-014',
    cardNo: 'ST21-014',
    locale: 'JP',
    title: 'Monkey.D.Luffy 프로모 판매',
    subtitle: 'ST21-014 · JP · SR',
    price: '₩ 25,000',
    time: '10분 전 등록',
    seller: '카페 인증 판매자',
    sellerNote: '최근 접속과 인증 상태를 판매자 프로필에서 확인할 수 있습니다.',
    sellerStatus: '인증 완료',
    description: '실물 사진과 상태 설명을 확인한 뒤 문의하도록 구성합니다. 거래 방식은 판매자가 선택합니다.',
    tradeType: '판매',
    tags: ['JP', 'SR', '택배 가능'],
    likes: '관심 2',
    views: '조회 18'
  },
  {
    id: 'sample-trade',
    cardId: 'JP::OP16-063',
    cardNo: 'OP16-063',
    locale: 'JP',
    title: 'OP-16 패러렐 교환 희망',
    subtitle: 'OP16-063 · JP · Parallel',
    price: '교환 제안',
    time: '1시간 전 등록',
    seller: '판매자 프로필',
    sellerNote: '카페 등급 인증이 완료된 판매자만 등록할 수 있게 설계합니다.',
    sellerStatus: '인증 완료',
    description: '원하는 교환 카드, 추가금 여부, 직거래 가능 지역을 본문에 표시하는 구조입니다.',
    tradeType: '교환',
    tags: ['JP', 'Parallel', '직거래'],
    likes: '관심 5',
    views: '조회 41'
  }
];

const EMPTY_MARKET_VERIFICATION_FORM = {
  cafeNickname: '',
  cafeProfileUrl: '',
  cafeGrade: '',
  note: ''
};

function RenewMarketplace({ authUser, marketListings, setMarketListings, filterCardId, onClearFilter, onOpenPrice }) {
  const [selectedListing, setSelectedListing] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [marketGuideOpen, setMarketGuideOpen] = useState(false);
  const [verificationSubmitted, setVerificationSubmitted] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [marketSaving, setMarketSaving] = useState(false);
  const [adminVerificationRows, setAdminVerificationRows] = useState([]);
  const [adminUpdatingId, setAdminUpdatingId] = useState('');
  const [adminVerificationTab, setAdminVerificationTab] = useState('pending');
  const [registerPhotos, setRegisterPhotos] = useState([]);
  const [registerCardLocale, setRegisterCardLocale] = useState('JP');
  const [registerCardQuery, setRegisterCardQuery] = useState('');
  const [registerCardCandidates, setRegisterCardCandidates] = useState([]);
  const [registerCardLoading, setRegisterCardLoading] = useState(false);
  const [registerLinkedCard, setRegisterLinkedCard] = useState(null);
  const [editingListingId, setEditingListingId] = useState('');
  const [marketListingFilter, setMarketListingFilter] = useState('all');
  const [sellerVerification, setSellerVerification] = useState(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySending, setInquirySending] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationRows, setConversationRows] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [conversationMessages, setConversationMessages] = useState([]);
  const [conversationText, setConversationText] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationSending, setConversationSending] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState('active');
  const [selectedMarketImageIndex, setSelectedMarketImageIndex] = useState(0);
  const [marketImageViewerOpen, setMarketImageViewerOpen] = useState(false);
  const [marketImageViewerScale, setMarketImageViewerScale] = useState(1);
  const [marketImageViewerOffset, setMarketImageViewerOffset] = useState({ x: 0, y: 0 });
  const [likedListingIds, setLikedListingIds] = useState(() => readMarketInterestIds(authUser?.id));
  const [interestSavingId, setInterestSavingId] = useState('');
  const marketImageDragRef = useRef(null);
  const marketImageTouchRef = useRef(null);
  const [registerForm, setRegisterForm] = useState({
    title: '',
    cardCode: '',
    cardName: '',
    tradeType: '판매',
    condition: 'A등급',
    price: '',
    negotiable: false,
    delivery: '택배',
    region: '',
    description: ''
  });
  const [verificationForm, setVerificationForm] = useState(EMPTY_MARKET_VERIFICATION_FORM);
  const [marketNotice, setMarketNotice] = useState('');
  const marketFilterOptions = [
    { id: 'all', label: '전체' },
    { id: 'sale', label: '판매' },
    { id: 'trade', label: '교환' },
    { id: 'reserved', label: '예약' },
    { id: 'closed', label: '거래완료' }
  ];
  const listingStatusLabels = {
    active: '판매중',
    hidden: '예약',
    closed: '거래완료'
  };
  const visibleListings = useMemo(() => {
    const baseListings = filterCardId ? marketListings.filter((item) => item.cardId === filterCardId) : marketListings;
    return baseListings.filter((item) => {
      if (marketListingFilter === 'sale') return item.rawStatus === 'active' && (item.tradeType === '판매' || item.tags?.includes('판매'));
      if (marketListingFilter === 'trade') return item.rawStatus === 'active' && (item.tradeType === '교환' || item.tags?.some((tag) => String(tag).includes('교환')));
      if (marketListingFilter === 'reserved') return item.rawStatus === 'hidden';
      if (marketListingFilter === 'closed') return item.rawStatus === 'closed';
      return true;
    });
  }, [filterCardId, marketListingFilter, marketListings]);
  const listing = selectedListing || visibleListings[0] || marketListings[0];
  const listingImages = useMemo(() => {
    const urls = [
      ...(Array.isArray(listing?.imageUrls) ? listing.imageUrls : []),
      listing?.imageUrl
    ].filter(Boolean);
    const uniqueUrls = [...new Set(urls)].filter((url) => !String(url).includes('/card-placeholder.svg'));
    return uniqueUrls.length ? uniqueUrls : [listing?.imageUrl || '/card-placeholder.svg'];
  }, [listing]);
  const activeListingImage = listingImages[selectedMarketImageIndex] || listingImages[0] || '/card-placeholder.svg';
  const resetMarketImageViewer = () => {
    setMarketImageViewerScale(1);
    setMarketImageViewerOffset({ x: 0, y: 0 });
    marketImageDragRef.current = null;
    marketImageTouchRef.current = null;
  };
  const openMarketImageViewer = () => {
    resetMarketImageViewer();
    setMarketImageViewerOpen(true);
  };
  const closeMarketImageViewer = () => {
    setMarketImageViewerOpen(false);
    resetMarketImageViewer();
  };
  const setMarketViewerScale = (nextScale) => {
    const scale = Math.max(1, Math.min(4, nextScale));
    setMarketImageViewerScale(scale);
    if (scale === 1) setMarketImageViewerOffset({ x: 0, y: 0 });
  };
  const getTouchDistance = (touches) => {
    const [first, second] = touches;
    if (!first || !second) return 0;
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };
  const handleMarketViewerWheel = (event) => {
    event.preventDefault();
    setMarketViewerScale(marketImageViewerScale + (event.deltaY < 0 ? 0.2 : -0.2));
  };
  const handleMarketViewerPointerDown = (event) => {
    if (marketImageViewerScale <= 1) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    marketImageDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset: marketImageViewerOffset
    };
  };
  const handleMarketViewerPointerMove = (event) => {
    const drag = marketImageDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setMarketImageViewerOffset({
      x: drag.offset.x + event.clientX - drag.startX,
      y: drag.offset.y + event.clientY - drag.startY
    });
  };
  const handleMarketViewerPointerUp = () => {
    marketImageDragRef.current = null;
  };
  const handleMarketViewerTouchStart = (event) => {
    if (event.touches.length !== 2) return;
    marketImageTouchRef.current = {
      distance: getTouchDistance(event.touches),
      scale: marketImageViewerScale
    };
  };
  const handleMarketViewerTouchMove = (event) => {
    const touchState = marketImageTouchRef.current;
    if (!touchState || event.touches.length !== 2) return;
    event.preventDefault();
    const nextDistance = getTouchDistance(event.touches);
    if (!nextDistance || !touchState.distance) return;
    setMarketViewerScale(touchState.scale * (nextDistance / touchState.distance));
  };
  const isMarketplaceAdmin = authUser?.app_metadata?.role === 'admin';
  const isListingOwner = Boolean(authUser?.id && listing?.sellerUserId && authUser.id === listing.sellerUserId);
  const listingInterested = Boolean(listing?.id && likedListingIds.has(String(listing.id)));
  const sellerVerificationApproved = sellerVerification?.status === 'approved';
  const displayedAdminVerificationRows = adminVerificationRows.filter((row) => row.rawStatus === adminVerificationTab);
  const adminVerificationCounts = {
    pending: adminVerificationRows.filter((row) => row.rawStatus === 'pending').length,
    approved: adminVerificationRows.filter((row) => row.rawStatus === 'approved').length
  };

  useEffect(() => {
    setLikedListingIds(readMarketInterestIds(authUser?.id));
  }, [authUser?.id]);

  const openListing = (nextListing) => {
    setVerificationOpen(false);
    setRegisterOpen(false);
    setAdminPanelOpen(false);
    setSelectedMarketImageIndex(0);
    setSelectedListing(nextListing);
    if (nextListing?.id) {
      incrementMarketplaceListingView(nextListing.id)
        .then((payload) => {
          const updated = payload?.listing;
          if (!updated?.id) return;
          setMarketListings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          setSelectedListing((current) => (current?.id === updated.id ? updated : current));
        })
        .catch(() => {});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openInquiry = () => {
    if (!authUser) {
      setMarketNotice('로그인이 필요합니다.');
      return;
    }
    if (!listing?.id) {
      setMarketNotice('문의할 매물을 찾을 수 없습니다.');
      return;
    }
    if (isListingOwner) {
      setMarketNotice('본인 매물에는 문의할 수 없습니다.');
      return;
    }
    if (listing.rawStatus !== 'active') {
      setMarketNotice('판매중 게시물에만 문의할 수 있습니다.');
      return;
    }
    setInquiryMessage('');
    setInquiryOpen(true);
  };
  const loadConversationMessages = async (conversationId) => {
    if (!conversationId) return;
    if (conversationRows.length && !conversationRows.some((row) => row.id === conversationId)) {
      setSelectedConversationId('');
      setConversationMessages([]);
      setMarketNotice('접근할 수 없는 거래방입니다.');
      return;
    }
    setSelectedConversationId(conversationId);
    setConversationLoading(true);
    try {
      const payload = await fetchMarketplaceMessages(conversationId);
      setConversationMessages(Array.isArray(payload?.messages) ? payload.messages : []);
    } catch {
      setConversationMessages([]);
      setMarketNotice('거래방 메시지를 불러오지 못했습니다.');
    } finally {
      setConversationLoading(false);
    }
  };
  const openConversationPanel = async (preferredConversationId = '') => {
    if (!authUser) {
      setMarketNotice('로그인이 필요합니다.');
      return;
    }
    setConversationOpen(true);
    setConversationLoading(true);
    setConversationRows([]);
    setSelectedConversationId('');
    setConversationMessages([]);
    setConversationText('');
    try {
      const payload = await fetchMarketplaceConversations();
      const rows = Array.isArray(payload?.conversations) ? payload.conversations : [];
      setConversationRows(rows);
      const targetId = preferredConversationId && rows.some((row) => row.id === preferredConversationId)
        ? preferredConversationId
        : rows[0]?.id || '';
      setSelectedConversationId(targetId);
      if (targetId) {
        const messagesPayload = await fetchMarketplaceMessages(targetId);
        setConversationMessages(Array.isArray(messagesPayload?.messages) ? messagesPayload.messages : []);
      } else {
        setConversationMessages([]);
      }
    } catch {
      setConversationRows([]);
      setConversationMessages([]);
      setMarketNotice('거래방을 불러오지 못했습니다.');
    } finally {
      setConversationLoading(false);
    }
  };
  const selectedConversation = conversationRows.find((conversation) => conversation.id === selectedConversationId) || null;
  const selectedConversationClosed = selectedConversation?.listingStatus === 'closed' || selectedConversation?.status === 'closed';
  const submitConversationMessage = async (event) => {
    event.preventDefault();
    if (!selectedConversationId || selectedConversationClosed || !conversationText.trim() || conversationSending) return;
    setConversationSending(true);
    try {
      const payload = await sendMarketplaceMessage({
        conversationId: selectedConversationId,
        message: conversationText.trim()
      });
      setConversationMessages((current) => [...current, payload?.message].filter(Boolean));
      setConversationText('');
    } catch {
      setMarketNotice('메시지 전송에 실패했습니다.');
    } finally {
      setConversationSending(false);
    }
  };
  const updateSelectedListing = (nextListing) => {
    if (!nextListing?.id) return;
    setMarketListings((current) => (
      nextListing.rawStatus !== 'deleted'
        ? current.map((item) => (item.id === nextListing.id ? nextListing : item))
        : current.filter((item) => item.id !== nextListing.id)
    ));
    setSelectedListing(nextListing.rawStatus !== 'deleted' ? nextListing : null);
  };
  const toggleListingInterest = async () => {
    if (!authUser) {
      setMarketNotice('로그인이 필요합니다.');
      return;
    }
    if (!listing?.id || isListingOwner || interestSavingId) return;
    const listingId = String(listing.id);
    const nextActive = !likedListingIds.has(listingId);
    setInterestSavingId(listingId);
    try {
      const payload = await updateMarketplaceListingInterest(listingId, nextActive);
      const updated = payload?.listing;
      if (updated?.id) updateSelectedListing(updated);
      setLikedListingIds((current) => {
        const next = new Set(current);
        if (nextActive) next.add(listingId);
        else next.delete(listingId);
        writeMarketInterestIds(authUser.id, next);
        return next;
      });
    } catch (error) {
      setMarketNotice(error?.message === 'cannot_like_own_listing' ? '본인 게시물은 관심 표시할 수 없습니다.' : '관심 표시를 저장하지 못했습니다.');
    } finally {
      setInterestSavingId('');
    }
  };
  const changeListingStatus = async () => {
    if (!listing?.id || marketSaving || !statusDraft) return;
    setMarketSaving(true);
    try {
      const payload = await updateMarketplaceListing(listing.id, { status: statusDraft });
      updateSelectedListing(payload?.listing);
      setStatusModalOpen(false);
      setMarketNotice(`게시물 상태를 ${listingStatusLabels[statusDraft] || '판매중'}으로 변경했습니다.`);
    } catch {
      setMarketNotice('게시물 상태 변경에 실패했습니다.');
    } finally {
      setMarketSaving(false);
    }
  };
  const deleteListing = async () => {
    if (!listing?.id || marketSaving) return;
    if (typeof window !== 'undefined' && !window.confirm('이 게시물을 삭제할까요?')) return;
    setMarketSaving(true);
    try {
      await deleteMarketplaceListing(listing.id);
      setMarketListings((current) => current.filter((item) => item.id !== listing.id));
      setSelectedListing(null);
      setMarketNotice('게시물을 삭제했습니다.');
    } catch {
      setMarketNotice('게시물 삭제에 실패했습니다.');
    } finally {
      setMarketSaving(false);
    }
  };
  const openEditListing = () => {
    if (!listing?.id) return;
    setEditingListingId(listing.id);
    setRegisterForm({
      title: listing.title || '',
      cardCode: listing.cardNo || '',
      cardName: listing.cardName || '',
      tradeType: listing.tradeType || '판매',
      condition: listing.condition || 'A등급',
      price: listing.priceKrw ? String(listing.priceKrw) : '',
      negotiable: Boolean(listing.negotiable),
      delivery: listing.delivery || '택배',
      region: listing.region || '',
      description: listing.description || ''
    });
    setRegisterLinkedCard(null);
    setRegisterCardCandidates([]);
    setRegisterCardQuery('');
    setSelectedListing(null);
    setVerificationOpen(false);
    setAdminPanelOpen(false);
    setRegisterOpen(true);
  };
  const openStatusModal = () => {
    if (!listing?.id) return;
    setStatusDraft(['active', 'hidden', 'closed'].includes(listing.rawStatus) ? listing.rawStatus : 'active');
    setStatusModalOpen(true);
  };
  const openRegister = () => {
    if (!authUser) {
      setMarketNotice('로그인이 필요합니다.');
      return;
    }
    if (!sellerVerificationApproved) {
      setMarketNotice('카페 인증 승인 후 판매 등록을 이용할 수 있습니다.');
      return;
    }
    setSelectedListing(null);
    setEditingListingId('');
    setVerificationOpen(false);
    setAdminPanelOpen(false);
    setRegisterOpen(true);
  };
  const openVerification = () => {
    if (!authUser) {
      setMarketNotice('로그인이 필요합니다.');
      return;
    }
    setVerificationForm(EMPTY_MARKET_VERIFICATION_FORM);
    setVerificationSubmitted(false);
    setSelectedListing(null);
    setRegisterOpen(false);
    setAdminPanelOpen(false);
    setVerificationOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openAdminPanel = () => {
    setSelectedListing(null);
    setVerificationOpen(false);
    setVerificationSubmitted(false);
    setVerificationForm(EMPTY_MARKET_VERIFICATION_FORM);
    setRegisterOpen(false);
    setAdminPanelOpen(true);
    fetchMarketplaceVerifications()
      .then((payload) => {
        const rows = Array.isArray(payload?.verifications) ? payload.verifications : [];
        setAdminVerificationRows(rows.map((row) => ({
          id: row.id,
          nickname: row.cafe_nickname,
          profileUrl: row.cafe_profile_url,
          grade: row.cafe_grade || '미입력',
          note: row.note || '메모 없음',
          rawStatus: row.status || 'pending',
          status: row.status === 'approved' ? '승인됨' : row.status === 'rejected' ? '반려됨' : '검토 대기중'
        })));
      })
      .catch(() => {
        setAdminVerificationRows([]);
        setMarketNotice('인증 신청 목록을 불러오지 못했습니다.');
      });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const updateVerificationStatus = async (id, status) => {
    if (!id || String(id).startsWith('local-')) return;
    setAdminUpdatingId(id);
    try {
      const payload = await updateMarketplaceVerification(id, status);
      const row = payload?.verification;
      if (!row?.id) return;
      setAdminVerificationRows((current) => current.map((item) => (
        item.id === row.id
          ? {
              ...item,
              rawStatus: row.status || status,
              status: row.status === 'approved' ? '승인됨' : row.status === 'rejected' ? '반려됨' : '검토 대기중'
            }
          : item
      )));
      setMarketNotice(status === 'approved' ? '인증 신청을 승인했습니다.' : '인증 신청을 반려했습니다.');
    } catch {
      setMarketNotice('인증 상태 변경에 실패했습니다.');
    } finally {
      setAdminUpdatingId('');
    }
  };
  const deleteVerificationRow = async (id) => {
    if (!id || adminUpdatingId) return;
    const target = adminVerificationRows.find((item) => item.id === id);
    const message = target?.rawStatus === 'approved'
      ? '이 유저의 판매자 인증을 해제할까요? 유저 계정은 삭제되지 않습니다.'
      : '이 인증 신청 기록을 삭제할까요? 유저 계정은 삭제되지 않습니다.';
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    setAdminUpdatingId(id);
    try {
      await deleteMarketplaceVerification(id);
      setAdminVerificationRows((current) => current.filter((item) => item.id !== id));
      setMarketNotice(target?.rawStatus === 'approved' ? '판매자 인증을 해제했습니다.' : '인증 기록을 삭제했습니다.');
    } catch {
      setMarketNotice('인증 기록 삭제에 실패했습니다.');
    } finally {
      setAdminUpdatingId('');
    }
  };
  const updateRegisterForm = (field, value) => {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  };
  const resetRegisterForm = () => {
    setRegisterForm({
      title: '',
      cardCode: '',
      cardName: '',
      tradeType: '판매',
      condition: 'A등급',
      price: '',
      negotiable: false,
      delivery: '택배',
      region: '',
      description: ''
    });
    setRegisterPhotos([]);
    setRegisterCardQuery('');
    setRegisterCardCandidates([]);
    setRegisterLinkedCard(null);
  };
  const closeRegister = () => {
    setRegisterOpen(false);
    setEditingListingId('');
  };
  const registerReady = registerForm.title.trim() && (registerForm.negotiable || registerForm.price.trim());
  const submitRegister = async (event) => {
    event.preventDefault();
    if (!registerReady || marketSaving) return;
    if (!sellerVerificationApproved) {
      setMarketNotice('카페 인증 승인 후 판매 등록을 이용할 수 있습니다.');
      return;
    }
    const code = registerForm.cardCode.trim();
    const name = registerForm.cardName.trim();
    const fallbackImageUrl = registerLinkedCard ? getCardThumbnailSrc(registerLinkedCard) : '/card-placeholder.svg';
    const nextListing = {
      id: `local-${Date.now()}`,
      title: registerForm.title.trim(),
      subtitle: [code, name, registerForm.condition].filter(Boolean).join(' · ') || registerForm.condition,
      price: registerForm.negotiable ? '가격 협의' : `₩ ${Number(registerForm.price.replace(/,/g, '') || 0).toLocaleString('ko-KR')}`,
      time: '방금 전 등록',
      seller: getUserDisplayName(authUser),
      sellerNote: '로그인 판매자가 등록한 매물입니다.',
      sellerStatus: isMarketplaceAdmin ? '관리자' : '로그인 판매자',
      description: registerForm.description.trim() || '판매자가 상세 설명을 입력하지 않았습니다.',
      tags: [registerForm.tradeType, registerForm.condition, registerForm.delivery].filter(Boolean),
      tradeType: registerForm.tradeType,
      likes: '관심 0',
      views: '조회 0',
      cardId: registerLinkedCard?.id || '',
      cardNo: registerLinkedCard?.cardNo || code,
      locale: registerLinkedCard?.locale || registerCardLocale,
      imageUrl: registerPhotos[0]?.url || fallbackImageUrl,
      imageUrls: registerPhotos.length ? registerPhotos.map((photo) => photo.url) : [fallbackImageUrl]
    };
    setMarketSaving(true);
    try {
      const uploadedImageUrls = registerPhotos.length
        ? await Promise.all(registerPhotos.map(async (photo) => {
            const compressed = await compressMarketplaceImage(photo.file);
            const uploaded = await uploadMarketplaceImage({
              fileName: photo.name,
              data: compressed.data,
              mimeType: compressed.mimeType
            });
            return uploaded.imageUrl;
          }))
        : [];
      const persistentImageUrl = uploadedImageUrls[0] || fallbackImageUrl;
      const payload = editingListingId
        ? await updateMarketplaceListing(editingListingId, {
            title: registerForm.title.trim(),
            tradeType: registerForm.tradeType,
            condition: registerForm.condition,
            priceKrw: registerForm.price,
            negotiable: registerForm.negotiable,
            delivery: registerForm.delivery,
            region: registerForm.region,
            description: registerForm.description,
            ...(uploadedImageUrls.length ? { imageUrl: persistentImageUrl, imageUrls: uploadedImageUrls } : {}),
            tags: [registerForm.tradeType, registerForm.condition, registerForm.delivery].filter(Boolean)
          })
        : await createMarketplaceListing({
            title: registerForm.title.trim(),
            cardId: registerLinkedCard?.id || '',
            cardNo: registerLinkedCard?.cardNo || code,
            locale: registerLinkedCard?.locale || registerCardLocale,
            cardName: registerLinkedCard?.name || name,
            tradeType: registerForm.tradeType,
            condition: registerForm.condition,
            priceKrw: registerForm.price,
            negotiable: registerForm.negotiable,
            delivery: registerForm.delivery,
            region: registerForm.region,
            description: registerForm.description,
            imageUrl: persistentImageUrl,
            imageUrls: uploadedImageUrls.length ? uploadedImageUrls : [persistentImageUrl],
            tags: [registerForm.tradeType, registerForm.condition, registerForm.delivery].filter(Boolean)
          });
      setMarketListings((current) => (
        editingListingId
          ? current.map((item) => (item.id === payload?.listing?.id ? payload.listing : item))
          : [payload?.listing || nextListing, ...current.filter((item) => item.id !== payload?.listing?.id)]
      ));
    } catch (error) {
      const message = error?.message === 'seller_not_verified'
        ? '카페 인증 승인 후 판매 등록을 이용할 수 있습니다.'
        : error?.message === 'daily_listing_limit_exceeded'
          ? '하루 판매 게시물은 최대 5개까지 등록할 수 있습니다.'
          : editingListingId ? '매물 수정에 실패했습니다.' : '판매 등록에 실패했습니다.';
      setMarketNotice(message);
      return;
    } finally {
      setMarketSaving(false);
    }
    setSelectedListing(null);
    setRegisterOpen(false);
    setEditingListingId('');
    resetRegisterForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const updateRegisterPhotos = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6);
    const nextPhotos = files.map((file) => ({
      name: file.name,
      file,
      url: URL.createObjectURL(file)
    }));
    setRegisterPhotos(nextPhotos);
  };
  const searchRegisterCards = async (event) => {
    event?.preventDefault?.();
    const query = (registerCardQuery || registerForm.cardCode || registerForm.cardName).trim();
    if (!query) return;
    setRegisterCardLoading(true);
    try {
      const result = await searchCards(query, registerCardLocale);
      setRegisterCardCandidates(Array.isArray(result) ? result.slice(0, 8) : []);
    } catch {
      setRegisterCardCandidates([]);
    } finally {
      setRegisterCardLoading(false);
    }
  };
  const selectRegisterCard = (card) => {
    setRegisterLinkedCard(card);
    setRegisterForm((current) => ({
      ...current,
      cardCode: card.cardNo || current.cardCode,
      cardName: card.name || current.cardName
    }));
    setRegisterCardCandidates([]);
    setRegisterCardQuery('');
  };
  const closeVerification = () => {
    setVerificationOpen(false);
    setVerificationSubmitted(false);
    setVerificationForm(EMPTY_MARKET_VERIFICATION_FORM);
  };
  const updateVerificationForm = (field, value) => {
    setVerificationForm((current) => ({ ...current, [field]: value }));
  };
  const verificationReady = verificationForm.cafeNickname.trim() && verificationForm.cafeProfileUrl.trim();
  const submitVerification = async (event) => {
    event.preventDefault();
    if (!verificationReady || marketSaving) return;
    setMarketSaving(true);
    try {
      await submitMarketplaceVerification(verificationForm);
      setVerificationSubmitted(true);
    } catch (error) {
      setMarketNotice(error?.message === 'duplicate_cafe_profile' ? '이미 다른 계정에서 사용 중인 카페 프로필입니다.' : '인증 신청 접수에 실패했습니다.');
    } finally {
      setMarketSaving(false);
    }
  };
  const submitInquiry = async (event) => {
    event.preventDefault();
    if (!listing?.id || !inquiryMessage.trim() || inquirySending) return;
    setInquirySending(true);
    try {
      const payload = await startMarketplaceConversation({
        listingId: listing.id,
        message: inquiryMessage.trim()
      });
      setInquiryOpen(false);
      setInquiryMessage('');
      await openConversationPanel(payload?.conversation?.id || '');
    } catch (error) {
      setMarketNotice(error?.message === 'cannot_message_own_listing' ? '본인 매물에는 문의할 수 없습니다.' : '문의 전송에 실패했습니다.');
    } finally {
      setInquirySending(false);
    }
  };
  const marketplaceModalOpen = Boolean(verificationOpen || registerOpen || marketGuideOpen || marketNotice || inquiryOpen || conversationOpen || statusModalOpen || marketImageViewerOpen);
  useBodyScrollLock(marketplaceModalOpen);
  useEffect(() => {
    setVerificationOpen(false);
    setVerificationSubmitted(false);
    setVerificationForm(EMPTY_MARKET_VERIFICATION_FORM);
    setAdminPanelOpen(false);
    setAdminVerificationRows([]);
    setAdminUpdatingId('');
    setAdminVerificationTab('pending');
    setConversationOpen(false);
    setConversationRows([]);
    setSelectedConversationId('');
    setConversationMessages([]);
    setConversationText('');
    setInquiryOpen(false);
    setInquiryMessage('');
  }, [authUser?.id]);
  useEffect(() => {
    if (!authUser?.id) {
      setSellerVerification(null);
      return;
    }
    let cancelled = false;
    fetchMarketplaceMyVerification()
      .then((payload) => {
        if (!cancelled) setSellerVerification(payload?.verification || null);
      })
      .catch(() => {
        if (!cancelled) setSellerVerification(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, verificationSubmitted]);
  useEffect(() => {
    if (typeof window === 'undefined' || !marketListings.length) return;
    const returnListingId = window.sessionStorage.getItem('optcg_market_return_listing_id');
    if (!returnListingId) return;
    const matchedListing = marketListings.find((item) => String(item.id) === returnListingId);
    if (!matchedListing) return;
    setSelectedListing(matchedListing);
    window.sessionStorage.removeItem('optcg_market_return_listing_id');
  }, [marketListings]);
  useEffect(() => {
    setSelectedMarketImageIndex(0);
  }, [listing?.id]);
  useEffect(() => {
    return () => {
      registerPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, [registerPhotos]);

  return (
    <main className={`renew-subpage ${marketplaceModalOpen ? 'is-marketplace-modal-open' : ''}`}>
      <section className="renew-panel renew-marketplace">
        <div className="renew-marketplace-head">
          <div>
            <h1 className="renew-sr-only">거래</h1>
          </div>
          <div className="renew-marketplace-actions">
            <button type="button" className="renew-marketplace-info-button" onClick={() => setMarketGuideOpen(true)} aria-label="거래 시스템 이용 안내">i</button>
            <button type="button" className="renew-marketplace-primary-action" onClick={openRegister}>판매 등록</button>
            <button type="button" onClick={openVerification}>인증 신청</button>
            <button type="button" onClick={() => openConversationPanel()}>거래방</button>
            {isMarketplaceAdmin ? <button type="button" onClick={openAdminPanel}>인증 관리</button> : null}
          </div>
        </div>

        {marketGuideOpen ? (
          <div className="renew-marketplace-inquiry-modal" role="dialog" aria-modal="true" aria-label="거래 시스템 이용 안내">
            <div className="renew-marketplace-inquiry-dialog">
              <button type="button" className="renew-marketplace-verify-close" onClick={() => setMarketGuideOpen(false)} aria-label="닫기">×</button>
              <div className="renew-marketplace-inquiry-title">
                <h2>거래 시스템 이용 안내</h2>
              </div>
              <div className="renew-marketplace-guide-list">
                <article>
                  <h3>게시물 확인</h3>
                  <ul>
                    <li>거래 탭에서 판매·교환 게시물을 확인할 수 있습니다.</li>
                    <li>예약 또는 거래완료 게시물은 상태 표시를 먼저 확인해 주세요.</li>
                  </ul>
                </article>
                <article>
                  <h3>판매 등록</h3>
                  <ul>
                    <li>판매 등록은 로그인과 카페 인증 승인 후 사용할 수 있습니다.</li>
                    <li>게시물은 유저당 하루 최대 5개까지 등록할 수 있습니다.</li>
                  </ul>
                </article>
                <article>
                  <h3>문의와 거래방</h3>
                  <ul>
                    <li>게시물 상세에서 문의하기를 누르면 거래방이 생성됩니다.</li>
                    <li>판매자와 문의자는 거래방에서 메시지를 이어갈 수 있습니다.</li>
                  </ul>
                </article>
                <article>
                  <h3>거래 전 확인</h3>
                  <ul>
                    <li>카드 상태, 사진, 가격, 배송·직거래 조건을 직접 확인해 주세요.</li>
                    <li>외부 결제, 개인정보 공유, 선입금 거래는 신중하게 진행해 주세요.</li>
                  </ul>
                </article>
              </div>
            </div>
          </div>
        ) : null}

        {marketImageViewerOpen ? (
          <div className="renew-marketplace-image-modal" role="dialog" aria-modal="true" aria-label="매물 사진 확대 보기" onClick={closeMarketImageViewer}>
            <div className="renew-marketplace-image-viewer" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="renew-marketplace-verify-close" onClick={closeMarketImageViewer} aria-label="닫기">×</button>
              <div className="renew-marketplace-image-viewer-stage"
                onWheel={handleMarketViewerWheel}
                onPointerDown={handleMarketViewerPointerDown}
                onPointerMove={handleMarketViewerPointerMove}
                onPointerUp={handleMarketViewerPointerUp}
                onPointerCancel={handleMarketViewerPointerUp}
                onTouchStart={handleMarketViewerTouchStart}
                onTouchMove={handleMarketViewerTouchMove}
              >
                <img
                  src={activeListingImage}
                  alt={`${listing?.title || '매물'} 확대 이미지`}
                  draggable="false"
                  onDoubleClick={() => setMarketViewerScale(marketImageViewerScale > 1 ? 1 : 2)}
                  style={{ transform: `translate(${marketImageViewerOffset.x}px, ${marketImageViewerOffset.y}px) scale(${marketImageViewerScale})` }}
                />
              </div>
              <div className="renew-marketplace-image-viewer-controls">
                <button type="button" onClick={() => setMarketViewerScale(marketImageViewerScale - 0.5)}>-</button>
                <span>{Math.round(marketImageViewerScale * 100)}%</span>
                <button type="button" onClick={() => setMarketViewerScale(marketImageViewerScale + 0.5)}>+</button>
                <button type="button" onClick={resetMarketImageViewer}>초기화</button>
              </div>
            </div>
          </div>
        ) : null}

        {marketNotice ? (
          <div className="renew-marketplace-notice" role="dialog" aria-modal="true">
            <div className="renew-marketplace-notice-box">
              <strong>{marketNotice}</strong>
              <p>거래 기능 상태를 확인한 뒤 다시 진행해 주세요.</p>
              <button type="button" onClick={() => setMarketNotice('')}>확인</button>
            </div>
          </div>
        ) : null}

        {inquiryOpen && listing ? (
          <div className="renew-marketplace-inquiry-modal" role="dialog" aria-modal="true" aria-label="거래 문의">
            <form className="renew-marketplace-inquiry-dialog" onSubmit={submitInquiry}>
              <button type="button" className="renew-marketplace-verify-close" onClick={() => setInquiryOpen(false)} aria-label="닫기">×</button>
              <div className="renew-marketplace-inquiry-title">
                <h2>문의하기</h2>
                <p>{listing.title}</p>
              </div>
              <label className="renew-marketplace-inquiry-field">
                <span>문의 내용</span>
                <textarea
                  value={inquiryMessage}
                  onChange={(event) => setInquiryMessage(event.target.value)}
                  placeholder="거래 가능 여부, 희망 거래 방식, 추가 사진 요청 등을 입력하세요."
                  maxLength={1000}
                />
              </label>
              <div className="renew-marketplace-inquiry-actions">
                <button type="submit" disabled={!inquiryMessage.trim() || inquirySending}>{inquirySending ? '전송 중' : '문의 보내기'}</button>
                <button type="button" onClick={() => setInquiryOpen(false)}>취소</button>
              </div>
            </form>
          </div>
        ) : null}

        {conversationOpen ? (
          <div className="renew-marketplace-inquiry-modal" role="dialog" aria-modal="true" aria-label="거래방">
            <div className="renew-marketplace-chat-dialog">
              <button type="button" className="renew-marketplace-verify-close" onClick={() => setConversationOpen(false)} aria-label="닫기">×</button>
              <div className="renew-marketplace-inquiry-title">
                <h2>거래방</h2>
              </div>
              <div className="renew-marketplace-chat-shell">
                <aside className="renew-marketplace-chat-list" aria-label="거래방 목록">
                  {conversationRows.length ? conversationRows.map((conversation) => (
                    <button
                      type="button"
                      key={conversation.id}
                      className={selectedConversationId === conversation.id ? 'is-active' : ''}
                      onClick={() => loadConversationMessages(conversation.id)}
                    >
                      <img src={conversation.imageUrl || '/card-placeholder.svg'} alt="" />
                      <span>
                        <b>{conversation.title}</b>
                        <i>{conversation.otherUserLabel || (conversation.role === 'seller' ? '문의자' : '판매자')}</i>
                        <small>
                          {conversation.role === 'seller' ? '받은 문의' : '보낸 문의'} · {conversation.lastMessageAt}
                          {conversation.listingStatus === 'closed' || conversation.status === 'closed' ? ' · 거래완료' : ''}
                        </small>
                        {conversation.lastMessage ? <em>{conversation.lastMessage}</em> : null}
                      </span>
                    </button>
                  )) : (
                    <div className="renew-marketplace-chat-empty">
                      <strong>거래방이 없습니다.</strong>
                      <p>문의가 시작되면 이곳에 표시됩니다.</p>
                    </div>
                  )}
                </aside>
                <section className="renew-marketplace-chat-room" aria-label="거래 메시지">
                  {selectedConversationId ? (
                    <>
                      <div className="renew-marketplace-chat-messages">
                        {conversationLoading ? <p className="renew-marketplace-chat-hint">불러오는 중...</p> : null}
                        {!conversationLoading && conversationMessages.length ? conversationMessages.map((message) => (
                          <div key={message.id} className={`renew-marketplace-chat-bubble ${message.isMine ? 'is-mine' : ''}`}>
                            <p>{message.body}</p>
                            <span>{message.time}</span>
                          </div>
                        )) : null}
                        {!conversationLoading && !conversationMessages.length ? <p className="renew-marketplace-chat-hint">아직 메시지가 없습니다.</p> : null}
                      </div>
                      {selectedConversationClosed ? (
                        <div className="renew-marketplace-chat-closed">거래완료된 게시물의 거래방입니다. 추가 메시지를 보낼 수 없습니다.</div>
                      ) : (
                        <form className="renew-marketplace-chat-form" onSubmit={submitConversationMessage}>
                          <input
                            type="text"
                            value={conversationText}
                            onChange={(event) => setConversationText(event.target.value)}
                            placeholder="메시지를 입력하세요."
                            maxLength={1000}
                          />
                          <button type="submit" disabled={!conversationText.trim() || conversationSending}>{conversationSending ? '전송 중' : '전송'}</button>
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="renew-marketplace-chat-empty">
                      <strong>대화를 선택하세요.</strong>
                      <p>왼쪽 목록에서 거래방을 선택하면 메시지를 볼 수 있습니다.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        ) : null}

        {statusModalOpen && listing ? (
          <div className="renew-marketplace-inquiry-modal" role="dialog" aria-modal="true" aria-label="게시물 상태 변경">
            <div className="renew-marketplace-inquiry-dialog">
              <button type="button" className="renew-marketplace-verify-close" onClick={() => setStatusModalOpen(false)} aria-label="닫기">×</button>
              <div className="renew-marketplace-inquiry-title">
                <h2>게시물 상태 변경</h2>
                <p>{listing.title}</p>
              </div>
              <div className="renew-marketplace-status-options">
                {[
                  { id: 'active', label: '판매중' },
                  { id: 'hidden', label: '예약' },
                  { id: 'closed', label: '거래완료' }
                ].map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={statusDraft === option.id ? 'is-active' : ''}
                    onClick={() => setStatusDraft(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="renew-marketplace-inquiry-actions">
                <button type="button" onClick={changeListingStatus} disabled={marketSaving}>{marketSaving ? '변경 중' : '확인'}</button>
                <button type="button" onClick={() => setStatusModalOpen(false)}>취소</button>
              </div>
            </div>
          </div>
        ) : null}

        {registerOpen ? (
          <div className="renew-marketplace-register-modal" role="dialog" aria-modal="true" aria-label="판매 등록">
            <div className="renew-marketplace-register-dialog">
              <button type="button" className="renew-marketplace-verify-close" onClick={closeRegister} aria-label="닫기">×</button>
              <form className="renew-marketplace-register-form" onSubmit={submitRegister}>
                <div className="renew-marketplace-register-title">
                    <h2>{editingListingId ? '매물 수정' : '판매 등록'}</h2>
                    <p>{editingListingId ? '거래 조건과 설명을 수정합니다.' : '등록한 매물은 바로 거래 목록에 표시됩니다.'}</p>
                </div>
                <div className="renew-marketplace-register-cardlink">
                  <div className="renew-marketplace-register-cardlink-head">
                    <strong>도감 카드 연동</strong>
                    <span>정확한 카드를 선택하면 도감에 매물 배지가 표시됩니다.</span>
                  </div>
                  <div className="renew-marketplace-register-cardsearch">
                    <select value={registerCardLocale} onChange={(event) => setRegisterCardLocale(event.target.value)} aria-label="카드 언어">
                      <option value="JP">일본판</option>
                      <option value="KR">한글판</option>
                    </select>
                    <input
                      type="text"
                      value={registerCardQuery}
                      onChange={(event) => setRegisterCardQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          searchRegisterCards();
                        }
                      }}
                      placeholder="일련번호 또는 카드명 검색"
                    />
                    <button type="button" onClick={searchRegisterCards} disabled={registerCardLoading}>
                      {registerCardLoading ? '검색 중' : '검색'}
                    </button>
                  </div>
                  {registerLinkedCard ? (
                    <div className="renew-marketplace-linked-card">
                      <img
                        src={getCardThumbnailSrc(registerLinkedCard)}
                        data-proxy-fallback-src={getCardThumbnailProxySrc(registerLinkedCard)}
                        data-fallback-src={getCardImageSrc(registerLinkedCard)}
                        alt={registerLinkedCard.name || registerLinkedCard.cardNo}
                        loading="lazy"
                        onError={fallbackToOriginalCardImage}
                      />
                      <div>
                        <b>{registerLinkedCard.cardNo}</b>
                        <strong>{registerLinkedCard.name}</strong>
                        <span>{[registerLinkedCard.locale, registerLinkedCard.rarity, registerLinkedCard.variantKey].filter(Boolean).join(' · ')}</span>
                      </div>
                      <button type="button" onClick={() => setRegisterLinkedCard(null)}>해제</button>
                    </div>
                  ) : null}
                  {registerCardCandidates.length ? (
                    <div className="renew-marketplace-card-candidates">
                      {registerCardCandidates.map((card) => (
                        <button type="button" key={card.id || `${card.locale}-${card.cardNo}-${card.variantKey}`} onClick={() => selectRegisterCard(card)}>
                          <img
                            src={getCardThumbnailSrc(card)}
                            data-proxy-fallback-src={getCardThumbnailProxySrc(card)}
                            data-fallback-src={getCardImageSrc(card)}
                            alt={card.name || card.cardNo}
                            loading="lazy"
                            onError={fallbackToOriginalCardImage}
                          />
                          <span>
                            <b>{card.cardNo}</b>
                            <strong>{card.name}</strong>
                            <small>{[card.locale, card.rarity, card.seriesName].filter(Boolean).join(' · ')}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="renew-marketplace-register-fields">
                  <label>
                    <span>판매 제목</span>
                    <input
                      type="text"
                      value={registerForm.title}
                      onChange={(event) => updateRegisterForm('title', event.target.value)}
                      placeholder="예: OP05-119 루피 SEC 판매"
                      required
                    />
                  </label>
                  <label>
                    <span>일련번호</span>
                    <input
                      type="text"
                      value={registerForm.cardCode}
                      onChange={(event) => updateRegisterForm('cardCode', event.target.value)}
                      placeholder="OP05-119"
                    />
                  </label>
                  <label>
                    <span>카드명</span>
                    <input
                      type="text"
                      value={registerForm.cardName}
                      onChange={(event) => updateRegisterForm('cardName', event.target.value)}
                      placeholder="Monkey.D.Luffy"
                    />
                  </label>
                  <label>
                    <span>거래 유형</span>
                    <select value={registerForm.tradeType} onChange={(event) => updateRegisterForm('tradeType', event.target.value)}>
                      <option>판매</option>
                      <option>교환</option>
                      <option>판매+교환</option>
                    </select>
                  </label>
                  <label>
                    <span>카드 상태</span>
                    <select value={registerForm.condition} onChange={(event) => updateRegisterForm('condition', event.target.value)}>
                      <option>일반</option>
                      <option>A등급</option>
                      <option>PSA10</option>
                      <option>기타 등급</option>
                      <option>미개봉</option>
                    </select>
                  </label>
                  <label>
                    <span>가격</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={registerForm.price}
                      onChange={(event) => updateRegisterForm('price', event.target.value)}
                      placeholder="50000"
                      disabled={registerForm.negotiable}
                    />
                  </label>
                  <label>
                    <span>거래 방식</span>
                    <select value={registerForm.delivery} onChange={(event) => updateRegisterForm('delivery', event.target.value)}>
                      <option>택배</option>
                      <option>직거래</option>
                      <option>택배+직거래</option>
                    </select>
                  </label>
                  <label>
                    <span>직거래 지역</span>
                    <input
                      type="text"
                      value={registerForm.region}
                      onChange={(event) => updateRegisterForm('region', event.target.value)}
                      placeholder="예: 서울 강남"
                    />
                  </label>
                  <label className="renew-marketplace-register-check">
                    <input
                      type="checkbox"
                      checked={registerForm.negotiable}
                      onChange={(event) => updateRegisterForm('negotiable', event.target.checked)}
                    />
                    <span>가격 협의 가능</span>
                  </label>
                  <div className="renew-marketplace-register-photo">
                    <span>사진 업로드</span>
                    <label>
                      <input type="file" accept="image/*" multiple onChange={updateRegisterPhotos} />
                      <b>사진 선택 / 촬영</b>
                      <small>모바일은 카메라 또는 갤러리, 데스크탑은 저장된 이미지를 선택합니다.</small>
                    </label>
                    {registerPhotos.length ? (
                      <div className="renew-marketplace-register-previews">
                        {registerPhotos.map((photo) => (
                          <img src={photo.url} alt={photo.name} key={photo.url} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <label className="renew-marketplace-register-description">
                    <span>설명</span>
                    <textarea
                      value={registerForm.description}
                      onChange={(event) => updateRegisterForm('description', event.target.value)}
                      placeholder="카드 상태, 하자 여부, 교환 희망 카드, 거래 조건을 입력"
                      rows="4"
                    />
                  </label>
                </div>
                <div className="renew-marketplace-register-actions">
                  <button type="submit" disabled={!registerReady || marketSaving}>{marketSaving ? '저장 중' : editingListingId ? '수정하기' : '등록하기'}</button>
                  <button type="button" onClick={closeRegister}>취소</button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {verificationOpen ? (
          <div className="renew-marketplace-verify-modal" role="dialog" aria-modal="true" aria-label="카페 인증 신청">
            <div className="renew-marketplace-verify-dialog">
              <button type="button" className="renew-marketplace-verify-close" onClick={closeVerification} aria-label="닫기">×</button>
              {!verificationSubmitted ? (
                <form className="renew-marketplace-verify-form" onSubmit={submitVerification}>
                  <div className="renew-marketplace-verify-title">
                    <h2>카페 인증 신청</h2>
                    <p>판매 등록은 지정된 네이버 카페 인증 완료 후 이용할 수 있습니다.</p>
                    <a href="https://cafe.naver.com/onepiecetcg" target="_blank" rel="noreferrer">네이버 카페 바로가기</a>
                  </div>
                  <div className="renew-marketplace-verify-fields">
                    <label>
                      <span>카페 닉네임</span>
                      <input
                        type="text"
                        value={verificationForm.cafeNickname}
                        onChange={(event) => updateVerificationForm('cafeNickname', event.target.value)}
                        placeholder="네이버 카페 닉네임"
                        required
                      />
                    </label>
                    <label>
                      <span>카페 프로필 URL</span>
                      <input
                        type="url"
                        value={verificationForm.cafeProfileUrl}
                        onChange={(event) => updateVerificationForm('cafeProfileUrl', event.target.value)}
                        placeholder="카페 프로필 또는 활동 내역 링크"
                        required
                      />
                    </label>
                    <label>
                      <span>카페 등급</span>
                      <input
                        type="text"
                        value={verificationForm.cafeGrade}
                        onChange={(event) => updateVerificationForm('cafeGrade', event.target.value)}
                        placeholder="확인 가능한 등급명"
                      />
                    </label>
                    <label>
                      <span>메모</span>
                      <textarea
                        value={verificationForm.note}
                        onChange={(event) => updateVerificationForm('note', event.target.value)}
                        placeholder="운영자에게 전달할 내용이 있으면 입력"
                        rows="3"
                      />
                    </label>
                  </div>
                  <div className="renew-marketplace-verify-actions">
                    <button type="submit" disabled={!verificationReady || marketSaving}>{marketSaving ? '접수 중' : '인증 신청하기'}</button>
                    <button type="button" onClick={closeVerification}>취소</button>
                  </div>
                </form>
              ) : (
                <div className="renew-marketplace-verify-pending">
                  <h2>검토 대기중</h2>
                  <p>인증 신청 내용이 접수되었습니다. 관리자 확인 후 판매자 프로필에 인증 상태가 표시됩니다.</p>
                  <div className="renew-marketplace-verify-review">
                    <span>카페 닉네임</span>
                    <b>{verificationForm.cafeNickname}</b>
                    <span>카페 등급</span>
                    <b>{verificationForm.cafeGrade || '미입력'}</b>
                  </div>
                  <div className="renew-marketplace-verify-actions">
                    <button type="button" onClick={closeVerification}>확인</button>
                    <button type="button" onClick={() => setVerificationSubmitted(false)}>신청 내용 수정</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {adminPanelOpen ? (
          <div className="renew-marketplace-admin">
            <div className="renew-marketplace-admin-head">
              <h2>인증 신청 관리</h2>
              <p>카페 인증 신청을 확인하고 승인 상태를 관리하는 관리자 전용 화면입니다.</p>
            </div>
            <div className="renew-marketplace-admin-tabs" role="tablist" aria-label="인증 상태 필터">
              {[
                { id: 'pending', label: '대기', count: adminVerificationCounts.pending },
                { id: 'approved', label: '승인 유저', count: adminVerificationCounts.approved }
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  className={adminVerificationTab === tab.id ? 'is-active' : ''}
                  onClick={() => setAdminVerificationTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  <b>{tab.count}</b>
                </button>
              ))}
            </div>
            {displayedAdminVerificationRows.length ? (
              <div className="renew-marketplace-admin-list">
                {displayedAdminVerificationRows.map((row) => (
                  <article key={row.id} className="renew-marketplace-admin-row">
                    <div>
                      <span>카페 닉네임</span>
                      <strong>{row.nickname}</strong>
                    </div>
                    <div>
                      <span>카페 등급</span>
                      <strong>{row.grade}</strong>
                    </div>
                    <div>
                      <span>상태</span>
                      <strong>{row.status}</strong>
                    </div>
                    <a href={row.profileUrl} target="_blank" rel="noreferrer">프로필 확인</a>
                    <p>{row.note}</p>
                    <div className="renew-marketplace-admin-actions">
                      {row.rawStatus !== 'approved' ? (
                        <button type="button" onClick={() => updateVerificationStatus(row.id, 'approved')} disabled={adminUpdatingId === row.id}>승인</button>
                      ) : null}
                      <button type="button" onClick={() => deleteVerificationRow(row.id)} disabled={adminUpdatingId === row.id}>{row.rawStatus === 'approved' ? '승인 해제' : '삭제'}</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="renew-marketplace-admin-empty">
                <strong>{adminVerificationTab === 'approved' ? '승인된 유저가 없습니다.' : '접수된 인증 신청이 없습니다.'}</strong>
                <p>{adminVerificationTab === 'pending' ? '새 인증 신청이 접수되면 이 영역에 표시됩니다.' : '상단 탭에서 다른 상태의 인증 기록을 확인할 수 있습니다.'}</p>
              </div>
            )}
          </div>
        ) : !selectedListing ? (
          <>
            {filterCardId ? (
              <div className="renew-marketplace-linked-filter">
                <strong>선택한 카드 관련 매물</strong>
                <span>{visibleListings.length}개</span>
                <button type="button" onClick={onClearFilter}>전체 매물 보기</button>
              </div>
            ) : null}
            <div className="renew-marketplace-filter">
              {marketFilterOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={marketListingFilter === option.id ? 'is-active' : ''}
                  onClick={() => setMarketListingFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="renew-marketplace-listings">
              {visibleListings.length ? visibleListings.map((item) => (
                <button type="button" className={`renew-marketplace-card ${item.rawStatus !== 'active' ? 'is-muted' : ''}`} key={item.id} onClick={() => openListing(item)}>
                  <div className="renew-marketplace-card-image">
                    <img src={item.imageUrl || '/card-placeholder.svg'} alt={`${item.title} 이미지`} />
                    {item.rawStatus === 'hidden' ? <span className="renew-marketplace-status-overlay">예약</span> : null}
                    {item.rawStatus === 'closed' ? <span className="renew-marketplace-status-overlay">거래완료</span> : null}
                  </div>
                  <div className="renew-marketplace-card-body">
                    <div className="renew-marketplace-card-tags">
                      {item.rawStatus === 'hidden' ? <span>예약</span> : null}
                      {item.rawStatus === 'closed' ? <span>거래완료</span> : null}
                      {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.subtitle}</p>
                    <div className="renew-marketplace-card-meta">
                      <strong>{item.price}</strong>
                      <span>{item.time}</span>
                    </div>
                    <div className="renew-marketplace-card-foot">
                      <span>{item.sellerStatus}</span>
                      <span>{item.likes}</span>
                      <span>{item.views}</span>
                    </div>
                  </div>
                </button>
              )) : (
                <div className="renew-marketplace-empty">
                  <strong>등록된 매물이 없습니다.</strong>
                  <p>이 카드와 연결된 판매/교환 글이 등록되면 여기에 표시됩니다.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="renew-marketplace-layout">
          <article className="renew-marketplace-preview" aria-label="거래 상세 미리보기">
            <button type="button" className="renew-marketplace-back" onClick={() => setSelectedListing(null)}>← 매물 목록</button>
            <div
              className={`renew-marketplace-image ${listing.rawStatus !== 'active' ? 'is-muted' : ''}`}
              role="button"
              tabIndex={0}
              onClick={openMarketImageViewer}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openMarketImageViewer();
                }
              }}
            >
              <img src={activeListingImage} alt={`${listing.title} 이미지`} />
              {listing.rawStatus === 'hidden' ? <span className="renew-marketplace-status-overlay">예약</span> : null}
              {listing.rawStatus === 'closed' ? <span className="renew-marketplace-status-overlay">거래완료</span> : null}
              <small>이미지 미리보기</small>
            </div>
            {listingImages.length > 1 ? (
              <div className="renew-marketplace-thumbs" aria-label="매물 이미지 선택">
                {listingImages.map((imageUrl, index) => (
                  <button
                    type="button"
                    key={`${imageUrl}-${index}`}
                    className={index === selectedMarketImageIndex ? 'is-active' : ''}
                    onClick={() => setSelectedMarketImageIndex(index)}
                    aria-label={`매물 이미지 ${index + 1}`}
                  >
                    <img src={imageUrl} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </article>

          <aside className="renew-marketplace-detail">
            <div className="renew-marketplace-seller">
              <div className="renew-marketplace-seller-head">
                <div className="renew-marketplace-avatar">S</div>
                <div className="renew-marketplace-seller-main">
                  <div className="renew-marketplace-seller-name">
                    <b>{listing.seller}</b>
                    <span>{listing.sellerStatus}</span>
                  </div>
                  <p>{listing.sellerNote}</p>
                </div>
              </div>
              <div className="renew-marketplace-seller-meta">
                <span>최근 접속 표시 예정</span>
                <span>신고/숨김 관리 예정</span>
              </div>
              <a
                className={`renew-marketplace-profile ${listing.sellerProfileUrl ? '' : 'is-disabled'}`}
                href={listing.sellerProfileUrl || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!listing.sellerProfileUrl) {
                    event.preventDefault();
                    setMarketNotice('등록된 판매자 프로필 링크가 없습니다.');
                  }
                }}
              >
                판매자 프로필 바로가기
              </a>
            </div>
            <div className="renew-marketplace-title">
              <div className="renew-marketplace-badges">
                {listing.rawStatus === 'hidden' ? <span>예약</span> : null}
                {listing.rawStatus === 'closed' ? <span>거래완료</span> : null}
                {listing.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <h2>{listing.title}</h2>
              <p>{listing.subtitle}</p>
            </div>
            <div className="renew-marketplace-listing">
              <strong>{listing.price}</strong>
              <span>{listing.time}</span>
            </div>
            <div className="renew-marketplace-description">
              <p>{listing.description}</p>
            </div>
            <div className="renew-marketplace-stats">
              <span>{listing.likes}</span>
              <span>{listing.views}</span>
              <button
                type="button"
                className={listingInterested ? 'is-active' : ''}
                onClick={toggleListingInterest}
                disabled={isListingOwner || interestSavingId === String(listing.id)}
              >
                {listingInterested ? '관심 해제' : '관심'}
              </button>
            </div>
            <button
              type="button"
              className="renew-marketplace-price-link"
              onClick={() => onOpenPrice?.(listing.cardNo, listing.id)}
              disabled={!listing.cardNo}
            >
              현재 시세로 바로가기
            </button>
            {isListingOwner ? (
              <div className="renew-marketplace-owner-actions">
                <button type="button" onClick={openStatusModal} disabled={marketSaving}>상태 변경</button>
                <button type="button" onClick={openEditListing} disabled={marketSaving}>수정</button>
                <button type="button" onClick={deleteListing} disabled={marketSaving}>삭제</button>
              </div>
            ) : null}
            <button type="button" className="renew-marketplace-contact" onClick={openInquiry}>
              {authUser ? '문의하기' : '로그인 후 문의'}
            </button>
          </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function RenewRouteBackButton({ label = '뒤로가기', onClick, hideOnDesktop = false }) {
  return (
    <div className={`renew-route-back-wrap${hideOnDesktop ? ' is-mobile-only' : ''}`} data-nosnippet>
      <button type="button" className="renew-route-back-button" onClick={onClick}>
        <span aria-hidden="true">←</span>
        {label}
      </button>
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

function RenewMarketChart({ points = [], uiLang, range }) {
  const t = (key) => getUiText(uiLang, key);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isMobileChart, setIsMobileChart] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobileChart(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    setSelectedIndex(null);
  }, [range, points.length]);
  const aggregatedPoints = aggregateMarketDailyChartPoints(points)
    .map((point) => ({
      ...point,
      timestamp: Number(point.timestamp || 0),
      price: Number(point.price || 0)
    }))
    .filter((point) => Number.isFinite(point.timestamp) && point.timestamp > 0 && point.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  const isLongMarketRange = range === '1y';
  const orderedPoints = isLongMarketRange
    ? compressMarketAllChartPoints(aggregatedPoints, isMobileChart ? 72 : 108)
    : aggregatedPoints;
  const rangeLabel = range === '1d' ? '1D' : range === '1m' ? '1M' : range === '1y' ? '1Y' : range === '6m' ? '6M' : '7D';
  if (!orderedPoints.length) {
    const emptyText = range === '7d'
      ? getLocaleText(uiLang, '최근 7일간 거래 데이터가 없습니다.', 'No trades in the last 7 days.', '直近7日間の取引データはありません。')
      : getLocaleText(uiLang, `${rangeLabel} 기간 내 거래 데이터가 없습니다.`, `No trades in the selected ${rangeLabel} range.`, `選択した${rangeLabel}期間の取引データはありません。`);
    return <div className="renew-chart-placeholder"><span>{emptyText}</span></div>;
  }
  const width = isMobileChart ? 430 : 920;
  const height = 340;
  const padX = isMobileChart ? 30 : 54;
  const padTop = isMobileChart ? 30 : 30;
  const padBottom = isMobileChart ? 42 : 42;
  const pointRadius = isMobileChart ? 4 : 3;
  const activePointRadius = isMobileChart ? 6 : 5;
  const hitRadius = isMobileChart ? 18 : 14;
  const tipWidth = isMobileChart ? 168 : 230;
  const tipHeight = isMobileChart ? 66 : 62;
  const prices = orderedPoints.map((point) => Number(point.price || 0));
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const percentile = (value) => {
    const index = Math.min(sortedPrices.length - 1, Math.max(0, Math.floor((sortedPrices.length - 1) * value)));
    return sortedPrices[index];
  };
  const min = sortedPrices[0];
  const max = sortedPrices[sortedPrices.length - 1];
  const q1 = percentile(0.25);
  const q3 = percentile(0.75);
  const iqr = q3 - q1;
  const outlierMin = isLongMarketRange && orderedPoints.length >= 12
    ? percentile(0.04)
    : iqr > 0 ? Math.max(min, q1 - iqr * 1.5) : min;
  const outlierMax = isLongMarketRange && orderedPoints.length >= 12
    ? percentile(0.96)
    : iqr > 0 ? Math.min(max, q3 + iqr * 1.5) : max;
  const useOutlierScale = orderedPoints.length >= 4 && outlierMax > outlierMin && (outlierMin > min || outlierMax < max);
  const scaleMinBase = useOutlierScale ? outlierMin : min;
  const scaleMaxBase = useOutlierScale ? outlierMax : max;
  const scalePadding = Math.max((scaleMaxBase - scaleMinBase) * 0.16, scaleMaxBase * 0.012, 1000);
  const scaleMin = Math.max(0, scaleMinBase - scalePadding);
  const scaleMax = scaleMaxBase + scalePadding;
  const priceRange = Math.max(scaleMax - scaleMin, 1);
  const maxBoundaryPrice = useOutlierScale ? scaleMaxBase : max;
  const minBoundaryPrice = useOutlierScale ? scaleMinBase : min;
  const maxLabelPrice = Math.min(scaleMax, Math.max(scaleMin, maxBoundaryPrice));
  const minLabelPrice = Math.min(scaleMax, Math.max(scaleMin, minBoundaryPrice));
  const maxLabelY = padTop + ((scaleMax - maxLabelPrice) / priceRange) * (height - padTop - padBottom);
  const minLabelY = padTop + ((scaleMax - minLabelPrice) / priceRange) * (height - padTop - padBottom);
  const minTime = orderedPoints[0].timestamp;
  const maxTime = orderedPoints[orderedPoints.length - 1].timestamp;
  const timeRange = Math.max(maxTime - minTime, 1);
  const hasSinglePoint = orderedPoints.length === 1;
  const plotted = orderedPoints.map((point) => {
    const x = hasSinglePoint ? width / 2 : padX + ((width - padX * 2) * (point.timestamp - minTime) / timeRange);
    const price = Number(point.price || 0);
    const clampedPrice = Math.min(scaleMax, Math.max(scaleMin, price));
    const y = padTop + ((scaleMax - clampedPrice) / priceRange) * (height - padTop - padBottom);
    return { ...point, x, y, isClamped: price !== clampedPrice };
  });
  const showPointDots = !isLongMarketRange || plotted.length <= 36;
  const linePath = plotted.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const smoothPath = plotted.length > 2
    ? plotted.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = plotted[index - 1];
      const beforePrevious = plotted[index - 2] || previous;
      const next = plotted[index + 1] || point;
      const minY = Math.min(previous.y, point.y);
      const maxY = Math.max(previous.y, point.y);
      const control1X = Math.min(point.x, Math.max(previous.x, previous.x + (point.x - beforePrevious.x) / 6));
      const control1Y = Math.min(maxY, Math.max(minY, previous.y + (point.y - beforePrevious.y) / 6));
      const control2X = Math.min(point.x, Math.max(previous.x, point.x - (next.x - previous.x) / 6));
      const control2Y = Math.min(maxY, Math.max(minY, point.y - (next.y - previous.y) / 6));
      return `${path} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${point.x} ${point.y}`;
    }, '')
    : linePath;
  const path = isLongMarketRange ? smoothPath : linePath;
  const area = `${path} L ${plotted[plotted.length - 1].x} ${height - padBottom} L ${plotted[0].x} ${height - padBottom} Z`;
  const activeIndex = selectedIndex != null && selectedIndex >= 0 && selectedIndex < plotted.length
    ? selectedIndex
    : plotted.length - 1;
  const active = plotted[activeIndex];
  const tipX = active ? Math.min(active.x + 12, width - tipWidth - 8) : 0;
  const tipY = active ? Math.max(active.y - tipHeight - 10, 8) : 0;
  const midPoint = plotted[Math.floor((plotted.length - 1) / 2)] || plotted[0];
  const axisLabels = hasSinglePoint
    ? [{ key: 'middle', className: 'is-middle', x: width / 2, text: formatChartAxisDate(plotted[0]?.timestamp) }]
    : [
      { key: 'start', className: 'is-start', x: padX, text: formatChartAxisDate(plotted[0]?.timestamp) },
      { key: 'middle', className: 'is-middle', x: midPoint?.x || width / 2, text: formatChartAxisDate(midPoint?.timestamp) },
      { key: 'end', className: 'is-end', x: width - padX, text: formatChartAxisDate(plotted[plotted.length - 1]?.timestamp) }
    ].filter((item) => item.text);
  return (
    <div className="renew-market-chart-box">
      <span className="renew-chart-range-label">{rangeLabel}</span>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={getLocaleText(uiLang, '시세 그래프', 'Market price chart', '相場グラフ')} preserveAspectRatio="none">
        <defs>
          <linearGradient id="renew-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c94d35" stopOpacity="0.28" />
            <stop offset="72%" stopColor="#c94d35" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#c94d35" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((step) => {
          const y = padTop + ((height - padTop - padBottom) * step / 3);
          return (
            <g key={step}>
              <line className="renew-chart-grid" x1={padX} y1={y} x2={width - padX} y2={y} />
            </g>
          );
        })}
        <line className="renew-chart-boundary" x1={padX} y1={maxLabelY} x2={width - padX} y2={maxLabelY} />
        <line className="renew-chart-boundary" x1={padX} y1={minLabelY} x2={width - padX} y2={minLabelY} />
        <text className="renew-chart-boundary-label is-max" x={padX + 4} y={Math.max(22, maxLabelY - 8)}>{getLocalizedCurrencyText(maxBoundaryPrice, uiLang)}</text>
        <text className="renew-chart-boundary-label is-min" x={padX + 4} y={Math.min(height - 14, minLabelY + 22)}>{getLocalizedCurrencyText(minBoundaryPrice, uiLang)}</text>
        {!hasSinglePoint ? <path d={area} className="renew-chart-area" /> : null}
        {!hasSinglePoint ? <path d={path} className="renew-chart-line" /> : null}
        {axisLabels.map((item) => (
          <text key={item.key} className={`renew-chart-axis-date ${item.className}`} x={item.x} y={height - 12}>
            {item.text}
          </text>
        ))}
        {showPointDots ? plotted.map((point, index) => (
          <circle
            key={`${point.timestamp}-${index}`}
            className={`renew-chart-point ${point.isClamped ? 'is-clamped' : ''}`}
            cx={point.x}
            cy={point.y}
            r={index === activeIndex ? activePointRadius : pointRadius}
          />
        )) : active ? (
          <circle
            className={`renew-chart-point ${active.isClamped ? 'is-clamped' : ''}`}
            cx={active.x}
            cy={active.y}
            r={activePointRadius}
          />
        ) : null}
        {plotted.map((point, index) => (
          <circle
            key={`hit-${point.timestamp}-${index}`}
            className="renew-chart-hit"
            cx={point.x}
            cy={point.y}
            r={hitRadius}
            tabIndex="0"
            role="button"
            aria-label={`${formatMarketDate(point.timestamp)} ${getLocalizedCurrencyText(point.price, uiLang)}`}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedIndex(index);
              }
            }}
          />
        ))}
        {active ? (
          <g>
            <line className="renew-chart-cursor" x1={active.x} y1={padTop} x2={active.x} y2={height - padBottom} />
            <circle
              className={`renew-chart-point ${active.isClamped ? 'is-clamped' : ''}`}
              cx={active.x}
              cy={active.y}
              r={activePointRadius}
            />
            <rect x={tipX} y={tipY} width={tipWidth} height={tipHeight} rx="10" />
            <text className="renew-chart-tip-date" x={tipX + 14} y={tipY + 24}>{formatMarketDate(active.timestamp)}</text>
            <text className="renew-chart-tip-price" x={tipX + 14} y={tipY + 46}>{getLocalizedCurrencyText(active.price, uiLang)}</text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function formatIndexValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : '-';
}

function formatIndexChange(value) {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(2)}%`;
}

function formatIndexDailyChange(value) {
  return value == null || !Number.isFinite(Number(value)) ? '집계 중' : formatIndexChange(value);
}

function indexChangeClass(value) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value) >= 0 ? 'is-up' : 'is-down';
}

function formatIndexAxisDate(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(2) : text;
}

function RenewIndexChart({ points = [] }) {
  const orderedPoints = points
    .map((point) => ({ ...point, value: Number(point.value || 0) }))
    .filter((point) => point.date && point.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!orderedPoints.length) {
    return <div className="renew-chart-placeholder"><span>지수 데이터 준비 중</span></div>;
  }
  const width = 920;
  const height = 320;
  const padX = 44;
  const padTop = 28;
  const padBottom = 42;
  const values = orderedPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const scaleMin = Math.max(0, min - range * 0.12);
  const scaleMax = max + range * 0.12;
  const scaleRange = Math.max(scaleMax - scaleMin, 1);
  const hasSinglePoint = orderedPoints.length === 1;
  const plotted = orderedPoints.map((point, index) => {
    const x = hasSinglePoint ? width / 2 : padX + ((width - padX * 2) * index / Math.max(orderedPoints.length - 1, 1));
    const y = padTop + ((scaleMax - point.value) / scaleRange) * (height - padTop - padBottom);
    return { ...point, x, y };
  });
  const path = plotted.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${plotted[plotted.length - 1].x} ${height - padBottom} L ${plotted[0].x} ${height - padBottom} Z`;
  const seenLabelDates = new Set();
  const labelPoints = (hasSinglePoint
    ? [plotted[0]]
    : [plotted[0], plotted[Math.floor((plotted.length - 1) / 2)], plotted[plotted.length - 1]])
    .filter((point) => {
      if (!point || seenLabelDates.has(point.date)) return false;
      seenLabelDates.add(point.date);
      return true;
    });
  return (
    <div className="renew-index-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="OPTCG Manga Index chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="renew-index-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c94d35" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#c94d35" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((step) => {
          const y = padTop + ((height - padTop - padBottom) * step / 2);
          return <line key={step} className="renew-index-grid" x1={padX} y1={y} x2={width - padX} y2={y} />;
        })}
        <text className="renew-index-boundary is-max" x={padX + 4} y={padTop + 14}>{formatIndexValue(max)}</text>
        <text className="renew-index-boundary is-min" x={padX + 4} y={height - padBottom - 8}>{formatIndexValue(min)}</text>
        {!hasSinglePoint ? <path d={area} className="renew-index-area" /> : null}
        {!hasSinglePoint ? <path d={path} className="renew-index-line" /> : null}
        {hasSinglePoint ? <circle className="renew-index-point" cx={plotted[0].x} cy={plotted[0].y} r="4" /> : null}
        {labelPoints.map((point, index) => (
          <text key={`${point.date}-${index}`} className={`renew-index-date is-${index}`} x={point.x} y={height - 12}>{formatIndexAxisDate(point.date)}</text>
        ))}
      </svg>
    </div>
  );
}

const MARKET_INDEX_OPTIONS = [
  { key: 'manga', label: 'Manga', title: 'OPTCG Manga Index' },
  { key: 'luffy', label: 'Luffy', title: 'OPTCG Luffy Index' },
];
const MARKET_INDEX_COMPONENTS_PER_PAGE = 8;

function getMarketIndexComponentHref(item) {
  const apparelId = String(item?.apparelId || '').trim();
  const params = new URLSearchParams();
  if (item?.code) params.set('code', item.code);
  if (apparelId) params.set('apparelId', apparelId);
  const query = params.toString();
  return apparelId
    ? `/prices/product/${encodeURIComponent(apparelId)}${query ? `?${query}` : ''}`
    : `/prices${query ? `?${query}` : ''}`;
}

function getMarketIndexComponentLocale(item) {
  const explicitLocale = String(item?.locale || '').trim().toUpperCase();
  if (explicitLocale) return explicitLocale;
  return String(item?.cardId || '').startsWith('EN::') ? 'EN' : 'JP';
}

function getMarketIndexTypeFromPath(path) {
  const requestedType = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('index');
  if (MARKET_INDEX_OPTIONS.some((item) => item.key === requestedType)) return requestedType;
  const aliasMap = {
    '/prices/collector-index': 'manga',
    '/prices/manga-index': 'manga',
    '/prices/waifu-index': 'manga',
    '/prices/premium-art-index': 'manga',
    '/prices/sp-index': 'manga',
    '/prices/luffy-index': 'luffy'
  };
  if (aliasMap[path]) return aliasMap[path];
  const slug = path.startsWith('/prices/index/') ? path.slice('/prices/index/'.length) : '';
  const legacyMap = { collector: 'manga', manga: 'manga', waifu: 'manga', premium: 'manga', 'premium-art': 'manga', sp: 'manga', heroines: 'manga', luffy: 'luffy' };
  return legacyMap[slug] || 'manga';
}

function isMarketIndexPath(path) {
  return path === '/prices/collector-index'
    || path === '/prices/manga-index'
    || path === '/prices/waifu-index'
    || path === '/prices/premium-art-index'
    || path === '/prices/sp-index'
    || path === '/prices/luffy-index'
    || path.startsWith('/prices/index');
}

function RenewMarketIndex({ onOpenComponent } = {}) {
  const savedViewState = typeof window !== 'undefined' && window.history.state?.marketIndexViewState
    ? window.history.state.marketIndexViewState
    : {};
  const restoredScrollRef = useRef(false);
  const [payload, setPayload] = useState(null);
  const [indexType, setIndexType] = useState(() => {
    if (MARKET_INDEX_OPTIONS.some((item) => item.key === savedViewState.indexType)) return savedViewState.indexType;
    if (typeof window === 'undefined') return 'manga';
    const path = getAppPath(window.location.pathname);
    return getMarketIndexTypeFromPath(path);
  });
  const [range, setRange] = useState(() => ['1d', '7d', '1m', '6m', '1y'].includes(savedViewState.range) ? savedViewState.range : '1y');
  const [detailsOpen, setDetailsOpen] = useState(() => Boolean(savedViewState.detailsOpen));
  const [componentPage, setComponentPage] = useState(() => Math.max(1, Number(savedViewState.componentPage) || 1));
  const [componentSort, setComponentSort] = useState(() => ['default', 'gainers', 'losers'].includes(savedViewState.componentSort) ? savedViewState.componentSort : 'default');
  const [loading, setLoading] = useState(false);
  const selectedIndex = MARKET_INDEX_OPTIONS.find((item) => item.key === indexType) || MARKET_INDEX_OPTIONS[0];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = getAppPath(window.location.pathname);
    const isIndexView = isMarketIndexPath(path) || new URLSearchParams(window.location.search).get('tab') === 'index';
    if (!isIndexView) return;
    const currentState = window.history.state || {};
    window.history.replaceState({
      ...currentState,
      marketIndexViewState: {
        ...(currentState.marketIndexViewState || {}),
        indexType,
        range,
        detailsOpen,
        componentPage,
        componentSort
      }
    }, '', window.location.href);
  }, [indexType, range, detailsOpen, componentPage, componentSort]);

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setLoading(true);
    fetch(`/api/market-index?type=${encodeURIComponent(indexType)}&condition=${MARKET_INDEX_CONDITION}&range=${range}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [indexType, range]);

  useEffect(() => {
    if (loading || !payload || restoredScrollRef.current || !Number.isFinite(Number(savedViewState.scrollY))) return undefined;
    restoredScrollRef.current = true;
    return restoreAppScrollPosition(savedViewState.scrollY);
  }, [loading, payload, savedViewState.scrollY]);

  const components = Array.isArray(payload?.components) ? payload.components.filter((item) => item.hasData) : [];
  const sortedComponents = useMemo(() => {
    if (componentSort === 'default') return components;
    return components
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const aChange = Number(a.item?.change?.d1);
        const bChange = Number(b.item?.change?.d1);
        const aHasChange = Number.isFinite(aChange);
        const bHasChange = Number.isFinite(bChange);
        if (aHasChange !== bHasChange) return aHasChange ? -1 : 1;
        if (!aHasChange && !bHasChange) return a.index - b.index;
        const sortDelta = componentSort === 'gainers' ? bChange - aChange : aChange - bChange;
        return sortDelta || a.index - b.index;
      })
      .map(({ item }) => item);
  }, [components, componentSort]);
  const componentPageCount = Math.max(1, Math.ceil(sortedComponents.length / MARKET_INDEX_COMPONENTS_PER_PAGE));
  const visibleComponents = sortedComponents.slice((componentPage - 1) * MARKET_INDEX_COMPONENTS_PER_PAGE, componentPage * MARKET_INDEX_COMPONENTS_PER_PAGE);
  return (
    <section className="renew-box-market renew-index-market">
      <div className="renew-index-head">
        <div>
          <span>Index / PSA10</span>
          <h2>{selectedIndex.title}</h2>
        </div>
        <div className="renew-chip-group">
          <button type="button" className={range === '1d' ? 'is-active' : ''} onClick={() => { setRange('1d'); setComponentPage(1); }}>1D</button>
          <button type="button" className={range === '7d' ? 'is-active' : ''} onClick={() => { setRange('7d'); setComponentPage(1); }}>7D</button>
          <button type="button" className={range === '1m' ? 'is-active' : ''} onClick={() => { setRange('1m'); setComponentPage(1); }}>1M</button>
          <button type="button" className={range === '6m' ? 'is-active' : ''} onClick={() => { setRange('6m'); setComponentPage(1); }}>6M</button>
          <button type="button" className={range === '1y' ? 'is-active' : ''} onClick={() => { setRange('1y'); setComponentPage(1); }}>1Y</button>
        </div>
      </div>
      <div className="renew-index-sector-head">
        <span>Sector Index</span>
        <em>Manga, Luffy</em>
      </div>
      <div className="renew-index-tabs" aria-label="Market sector index type">
        {MARKET_INDEX_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={indexType === option.key ? 'is-active' : ''}
            onClick={() => {
              setIndexType(option.key);
              setDetailsOpen(false);
              setComponentPage(1);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="renew-index-summary">
        <strong>{loading ? '...' : formatIndexValue(payload?.currentValue)}</strong>
        <span>Base 100 · {payload?.index?.baseDate || '-'}</span>
        <div>
          <em className={indexChangeClass(payload?.change?.d1)}>1D {formatIndexDailyChange(payload?.change?.d1)}</em>
          <em className={Number(payload?.change?.d7) >= 0 ? 'is-up' : 'is-down'}>7D {formatIndexChange(payload?.change?.d7)}</em>
          <em className={Number(payload?.change?.m1) >= 0 ? 'is-up' : 'is-down'}>1M {formatIndexChange(payload?.change?.m1)}</em>
          <em className={Number(payload?.change?.m6) >= 0 ? 'is-up' : 'is-down'}>6M {formatIndexChange(payload?.change?.m6)}</em>
        </div>
      </div>
      <RenewIndexChart points={payload?.points || []} />
      <button
        type="button"
        className="renew-index-disclosure"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((value) => !value)}
      >
        <span>구성 정보 {detailsOpen ? `${componentPage}/${componentPageCount}` : ''}</span>
        <b>{detailsOpen ? '-' : '+'}</b>
      </button>
      {detailsOpen ? (
        <>
          <div className="renew-index-meta">
            <span>{payload?.activeComponentCount || 0}/{payload?.componentCount || 33} cards reflected</span>
            <span>PSA10 SNKRDUNK 일별 중앙값 기준</span>
          </div>
          <div className="renew-index-component-sort" aria-label="Index component sort">
            <button
              type="button"
              className={componentSort === 'default' ? 'is-active' : ''}
              onClick={() => {
                setComponentSort('default');
                setComponentPage(1);
              }}
            >
              기본
            </button>
            <button
              type="button"
              className={componentSort === 'gainers' ? 'is-active' : ''}
              onClick={() => {
                setComponentSort('gainers');
                setComponentPage(1);
              }}
            >
              상승률
            </button>
            <button
              type="button"
              className={componentSort === 'losers' ? 'is-active' : ''}
              onClick={() => {
                setComponentSort('losers');
                setComponentPage(1);
              }}
            >
              하락률
            </button>
          </div>
          <div className="renew-index-components">
            {visibleComponents.map((item) => (
              <a
                key={item.apparelId}
                className="renew-index-component"
                href={getMarketIndexComponentHref(item)}
                aria-label={`${item.code || item.name} mapped market price`}
                onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  const currentState = window.history.state || {};
                  window.history.replaceState({
                    ...currentState,
                    marketIndexViewState: {
                      ...(currentState.marketIndexViewState || {}),
                      scrollY: window.scrollY
                    }
                  }, '', window.location.href);
                  if (onOpenComponent) {
                    onOpenComponent(item);
                    return;
                  }
                  rememberCurrentAppView();
                  window.location.assign(getMarketIndexComponentHref(item));
                }}
              >
                <b>{item.code}</b>
                <strong>{item.name}</strong>
                <span>{item.note} · #{item.apparelId}</span>
                <div className="renew-index-component-metrics">
                  <em>{formatIndexValue(item.currentIndex)}</em>
                  <i className={indexChangeClass(item.change?.d1)}>1D {formatIndexDailyChange(item.change?.d1)}</i>
                </div>
              </a>
            ))}
          </div>
          {componentPageCount > 1 ? (
            <div className="renew-index-pagination" aria-label="Index component pages">
              {Array.from({ length: componentPageCount }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={componentPage === page ? 'is-active' : ''}
                  onClick={() => setComponentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function RenewBoxMarket({ uiLang, initialBoxCode = '' }) {
  const t = (key) => getUiText(uiLang, key);
  const savedViewState = getAppHistoryState().boxMarketViewState || {};
  const [sortMode, setSortMode] = useState(() => ['latest', 'high', 'low'].includes(savedViewState.sortMode) ? savedViewState.sortMode : 'latest');
  const [boxPage, setBoxPage] = useState(() => Math.max(1, Number(savedViewState.boxPage) || 1));
  const [boxes, setBoxes] = useState(resolvedBoxMarketItems);
  const previousBoxViewRef = useRef({ sortMode, initialBoxCode });
  useEffect(() => {
    if (getPageFromPath(window.location.pathname) !== 'prices') return;
    replaceAppHistoryState({ boxMarketViewState: { sortMode, boxPage } });
  }, [sortMode, boxPage]);
  useEffect(() => {
    const previous = previousBoxViewRef.current;
    previousBoxViewRef.current = { sortMode, initialBoxCode };
    if (previous.sortMode === sortMode && previous.initialBoxCode === initialBoxCode) return;
    setBoxPage(1);
  }, [sortMode, initialBoxCode]);
  const sortedBoxes = useMemo(() => {
    const routeCode = String(initialBoxCode || '').toUpperCase().replace(/-/g, '');
    const sourceBoxes = routeCode
      ? boxes.filter((item) => String(item.code || '').toUpperCase().replace(/-/g, '') === routeCode)
      : boxes;
    const withIndex = sourceBoxes.map((item, index) => ({ ...item, index }));
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
      const releaseA = getBoxReleaseSortValue(a);
      const releaseB = getBoxReleaseSortValue(b);
      if (!releaseA || !releaseB) return releaseA ? -1 : releaseB ? 1 : a.index - b.index;
      return releaseB - releaseA || a.index - b.index;
    });
  }, [boxes, sortMode, initialBoxCode]);
  const totalBoxPages = initialBoxCode ? 1 : Math.max(1, Math.ceil(sortedBoxes.length / BOX_MARKET_PAGE_SIZE));
  const currentBoxPage = Math.min(boxPage, totalBoxPages);
  const pagedBoxes = initialBoxCode
    ? sortedBoxes
    : sortedBoxes.slice((currentBoxPage - 1) * BOX_MARKET_PAGE_SIZE, currentBoxPage * BOX_MARKET_PAGE_SIZE);

  return (
    <section className="renew-box-market">
      <div className="renew-box-market-head">
        <div className="renew-chip-group">
          <button type="button" className={sortMode === 'latest' ? 'is-active' : ''} onClick={() => setSortMode('latest')}>{t('boxSortLatest')}</button>
          <button type="button" className={sortMode === 'high' ? 'is-active' : ''} onClick={() => setSortMode('high')}>{t('boxSortHigh')}</button>
          <button type="button" className={sortMode === 'low' ? 'is-active' : ''} onClick={() => setSortMode('low')}>{t('boxSortLow')}</button>
        </div>
      </div>
      <div className="renew-box-market-grid">
        {pagedBoxes.map((box) => (
          <a key={box.apparelId} className="renew-box-market-card" href={box.sourceUrl} target="_blank" rel="noreferrer">
            <div className="renew-box-thumb">
              {box.previewImageUrl ? <img src={box.previewImageUrl} alt={box.name} onError={placeholderImage} /> : <span>{box.code}</span>}
            </div>
            <div>
              <strong>{box.name}</strong>
              <span className="renew-box-mobile-title">
                <em>{box.code}</em>
                <span>{BOX_SHORT_TITLES[box.code] || box.name}</span>
              </span>
              <b>{formatBoxMarketPrice(box) || t('checkPrice')}</b>
            </div>
          </a>
        ))}
      </div>
      {totalBoxPages > 1 && (
        <div className="renew-box-market-pager" aria-label={getLocaleText(uiLang, '박스 시세 페이지', 'Box price pages', 'ボックス相場ページ')}>
          <button type="button" disabled={currentBoxPage <= 1} onClick={() => setBoxPage((page) => Math.max(1, page - 1))}>
            {getLocaleText(uiLang, '이전', 'Prev', '前へ')}
          </button>
          {Array.from({ length: totalBoxPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={page === currentBoxPage ? 'is-active' : ''}
              aria-current={page === currentBoxPage ? 'page' : undefined}
              onClick={() => setBoxPage(page)}
            >
              {page}
            </button>
          ))}
          <button type="button" disabled={currentBoxPage >= totalBoxPages} onClick={() => setBoxPage((page) => Math.min(totalBoxPages, page + 1))}>
            {getLocaleText(uiLang, '다음', 'Next', '次へ')}
          </button>
        </div>
      )}
    </section>
  );
}

function parseMarketCodeNumber(code) {
  const match = String(code || '').match(/(?:OP|EB|ST)-?(\d+)/i);
  return match ? Number(match[1]) || 0 : 0;
}

function getMarketFocusScore(item) {
  const listingScore = Number(item.listingCount || 0) * 1000000;
  const priceScore = Number(item.minPrice || 0) > 0 ? 100000 : 0;
  const latestScore = parseMarketCodeNumber(item.code) * 1000;
  return listingScore + priceScore + latestScore + Math.min(Number(item.minPrice || 0), 999999) / 1000;
}

const SNKRDUNK_POPULAR_RANK = new Map(
  snkrdunkPopularApparelIds.map((apparelId, index) => [apparelId, index])
);

function compareMarketFocus(left, right) {
  const leftRank = SNKRDUNK_POPULAR_RANK.get(String(left?.apparelId || ''));
  const rightRank = SNKRDUNK_POPULAR_RANK.get(String(right?.apparelId || ''));
  if (leftRank !== undefined || rightRank !== undefined) {
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  }
  return getMarketFocusScore(right) - getMarketFocusScore(left);
}

function getMarketDisplayName(item) {
  const code = String(item?.code || '').trim();
  let name = String(item?.name || '').trim();
  name = name
    .replace(/\s*:?\s*Opened\b/gi, '')
    .replace(/\s*\((?:Promotional Card|Booster Pack|Premium Booster|Starter Deck|Extra Booster|Championship|Japanese|English)[^)]+\)/gi, '')
    .replace(/\s*\[[^\]]+\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return code && name ? `${name} [${code}]` : name || code;
}

function getMarketShortName(item) {
  let name = String(item?.name || '').trim();
  name = name
    .replace(/\s*:?\s*Opened\b/gi, '')
    .replace(/\s*\[[^\]]+\]/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\b(SEC-SPC|SEC-SP|SEC-P|SR-SP|SR-P|R-P|L-P|SP|SEC|L|SR|R|UC|C)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return name || String(item?.code || '').trim();
}

function getMarketMetaLine(item) {
  const name = String(item?.name || '');
  const rarity = name.match(/\b(SEC-SPC|SEC-SP|SEC-P|SR-SP|SR-P|R-P|L-P|SP|SEC|L|SR|R|UC|C)\b/i)?.[1]?.toUpperCase();
  const variants = [];
  if (/comic/i.test(name)) variants.push('Comic');
  if (/wanted/i.test(name)) variants.push('Wanted');
  if (/parallel|-P\b/i.test(name)) variants.push('Parallel');
  if (/promo|promotional/i.test(name) || /^P-/.test(String(item?.code || ''))) variants.push('Promo');
  return [item?.locale || 'JP', rarity, ...variants].filter(Boolean).join(' · ');
}

function getMarketCandidatePriceText(item, fallbackText, uiLang = 'KR') {
  const livePriceJpy = Number(item?.displayPriceJpy || item?.latestPriceJpy || 0);
  if (livePriceJpy > 0) return getLocalizedCurrencyText(livePriceJpy, uiLang);
  const staticPriceUsd = Number(item?.minPrice || 0);
  if (staticPriceUsd <= 0) return fallbackText;
  return isJapaneseUi(uiLang) ? formatYen(staticPriceUsd * MARKET_USD_TO_JPY) : formatUsdWonFromUsd(staticPriceUsd);
}

function getMarketCandidateStockScore(item) {
  const priceScore = Number(item?.displayPriceJpy || item?.latestPriceJpy || item?.minPrice || 0) > 0 ? 1 : 0;
  const listingScore = Number(item?.listingCount || 0) > 0 ? 1 : 0;
  return (priceScore * 2) + listingScore;
}

function getMarketCandidatePriceRank(item) {
  const livePriceJpy = Number(item?.displayPriceJpy || item?.latestPriceJpy || 0);
  if (livePriceJpy > 0) return livePriceJpy;
  const staticPriceUsd = Number(item?.minPrice || 0);
  return staticPriceUsd > 0 ? staticPriceUsd * MARKET_USD_TO_JPY : 0;
}

function normalizeMarketText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7'"“”‘’()[\]{}:_\-/,]/g, '')
    .trim();
}

function hasHangulText(value = '') {
  return /[가-힣]/.test(String(value || ''));
}

function getMarketSearchText(item) {
  return normalizeMarketText([
    item?.code,
    item?.name,
    item?.setName,
    item?.apparelId
  ].filter(Boolean).join(' '));
}

function uniqueMarketItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.apparelId || `${item?.code}-${item?.name}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getKoreanNameMarketCodes(query) {
  if (!hasHangulText(query)) return new Set();
  try {
    const [krCards, jpCards] = await Promise.all([
      searchCards(query, 'KR').catch(() => []),
      searchCards(query, 'JP').catch(() => [])
    ]);
    const cards = [...krCards, ...jpCards];
    return new Set(cards.flatMap((card) => [
      card.cardNo,
      card.baseCardNo,
      card.marketCode
    ]).filter(Boolean).map(normalizeCode));
  } catch {
    return new Set();
  }
}

function RenewCardMarket({ uiLang, marketLocale = 'JP' }) {
  const t = (key) => getUiText(uiLang, key);
  const savedViewState = getAppHistoryState().cardMarketViewState || {};
  const [sortMode, setSortMode] = useState(() => ['focus', 'high'].includes(savedViewState.sortMode) ? savedViewState.sortMode : 'focus');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (getPageFromPath(window.location.pathname) !== 'prices') return;
    replaceAppHistoryState({ cardMarketViewState: { sortMode } });
  }, [sortMode]);

  useEffect(() => {
    let cancelled = false;
    import('./data/market-cards.js')
      .then((mod) => {
        if (!cancelled && Array.isArray(mod.default)) {
          setItems(mod.default.filter((item) => String(item?.locale || '').toUpperCase() === marketLocale && item?.apparelId));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [marketLocale]);

  const visibleItems = useMemo(() => {
    const withPrice = items.filter((item) => Number(item.minPrice || 0) > 0);
    const source = sortMode === 'focus' ? items : (withPrice.length ? withPrice : items);
    const sorted = [...source].sort((a, b) => {
      if (sortMode === 'high') return (Number(b.minPrice) || 0) - (Number(a.minPrice) || 0);
      return compareMarketFocus(a, b);
    });
    return sorted.slice(0, 10);
  }, [items, sortMode]);

  return (
    <section className="renew-box-market renew-card-market">
      <div className="renew-box-market-head">
        <div className="renew-chip-group">
          <button type="button" className={sortMode === 'focus' ? 'is-active' : ''} onClick={() => setSortMode('focus')}>{t('marketCardSortFocus')}</button>
          <button type="button" className={sortMode === 'high' ? 'is-active' : ''} onClick={() => setSortMode('high')}>{t('marketCardSortHigh')}</button>
        </div>
      </div>
      <div className="renew-market-card-list">
        {visibleItems.map((item) => (
          <a key={`${item.apparelId}-${item.code}`} className="renew-market-card-preview" href={item.sourceUrl} target="_blank" rel="noreferrer">
            <div className="renew-market-card-preview-thumb">
              <img src={item.previewImageUrl || '/card-placeholder.svg'} alt={item.name} onError={placeholderImage} />
            </div>
            <div>
              <small>{item.locale} / {item.code}</small>
              <strong title={item.name}>{getMarketDisplayName(item)}</strong>
              <span>{item.setName}</span>
              <b>{item.minPrice ? formatUsdWonFromUsd(item.minPrice) : t('checkPrice')}</b>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function RenewMarket({ authUser, portfolioHoldings, setPortfolioHoldings, initialCode, initialApparelId, initialCardId, routeRevision, onRequireLogin, uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const savedViewState = getAppHistoryState().marketViewState || {};
  const savedHomeTab = ['box', 'card', 'index'].includes(savedViewState.homeTab) ? savedViewState.homeTab : '';
  const [code, setCode] = useState(initialCode || '');
  const [marketProductLocale, setMarketProductLocale] = useState('JP');
  const [homeTab, setHomeTab] = useState(() => {
    if (savedHomeTab) return savedHomeTab;
    if (typeof window === 'undefined') return 'box';
    const path = getAppPath(window.location.pathname);
    if (MARKET_INDEX_PUBLIC_ENABLED && isMarketIndexPath(path)) return 'index';
    if (path.startsWith('/prices/product/') || path.startsWith('/prices/card/')) return 'card';
    if (path.startsWith('/prices/box/')) return 'box';
    if (path === '/prices/cards') return 'card';
    if (path === '/prices/boxes') return 'box';
    return MARKET_INDEX_PUBLIC_ENABLED && new URLSearchParams(window.location.search).get('tab') === 'index' ? 'index' : 'box';
  });
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [marketDetail, setMarketDetail] = useState(null);
  const [condition, setCondition] = useState('a');
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mappedApparelId, setMappedApparelId] = useState(null);
  const [mappingBusyId, setMappingBusyId] = useState(null);
  const [mappingMessage, setMappingMessage] = useState('');
  const [candidatePanelCollapsed, setCandidatePanelCollapsed] = useState(false);
  const [priceAlertOpen, setPriceAlertOpen] = useState(false);
  const [portfolioEditorOpen, setPortfolioEditorOpen] = useState(false);
  const marketDetailRef = useRef(null);
  const marketCandidateRef = useRef(null);
  const marketCandidateScrollYRef = useRef(0);

  useEffect(() => {
    if (getPageFromPath(window.location.pathname) !== 'prices') return;
    replaceAppHistoryState({ marketViewState: { homeTab, marketProductLocale } });
  }, [homeTab, marketProductLocale]);

  const resetMarketHomeFromLocation = useCallback(() => {
    setCode('');
    setCandidates([]);
    setSelected(null);
    setMarketDetail(null);
    setMessage('');
    setCandidatePanelCollapsed(false);
    const path = getAppPath(window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    if (MARKET_INDEX_PUBLIC_ENABLED && (isMarketIndexPath(path) || params.get('tab') === 'index')) setHomeTab('index');
    else if (path.startsWith('/prices/card/') || path === '/prices/cards') setHomeTab('card');
    else if (path === '/prices' && savedHomeTab) setHomeTab(savedHomeTab);
    else setHomeTab('box');
  }, [savedHomeTab]);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      if (initialApparelId) {
        loadMarketCards()
          .then((items) => {
            const item = items.find((candidate) => String(candidate.apparelId) === String(initialApparelId));
            const itemLocale = String(item?.locale || 'JP').toUpperCase();
            setMarketProductLocale(itemLocale);
            searchMarket(initialCode, initialApparelId, itemLocale);
          })
          .catch(() => {
            searchMarket(initialCode, initialApparelId);
          });
        return;
      }
      searchMarket(initialCode);
      return;
    }
    if (initialApparelId) {
      loadMarketCards()
        .then((items) => {
          const item = items.find((candidate) => String(candidate.apparelId) === String(initialApparelId));
          if (!item?.code) return;
          const itemLocale = String(item.locale || 'JP').toUpperCase();
          setCode(item.code);
          setMarketProductLocale(itemLocale);
          searchMarket(item.code, initialApparelId, itemLocale);
        })
        .catch(() => {});
      return;
    }
    resetMarketHomeFromLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, initialApparelId, routeRevision]);

  useEffect(() => {
    const handleMarketPopState = () => {
      if (getPageFromPath(window.location.pathname) !== 'prices') return;
      const routeState = getMarketRouteState(window.location.pathname, window.location.search);
      if (routeState.code || routeState.apparelId) return;
      resetMarketHomeFromLocation();
    };
    window.addEventListener('popstate', handleMarketPopState);
    return () => window.removeEventListener('popstate', handleMarketPopState);
  }, [resetMarketHomeFromLocation]);

  useEffect(() => {
    let cancelled = false;
    setMappedApparelId(null);
    setMappingMessage('');
    if (!initialCardId) return undefined;
    findApprovedCardMarketLink({ id: initialCardId })
      .then((link) => {
        if (!cancelled) setMappedApparelId(link?.apparelId ? String(link.apparelId) : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialCardId]);

  async function loadMarketCards() {
    const mod = await import('./data/market-cards.js');
    return Array.isArray(mod.default) ? mod.default : [];
  }

  async function searchMarket(nextCode = code, targetApparelId = null, targetLocale = marketProductLocale) {
    const rawQuery = String(nextCode || '').trim();
    const normalized = normalizeCode(rawQuery);
    if (!normalized) return;
    setLoading(true);
    setMessage('');
    setCandidates([]);
    setSelected(null);
    setMarketDetail(null);
    setCandidatePanelCollapsed(false);
    try {
      const items = await loadMarketCards();
      const marketItems = items.filter((item) => item?.apparelId);
      const primaryLocale = String(targetLocale || marketProductLocale || 'JP').toUpperCase();
      const primaryItems = marketItems.filter((item) => String(item.locale || '').toUpperCase() === primaryLocale);
      const exactCodeResult = primaryItems.filter((item) => normalizeCode(item.code) === normalized);
      const normalizedText = normalizeMarketText(rawQuery);
      const primaryApparelIdResult = primaryItems.filter((item) => String(item.apparelId || '') === rawQuery);
      const primaryTitleResult = primaryItems.filter((item) => normalizedText && getMarketSearchText(item).includes(normalizedText));
      const globalTitleResult = exactCodeResult.length || primaryTitleResult.length
        ? []
        : marketItems.filter((item) => (
          String(item.apparelId || '') === rawQuery
          || (normalizedText && getMarketSearchText(item).includes(normalizedText))
        ));
      const resultSource = exactCodeResult.length
        ? exactCodeResult
        : uniqueMarketItems([
          ...primaryApparelIdResult,
          ...primaryTitleResult,
          ...globalTitleResult
        ]);
      const koreanNameCodes = exactCodeResult.length ? new Set() : await getKoreanNameMarketCodes(rawQuery);
      const expandedResult = exactCodeResult.length
        ? exactCodeResult
        : uniqueMarketItems([
          ...resultSource,
          ...primaryItems.filter((item) => koreanNameCodes.has(normalizeCode(item.code)))
        ]);
      let discoveredItems = [];
      if (!expandedResult.length || (targetApparelId && !expandedResult.some((item) => String(item.apparelId) === String(targetApparelId)))) {
        try {
          const detail = await fetchMarketPrice({
            code: rawQuery,
            apparelId: targetApparelId || null,
            summary: true
          });
          if (detail?.item?.apparelId) discoveredItems = [detail.item];
        } catch {
          // The D1 catalog fallback is optional; keep static search behavior on failure.
        }
      }
      const combinedResult = uniqueMarketItems([...expandedResult, ...discoveredItems]);
      const discoveredApparelIds = new Set(discoveredItems.map((item) => String(item.apparelId)));
      const shouldSortCandidatesByPrice = !targetApparelId && !exactCodeResult.length;
      const result = combinedResult
        .filter((item) => {
          if (targetApparelId && String(item.apparelId) === String(targetApparelId)) return true;
          if (discoveredApparelIds.has(String(item.apparelId))) return true;
          if (exactCodeResult.length && normalizeCode(item.code) === normalized) return true;
          if (normalizedText && getMarketSearchText(item).includes(normalizedText)) return true;
          const price = Number(item.minPrice || 0);
          const listingCount = item.listingCount;
          return price > 0 || listingCount == null || Number(listingCount) > 0;
        })
        .sort((a, b) => {
          const targetDelta = Number(String(b.apparelId) === String(targetApparelId)) - Number(String(a.apparelId) === String(targetApparelId));
          if (targetDelta) return targetDelta;
          const exactDelta = Number(normalizeCode(b.code) === normalized) - Number(normalizeCode(a.code) === normalized);
          if (exactDelta) return exactDelta;
          const koreanDelta = Number(koreanNameCodes.has(normalizeCode(b.code))) - Number(koreanNameCodes.has(normalizeCode(a.code)));
          if (koreanDelta) return koreanDelta;
          const localeDelta = Number(String(b.locale || '').toUpperCase() === primaryLocale) - Number(String(a.locale || '').toUpperCase() === primaryLocale);
          if (localeDelta) return localeDelta;
          if (shouldSortCandidatesByPrice) {
            const priceDelta = getMarketCandidatePriceRank(b) - getMarketCandidatePriceRank(a);
            if (priceDelta) return priceDelta;
          }
          const stockDelta = getMarketCandidateStockScore(b) - getMarketCandidateStockScore(a);
          if (stockDelta) return stockDelta;
          return String(a.name).localeCompare(String(b.name), 'en');
        });
      const hydrateLimit = Boolean(targetApparelId) || exactCodeResult.length > 0
        ? result.length
        : Math.min(result.length, 36);
      const hydratedHead = hydrateLimit
        ? (await Promise.all(result.slice(0, hydrateLimit).map(async (item) => {
          try {
            const summary = await fetchMarketPrice({ code: item.code, apparelId: item.apparelId, summary: true });
            const summarySeriesA = getMarketConditionBucket(summary?.series, 'a') || {};
            const latestPrice = Number(getMarketConditionBucket(summary?.latestByCondition, 'a')?.price || 0);
            const hasSeries = Boolean(
              summarySeriesA['1y']?.length
              || summarySeriesA.all?.length
              || summarySeriesA['1m']?.length
              || summarySeriesA['7d']?.length
              || getMarketConditionBucket(summary?.recentSalesByCondition, 'a')?.length
            );
            return {
              ...item,
              displayPriceJpy: latestPrice > 0 ? latestPrice : item.displayPriceJpy,
              hasMarketHistory: hasSeries
            };
          } catch {
            return item;
          }
        }))).filter(Boolean)
        : [];
      const hydratedResult = [
        ...hydratedHead.sort((a, b) => {
          const targetDelta = Number(String(b.apparelId) === String(targetApparelId)) - Number(String(a.apparelId) === String(targetApparelId));
          if (targetDelta) return targetDelta;
          const historyDelta = Number(Boolean(b.hasMarketHistory)) - Number(Boolean(a.hasMarketHistory));
          if (historyDelta) return historyDelta;
          if (shouldSortCandidatesByPrice) {
            const priceDelta = getMarketCandidatePriceRank(b) - getMarketCandidatePriceRank(a);
            if (priceDelta) return priceDelta;
          }
          const stockDelta = getMarketCandidateStockScore(b) - getMarketCandidateStockScore(a);
          if (stockDelta) return stockDelta;
          return String(a.name).localeCompare(String(b.name), 'en');
        }),
        ...result.slice(hydrateLimit)
      ];
      const directItem = targetApparelId
        ? hydratedResult.find((item) => String(item.apparelId) === String(targetApparelId))
        : null;
      setCandidates(directItem ? [] : hydratedResult);
      setSelected(directItem || (hydratedResult.length === 1 ? hydratedResult[0] : null));
      setCandidatePanelCollapsed(Boolean(directItem || hydratedResult.length === 1));
      setMarketDetail(null);
      if (!hydratedResult.length) setMessage(t('marketNoCandidates'));
      if (targetApparelId && hydratedResult.length && !directItem) setMessage(t('marketFallback'));
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
    (async () => {
      const detail = await fetchMarketPrice({ code: selected.code, apparelId: selected.apparelId });
      const approvedLink = await findApprovedCardMarketLinkByApparelId(selected.apparelId).catch(() => null);
      const psaDetail = approvedLink?.cardId ? await fetchPsa10MarketPrice(approvedLink.cardId).catch(() => null) : null;
      return mergePsa10MarketDetail(detail, psaDetail);
    })()
      .then((detail) => {
        if (cancelled) return;
        setMarketDetail(detail || null);
        setCondition(normalizeMarketConditionKey(detail?.defaultCondition || detail?.conditions?.[0]?.key || 'a'));
        setRange('7d');
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

  async function savePortfolioLot({ grade, lot }) {
    if (!authUser || !selected) {
      window.alert(t('loginRequired'));
      return;
    }
    const gradeKey = normalizeMarketConditionKey(grade);
    const approvedLink = await findApprovedCardMarketLinkByApparelId(selected.apparelId);
    const linkedCard = approvedLink?.cardId ? await fetchCardById(approvedLink.cardId) : null;
    const linkedImageUrl = linkedCard?.imageUrl || linkedCard?.image_url || linkedCard?.image || selected.previewImageUrl;
    const payload = await savePortfolioPurchase({
      holding: {
        code: selected.code,
        apparelId: selected.apparelId,
        cardId: approvedLink?.cardId || '',
        name: selected.name,
        setName: selected.setName || '',
        imageUrl: linkedImageUrl,
        previewImageUrl: linkedImageUrl,
        sourceUrl: selected.sourceUrl,
        grade: gradeKey
      },
      purchase: lot
    });
    setPortfolioHoldings(Array.isArray(payload?.holdings) ? payload.holdings : []);
  }

  async function deletePortfolioLot({ purchaseId }) {
    const payload = await deletePortfolioPurchase(purchaseId);
    setPortfolioHoldings(Array.isArray(payload?.holdings) ? payload.holdings : []);
  }

  function openMarketIndexComponent(item) {
    const nextApparelId = item?.apparelId || null;
    const nextCode = String(item?.code || '').trim();
    const nextLocale = getMarketIndexComponentLocale(item);
    if (!nextApparelId && !nextCode) return;
    setHomeTab('card');
    setCode(nextCode);
    setMarketProductLocale(nextLocale);
    if (typeof window !== 'undefined') {
      pushAppHistory(getMarketIndexComponentHref(item), {
        marketReturnUrl: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        marketReturnContext: 'index'
      });
    }
    searchMarket(nextCode || String(nextApparelId), nextApparelId, nextLocale);
    window.setTimeout(() => {
      marketDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function selectMarketCandidate(item) {
    marketCandidateScrollYRef.current = window.scrollY || 0;
    setSelected(item);
    setCandidatePanelCollapsed(true);
    window.setTimeout(() => {
      marketDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function returnToMarketCandidates() {
    setCandidatePanelCollapsed(false);
    window.setTimeout(() => {
      if (marketCandidateScrollYRef.current > 0) {
        window.scrollTo({ top: marketCandidateScrollYRef.current, behavior: 'smooth' });
        return;
      }
      marketCandidateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function returnFromMarketDetail() {
    if (candidates.length > 1) {
      returnToMarketCandidates();
      return;
    }
    const currentState = getAppHistoryState();
    if (currentState.cardPoneInternal) {
      window.history.back();
      return;
    }
    const fallbackUrl = currentState.marketReturnUrl || getLocalizedPagePath('prices', uiLang);
    replaceAppHistoryState({
      cardPoneInternal: false,
      marketReturnUrl: null,
      marketReturnContext: null
    }, fallbackUrl);
    resetMarketHomeFromLocation();
  }

  async function mapCandidateToInitialCard(event, item) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!initialCardId || !item?.apparelId || mappingBusyId) return;
    setMappingBusyId(String(item.apparelId));
    setMappingMessage('');
    try {
      if (mappedApparelId === String(item.apparelId)) {
        await blockCardMarketLinkOverride(initialCardId);
        setMappedApparelId(null);
        setMappingMessage('매핑 취소 완료');
      } else {
        await saveCardMarketLinkOverride({
          cardId: initialCardId,
          apparelId: item.apparelId,
          note: `${item.code || ''} ${getMarketShortName(item) || ''}`.trim()
        });
        setMappedApparelId(String(item.apparelId));
        setMappingMessage('매핑 저장 완료');
      }
    } catch (error) {
      setMappingMessage(error?.message || '매핑 처리 실패');
    } finally {
      setMappingBusyId(null);
    }
  }

  const normalizedCondition = normalizeMarketConditionKey(condition);
  const marketConditionOptions = getMarketConditionOptions(marketDetail?.conditions, t);
  const marketRange = MARKET_DETAIL_RANGE_KEYS.has(range) ? range : '7d';
  const selectedLatest = getMarketConditionBucket(marketDetail?.latestByCondition, normalizedCondition);
  const conditionSeries = getMarketConditionBucket(marketDetail?.series, normalizedCondition) || {};
  const chartRange = marketRange;
  const chartPoints = getMarketRangeChartPoints(conditionSeries, chartRange);
  const recentSales = getMarketConditionBucket(marketDetail?.recentSalesByCondition, normalizedCondition) || [];
  const recentSalesInRange = recentSales.filter((sale) => {
    const timestamp = Number(sale?.timestamp || 0);
    return timestamp && Date.now() - timestamp <= RECENT_SALES_VISIBLE_MS;
  });
  const recentSalesVisible = recentSalesInRange.length ? recentSalesInRange : recentSales;
  const currentPrice = selectedLatest?.price ? getLocalizedCurrencyText(selectedLatest.price, uiLang) : getMarketCandidatePriceText(selected, t('checkPrice'), uiLang);
  const latestSourceUrl = selectedLatest?.sourceUrl || '';
  const psaSourceUrl = normalizedCondition === 'psa10' && latestSourceUrl && !/snkrdunk\.com/i.test(latestSourceUrl)
    ? latestSourceUrl
    : recentSales.find((sale) => sale?.sourceUrl && !/snkrdunk\.com/i.test(sale.sourceUrl))?.sourceUrl || '';
  const currentPriceLabel = normalizedCondition === 'psa10' ? t('psa10IntegratedPrice') : t('snkrLowestPrice');
  const showMarketHome = !code.trim() && !selected && !candidates.length;
  const canMapInitialCard = authUser?.app_metadata?.role === 'admin' && Boolean(initialCardId);

  return (
    <main className="renew-subpage">
      <section className="renew-panel renew-market">
        <form className="renew-market-search" onSubmit={(event) => { event.preventDefault(); searchMarket(code); }}>
          <a className="renew-market-snkr-link" href={SNKRDUNK_MARKET_URL} target="_blank" rel="noreferrer" aria-label="SNKRDUNK 바로가기">
            <span>SNKR</span>
            <span>{t('snkrShortcut')}</span>
          </a>
          <div className="renew-market-search-field">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('marketCodePlaceholder')} />
            <div className="renew-market-locale-tabs renew-market-locale-tabs--inline" aria-label="Market product locale">
              <button type="button" className={marketProductLocale === 'JP' ? 'is-active' : ''} onClick={() => setMarketProductLocale('JP')}>JP</button>
              <button type="button" className={marketProductLocale === 'EN' ? 'is-active' : ''} onClick={() => setMarketProductLocale('EN')}>EN</button>
            </div>
          </div>
          <button type="submit">{t('marketSearch')}</button>
        </form>

        {loading ? <div className="renew-empty">{t('marketLoading')}</div> : null}
        {message ? <div className="renew-empty">{message}</div> : null}

        {showMarketHome ? (
          <>
            <div className="renew-market-home-tabs">
              <button type="button" className={homeTab === 'box' ? 'is-active' : ''} onClick={() => setHomeTab('box')}>{t('marketHomeBoxTab')}</button>
              <button type="button" className={homeTab === 'card' ? 'is-active' : ''} onClick={() => setHomeTab('card')}>{t('marketHomeCardTab')}</button>
              {MARKET_INDEX_PUBLIC_ENABLED ? <button type="button" className={homeTab === 'index' ? 'is-active' : ''} onClick={() => setHomeTab('index')}>Index</button> : null}
            </div>
            {homeTab === 'box' ? <RenewBoxMarket uiLang={uiLang} initialBoxCode={getBoxRouteCode()} /> : homeTab === 'card' ? <RenewCardMarket uiLang={uiLang} marketLocale={marketProductLocale} /> : MARKET_INDEX_PUBLIC_ENABLED ? <RenewMarketIndex onOpenComponent={openMarketIndexComponent} /> : <RenewBoxMarket uiLang={uiLang} initialBoxCode={getBoxRouteCode()} />}
          </>
        ) : null}

        {candidates.length > 1 && selected && candidatePanelCollapsed ? (
          <div className="renew-market-candidate-summary">
            <div>
              <small>{t('selectedVariant')}</small>
              <strong>{selected.code} · {getMarketShortName(selected)}</strong>
              <span>{getMarketMetaLine(selected)}</span>
            </div>
            <button type="button" onClick={returnToMarketCandidates}>{t('reselectVariant')}</button>
          </div>
        ) : null}

        {candidates.length > 1 && !candidatePanelCollapsed ? (
          <div className="renew-market-candidates" ref={marketCandidateRef}>
            <b>{t('variantSelect')}</b>
            {mappingMessage ? <small className="renew-market-mapping-message">{mappingMessage}</small> : null}
            <div>
              {candidates.map((item) => (
                <button key={`${item.apparelId}-${item.locale}`} type="button" className={selected?.apparelId === item.apparelId ? 'is-active' : ''} onClick={() => selectMarketCandidate(item)}>
                  <img src={item.previewImageUrl || '/card-placeholder.svg'} alt={item.name} onError={placeholderImage} />
                  <div className="renew-market-candidate-body">
                    <small className="renew-market-candidate-code">{item.code}</small>
                          <span title={item.name}>{getMarketShortName(item)}</span>
                          <small>{getMarketMetaLine(item)}</small>
                          <small className="renew-market-candidate-set">{item.setName}</small>
                          <div className="renew-market-candidate-bottom">
                            <b>{getMarketCandidatePriceText(item, t('checkPrice'), uiLang)}</b>
                            <small className="renew-market-candidate-id">#{item.apparelId}</small>
                          </div>
                          {canMapInitialCard ? (
                            <span className="renew-market-map-row">
                              <em>{mappedApparelId === String(item.apparelId) ? '매핑됨' : '미매핑'}</em>
                              <span
                                role="button"
                                tabIndex={0}
                                className="renew-market-map-button"
                                aria-disabled={mappingBusyId === String(item.apparelId)}
                                onClick={(event) => mapCandidateToInitialCard(event, item)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') mapCandidateToInitialCard(event, item);
                                }}
                              >
                                {mappingBusyId === String(item.apparelId) ? '처리 중' : (mappedApparelId === String(item.apparelId) ? '매핑 취소' : '이 카드에 매핑')}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="renew-market-detail" ref={marketDetailRef}>
            <button type="button" className="renew-market-detail-back" onClick={returnFromMarketDetail}>
              ← {candidates.length > 1
                ? t('reselectVariant')
                : getLocaleText(uiLang, '이전 화면', 'Back', '前の画面')}
            </button>
            <div className="renew-market-card">
              <img src={selected.previewImageUrl || '/card-placeholder.svg'} alt={selected.name} onError={placeholderImage} />
              <div>
                <b>{selected.code}</b>
                <h2 title={selected.name}>{getMarketShortName(selected)}</h2>
                <small className="renew-market-selected-meta">{getMarketMetaLine(selected)}</small>
                <p>{selected.setName}</p>
              </div>
              <strong className="renew-market-price"><small>{currentPriceLabel}</small><span>{currentPrice}</span></strong>
              <div className="renew-market-actions">
                {canMapInitialCard ? (
                  <button type="button" onClick={(event) => mapCandidateToInitialCard(event, selected)}>
                    {mappedApparelId === String(selected.apparelId) ? '매핑 취소' : '이 카드에 매핑'}
                  </button>
                ) : null}
                <a href={selected?.sourceUrl} target="_blank" rel="noreferrer"><span className="renew-action-full">{t('sourceMarket')}</span><span className="renew-action-compact">{t('sourceMarketShort')}</span></a>
                {!isJapaneseUi(uiLang) ? <button
                  type="button"
                  className="renew-alert-button"
                  onClick={() => {
                    if (!authUser) {
                      onRequireLogin?.();
                      return;
                    }
                    setPriceAlertOpen(true);
                  }}
                >
                  시세 알림
                </button> : null}
                <button
                  type="button"
                  className="renew-portfolio-add-button"
                  onClick={() => {
                    if (!authUser) {
                      onRequireLogin?.();
                      return;
                    }
                    setPortfolioEditorOpen(true);
                  }}
                >
                  <span aria-hidden="true">+</span>
                  {getLocaleText(uiLang, '포트폴리오 추가', 'Add to Portfolio', 'ポートフォリオに追加')}
                </button>
              </div>
            </div>

            <div className="renew-market-chart">
              <div className="renew-market-controls">
                <div className="renew-chip-group">
                  {marketConditionOptions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={normalizedCondition === item.key ? 'is-active' : ''}
                      onClick={() => setCondition(item.key)}
                    >
                      {item.key === 'a' ? t('aGrade') : item.label}
                    </button>
                  ))}
                </div>
                <div className="renew-chip-group">
                  {MARKET_DETAIL_RANGES.map((item) => (
                    <button key={item.key} type="button" className={chartRange === item.key ? 'is-active' : ''} onClick={() => setRange(item.key)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <RenewMarketChart points={chartPoints} uiLang={uiLang} range={chartRange} />
              <div className="renew-market-recent">
                <h3>{t('recentSales')}</h3>
                {recentSalesVisible.slice(0, 10).map((sale, index) => (
                  <div key={`${sale.date}-${sale.price}-${index}`} className="renew-market-sale">
                    <span>{getMarketSaleSourceLabel(sale, normalizedCondition === 'a' ? 'Single' : normalizedCondition.toUpperCase())}</span>
                    <small>{formatMarketSaleDate(sale)}</small>
                    <strong>{getLocalizedCurrencyText(sale.price, uiLang)}</strong>
                  </div>
                ))}
                {!recentSalesVisible.length ? <div className="renew-empty">{t('noRecentSales')}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
      {priceAlertOpen && selected ? (
        <RenewPriceAlertModal
          item={{
            apparelId: selected.apparelId,
            cardId: initialCardId || '',
            code: selected.code || '',
            name: selected.name || '',
            previewImageUrl: selected.previewImageUrl || ''
          }}
          defaultCondition={normalizedCondition}
          currentPrices={{
            a: Number(getMarketConditionBucket(marketDetail?.latestByCondition, 'a')?.price || 0),
            psa10: Number(getMarketConditionBucket(marketDetail?.latestByCondition, 'psa10')?.price || 0)
          }}
          isAdmin={authUser?.app_metadata?.role === 'admin'}
          onClose={() => setPriceAlertOpen(false)}
        />
      ) : null}
      {portfolioEditorOpen && selected ? (
        <RenewPortfolioEditorModal
          item={{
            ...selected,
            cardId: initialCardId || '',
            price: Number(getMarketConditionBucket(marketDetail?.latestByCondition, normalizedCondition)?.price || 0)
          }}
          initialGrade={normalizedCondition}
          holdings={portfolioHoldings}
          initialDetail={marketDetail}
          onSave={savePortfolioLot}
          onDeleteLot={deletePortfolioLot}
          onClose={() => setPortfolioEditorOpen(false)}
          uiLang={uiLang}
        />
      ) : null}
      <RenewSeoSummary page="prices" titleAs="h1" placement="footer" uiLang={uiLang} />
    </main>
  );
}

function getDeckCardNo(card) {
  return String(card?.baseCardNo || card?.cardNo || '').replace(/_p\d+$/i, '').trim();
}

function isDeckLeaderCard(card) {
  return String(card?.category || '').toUpperCase() === 'LEADER'
    || String(card?.categoryKo || '').includes('리더');
}

function getDeckCardColors(card) {
  const source = `${card?.color || ''},${card?.colorKo || ''}`.toLowerCase();
  const aliases = {
    red: ['red', '적색', '빨강', '赤'],
    green: ['green', '녹색', '초록', '緑'],
    blue: ['blue', '청색', '파랑', '青'],
    purple: ['purple', '자색', '보라', '紫'],
    black: ['black', '흑색', '검정', '黒'],
    yellow: ['yellow', '황색', '노랑', '黄']
  };
  return Object.entries(aliases)
    .filter(([, values]) => values.some((value) => source.includes(String(value).toLowerCase())))
    .map(([key]) => key);
}

function compactDeckCard(card) {
  return {
    id: card.id,
    cardNo: card.cardNo,
    baseCardNo: getDeckCardNo(card),
    name: card.name,
    nameEn: card.nameEn || '',
    seriesName: card.seriesName || '',
    category: card.category || '',
    categoryKo: card.categoryKo || '',
    color: card.color || '',
    colorKo: card.colorKo || '',
    cost: card.cost || '',
    counter: card.counter || '',
    effect: card.effect || '',
    imageUrl: getCardImageSrc(card),
    locale: card.locale || ''
  };
}

function isDeckColorLegal(card, leader) {
  if (!leader || isDeckLeaderCard(card)) return true;
  const leaderColors = new Set(getDeckCardColors(leader));
  const cardColors = getDeckCardColors(card);
  if (!leaderColors.size || !cardColors.length) return true;
  return cardColors.every((color) => leaderColors.has(color));
}

function RenewAdminToolGate({ authResolved, authUser, uiLang, onLogin }) {
  const title = authResolved
    ? getLocaleText(uiLang, '관리자 테스트 중', 'Admin testing only', '管理者テスト中')
    : getLocaleText(uiLang, '계정 확인 중', 'Checking account', 'アカウント確認中');
  return (
    <main className="renew-subpage renew-admin-tool-gate">
      <section className="renew-panel">
        <span className="renew-admin-tool-icon"><MobileNavIcon type="account" /></span>
        <h1>{title}</h1>
        <p>{getLocaleText(
          uiLang,
          '덱 빌더는 데이터 검증이 끝날 때까지 관리자 계정에서만 사용할 수 있습니다.',
          'The deck builder is limited to administrators while its data is being verified.',
          'データ検証が完了するまで、デッキビルダーは管理者のみ利用できます。'
        )}</p>
        {authResolved && !authUser ? (
          <button type="button" className="renew-primary-button" onClick={onLogin}>
            {getLocaleText(uiLang, '로그인', 'Sign in', 'ログイン')}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function RenewDeckLabHome({ uiLang, onOpenBuilder }) {
  const [region, setRegion] = useState('KR');
  const [leaderKeyword, setLeaderKeyword] = useState('');
  const [leaderResults, setLeaderResults] = useState([]);
  const [leaderSearching, setLeaderSearching] = useState(false);
  const [referenceData, setReferenceData] = useState(null);
  const leaderSearchRef = useRef(null);
  const referenceLeaders = useMemo(
    () => new Map((referenceData?.leaders || []).map((leader) => [String(leader.id), leader])),
    [referenceData]
  );
  const referenceTemplates = useMemo(() => (
    (referenceData?.templates || []).reduce((counts, template) => {
      const key = String(template.archetype_id || '');
      counts[key] = Number(counts[key] || 0) + 1;
      return counts;
    }, {})
  ), [referenceData]);

  useEffect(() => {
    let cancelled = false;
    fetchDeckLabReference(region)
      .then((payload) => {
        if (!cancelled) setReferenceData(payload?.configured === false ? null : payload);
      })
      .catch(() => {
        if (!cancelled) setReferenceData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [region]);

  async function searchLeaders() {
    const keyword = leaderKeyword.trim();
    if (!keyword) return;
    setLeaderSearching(true);
    try {
      const cards = await searchCards(keyword, region);
      const seenCardNos = new Set();
      const leaders = (Array.isArray(cards) ? cards : []).filter((card) => {
        if (!isDeckLeaderCard(card)) return false;
        const cardNo = getDeckCardNo(card);
        if (!cardNo || seenCardNos.has(cardNo)) return false;
        seenCardNos.add(cardNo);
        return true;
      });
      setLeaderResults(leaders.slice(0, 12));
    } catch {
      setLeaderResults([]);
    } finally {
      setLeaderSearching(false);
    }
  }

  async function openReferenceArchetype(archetype) {
    const leader = referenceLeaders.get(String(archetype?.leader_id || ''));
    if (!leader?.card_id) return;
    const card = await fetchCardById(leader.card_id).catch(() => null);
    if (card) onOpenBuilder(card);
  }

  const choices = [
    {
      id: 'beginner',
      title: getLocaleText(uiLang, '원피스 카드게임이 처음입니다', 'I am new to the game', 'ワンピースカードが初めてです')
    },
    {
      id: 'starter',
      title: getLocaleText(uiLang, '스타터덱을 가지고 있습니다', 'I have a Starter Deck', 'スタートデッキを持っています')
    },
    {
      id: 'leader',
      title: getLocaleText(uiLang, '사용하고 싶은 리더가 있습니다', 'I have a leader in mind', '使いたいリーダーがいます'),
      onClick: () => leaderSearchRef.current?.focus()
    },
    {
      id: 'tournament',
      title: getLocaleText(uiLang, '최근 대회 덱을 보고 싶습니다', 'Browse recent tournament decks', '最近の大会デッキを見たいです')
    },
    {
      id: 'builder',
      title: getLocaleText(uiLang, '직접 덱을 만들고 싶습니다', 'Build a deck myself', '自分でデッキを作りたいです'),
      onClick: () => onOpenBuilder()
    }
  ];
  return (
    <main className="renew-subpage renew-deck-lab">
      <section className="renew-deck-lab-head">
        <h1>{getLocaleText(uiLang, '덱 빌더 실험실', 'Deck Builder Lab', 'デッキビルダーラボ')}</h1>
      </section>
      <section className="renew-deck-entry-grid">
        {choices.map((choice) => choice.onClick ? (
          <button key={choice.id} type="button" className="renew-deck-entry is-available" onClick={choice.onClick}>
            <span>{choice.title}</span>
            <b aria-hidden="true">→</b>
          </button>
        ) : (
          <article key={choice.id} className="renew-deck-entry is-pending">
            <span>{choice.title}</span>
            <small>{getLocaleText(uiLang, '순차 준비 중', 'Planned', '順次準備中')}</small>
          </article>
        ))}
      </section>
      <section className="renew-deck-reference">
        <div className="renew-deck-reference-head">
          <h2>{getLocaleText(uiLang, '리더별 덱 찾기', 'Find a deck by leader', 'リーダーからデッキを探す')}</h2>
          <div className="renew-deck-region-tabs" aria-label={getLocaleText(uiLang, '카드 환경', 'Card environment', 'カード環境')}>
            {['KR', 'JP', 'EN'].map((item) => (
              <button
                key={item}
                type="button"
                className={region === item ? 'is-active' : ''}
                onClick={() => {
                  setRegion(item);
                  setLeaderResults([]);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="renew-market-search renew-deck-leader-search">
          <input
            ref={leaderSearchRef}
            value={leaderKeyword}
            onChange={(event) => setLeaderKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchLeaders();
            }}
            placeholder={getLocaleText(uiLang, '리더 이름 또는 카드번호', 'Leader name or card number', 'リーダー名またはカード番号')}
          />
          <button type="button" onClick={searchLeaders} disabled={leaderSearching}>
            {leaderSearching
              ? getLocaleText(uiLang, '검색 중', 'Searching', '検索中')
              : getLocaleText(uiLang, '검색', 'Search', '検索')}
          </button>
        </div>
        {leaderResults.length ? (
          <div className="renew-deck-leader-grid">
            {leaderResults.map((card) => (
              <article key={card.id}>
                <img src={getCardImageSrc(card)} alt={card.name} onError={placeholderImage} />
                <div>
                  <b>{getDeckCardNo(card)}</b>
                  <strong>{card.name}</strong>
                  <small>{card.colorKo || card.color}</small>
                </div>
                <button type="button" onClick={() => onOpenBuilder(card)}>
                  {getLocaleText(uiLang, '이 리더로 시작', 'Start with leader', 'このリーダーで開始')}
                </button>
              </article>
            ))}
          </div>
        ) : null}
        {referenceData?.archetypes?.length ? (
          <div className="renew-deck-archetype-grid">
            {referenceData.archetypes.slice(0, 8).map((archetype) => {
              const leader = referenceLeaders.get(String(archetype.leader_id || ''));
              return (
                <button key={archetype.id} type="button" onClick={() => openReferenceArchetype(archetype)}>
                  <span>{leader?.card_no || region}</span>
                  <strong>{archetype.nickname}</strong>
                  <small>
                    {getLocaleText(uiLang, '난이도', 'Difficulty', '難易度')} {archetype.difficulty || '-'}
                    {' · '}
                    {getLocaleText(uiLang, '덱', 'Decks', 'デッキ')} {referenceTemplates[String(archetype.id)] || 0}
                  </small>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function normalizeDeckSearchText(value = '') {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[\s.\u30fb\u00b7]/g, '');
}

function RenewLeaderInsightsModal({ card, region, authUser, uiLang, onClose, onRequireLogin }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useBodyScrollLock(true);
  const cardNo = getDeckCardNo(card);
  const myReview = (overview?.reviews || []).find((item) => item.mine);
  const ratingLabels = {
    1: getLocaleText(uiLang, '매우 아쉬움', 'Very poor', 'とても不満'),
    2: getLocaleText(uiLang, '아쉬움', 'Poor', '不満'),
    3: getLocaleText(uiLang, '보통', 'Average', '普通'),
    4: getLocaleText(uiLang, '좋음', 'Good', '良い'),
    5: getLocaleText(uiLang, '매우 좋음', 'Excellent', 'とても良い')
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderOverview(region, cardNo)
      .then((payload) => {
        if (cancelled) return;
        setOverview(payload);
        const mine = (payload?.reviews || []).find((item) => item.mine);
        if (mine) {
          setRating(Number(mine.rating || 5));
          setContent(mine.content || '');
        }
      })
      .catch(() => {
        if (!cancelled) setOverview({ configured: false, reviews: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [region, cardNo]);

  async function submitReview() {
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    if (!content.trim()) {
      setNotice(getLocaleText(uiLang, '평가 내용을 입력해 주세요.', 'Write a short review.', '評価内容を入力してください。'));
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      setOverview(await saveLeaderReview(region, cardNo, rating, content));
      setNotice(getLocaleText(uiLang, '평가를 저장했습니다.', 'Review saved.', '評価を保存しました。'));
    } catch {
      setNotice(getLocaleText(uiLang, '평가를 저장하지 못했습니다.', 'Unable to save review.', '評価を保存できませんでした。'));
    } finally {
      setSaving(false);
    }
  }

  async function removeReview() {
    if (!authUser) return;
    setSaving(true);
    try {
      setOverview(await deleteLeaderReview(region, cardNo));
      setRating(5);
      setContent('');
      setNotice(getLocaleText(uiLang, '평가를 삭제했습니다.', 'Review deleted.', '評価を削除しました。'));
    } catch {
      setNotice(getLocaleText(uiLang, '평가를 삭제하지 못했습니다.', 'Unable to delete review.', '評価を削除できませんでした。'));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="renew-modal-backdrop renew-leader-insights-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="renew-leader-insights-modal" role="dialog" aria-modal="true" aria-labelledby="leader-insights-title">
        <header>
          <div>
            <small>LEADER</small>
            <h2 id="leader-insights-title">{card.name}</h2>
            <span>{cardNo} · {card.colorKo || card.color}</span>
          </div>
          <button type="button" className="renew-icon-button" onClick={onClose} aria-label={getLocaleText(uiLang, '닫기', 'Close', '閉じる')}>×</button>
        </header>
        <div className="renew-leader-insights-summary">
          <img src={getCardImageSrc(card)} alt={card.name} onError={placeholderImage} />
          <div>
            <div>
              <span>{getLocaleText(uiLang, '선택 사용자', 'Users selecting this leader', '選択ユーザー')}</span>
              <strong>{Number(overview?.usageCount || 0).toLocaleString()}</strong>
            </div>
            <div>
              <span>{getLocaleText(uiLang, '사용자 평가', 'User rating', 'ユーザー評価')}</span>
              <strong>{overview?.reviewCount ? `${Number(overview.averageRating || 0).toFixed(1)} / 5` : '-'}</strong>
            </div>
            {card.effect ? <p>{card.effect}</p> : null}
          </div>
        </div>
        <div className="renew-leader-review-form">
          <div className="renew-leader-rating-head">
            <strong>{getLocaleText(uiLang, '리더 만족도', 'Leader satisfaction', 'リーダー満足度')}</strong>
            <span>{rating} · {ratingLabels[rating]}</span>
          </div>
          <div className="renew-leader-rating" aria-label={getLocaleText(uiLang, '리더 평점', 'Leader rating', 'リーダー評価')}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={rating === value ? 'is-active' : ''}
                onClick={() => setRating(value)}
                title={ratingLabels[value]}
                aria-label={`${value} - ${ratingLabels[value]}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="renew-leader-rating-scale" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((value) => (
              <span key={value}>{ratingLabels[value]}</span>
            ))}
          </div>
          <textarea
            value={content}
            maxLength={800}
            onChange={(event) => setContent(event.target.value)}
            placeholder={getLocaleText(uiLang, '운영 난이도와 장단점을 남겨주세요.', 'Share its difficulty, strengths, and weaknesses.', '難易度や長所・短所を共有してください。')}
            disabled={!authUser}
          />
          <div>
            {authUser ? (
              <>
                {myReview ? (
                  <button type="button" className="renew-secondary-button" onClick={removeReview} disabled={saving}>
                    {getLocaleText(uiLang, '내 평가 삭제', 'Delete my review', '自分の評価を削除')}
                  </button>
                ) : <span />}
                <button type="button" className="renew-primary-button" onClick={submitReview} disabled={saving}>
                  {saving
                    ? getLocaleText(uiLang, '저장 중', 'Saving', '保存中')
                    : myReview
                      ? getLocaleText(uiLang, '평가 수정', 'Update review', '評価を更新')
                      : getLocaleText(uiLang, '평가 저장', 'Save review', '評価を保存')}
                </button>
              </>
            ) : (
              <button type="button" className="renew-primary-button" onClick={onRequireLogin}>
                {getLocaleText(uiLang, '로그인 후 평가하기', 'Sign in to review', 'ログインして評価')}
              </button>
            )}
          </div>
          {notice ? <p role="status">{notice}</p> : null}
        </div>
        <div className="renew-leader-review-list">
          <h3>{getLocaleText(uiLang, '리더 평가', 'Leader reviews', 'リーダー評価')}</h3>
          {loading ? <p>{getLocaleText(uiLang, '불러오는 중', 'Loading', '読み込み中')}</p> : null}
          {!loading && !(overview?.reviews || []).length ? (
            <p>{getLocaleText(uiLang, '아직 등록된 평가가 없습니다.', 'No reviews yet.', 'まだ評価がありません。')}</p>
          ) : null}
          {(overview?.reviews || []).map((item) => (
            <article key={item.id}>
              <div><strong>{item.nickname}</strong><b>{item.rating} / 5</b></div>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      </section>
    </div>,
    document.body
  );
}

function RenewDeckLabHomeV2({ uiLang, authUser, onOpenBuilder, onOpenGuide, onRequireLogin }) {
  const [region, setRegion] = useState('KR');
  const [keyword, setKeyword] = useState('');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popular, setPopular] = useState([]);
  const [referenceData, setReferenceData] = useState(null);
  const [insightCard, setInsightCard] = useState(null);
  const [leaderLimit, setLeaderLimit] = useState(30);
  const [templateLoadingId, setTemplateLoadingId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCards({ locale: region, rarity: 'L' }),
      fetchPopularDeckLeaders(region).catch(() => ({ items: [] })),
      fetchDeckLabReference(region).catch(() => null)
    ]).then(([cards, popularPayload, referencePayload]) => {
      if (cancelled) return;
      const canonical = new Map();
      (Array.isArray(cards) ? cards : []).forEach((card) => {
        if (!isDeckLeaderCard(card)) return;
        const cardNo = getDeckCardNo(card);
        if (!cardNo) return;
        const current = canonical.get(cardNo);
        if (!current || /_p\d+$/i.test(String(current.cardNo || current.id || ''))) canonical.set(cardNo, card);
      });
      setLeaders([...canonical.values()].sort((a, b) => getDeckCardNo(a).localeCompare(getDeckCardNo(b))));
      setPopular(popularPayload?.items || []);
      setReferenceData(referencePayload?.configured === false ? null : referencePayload);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [region]);

  useEffect(() => {
    setLeaderLimit(30);
  }, [region, keyword]);

  const popularMap = useMemo(
    () => new Map(popular.map((item) => [String(item.cardNo), Number(item.count || 0)])),
    [popular]
  );
  const referenceLeadersById = useMemo(
    () => new Map((referenceData?.leaders || []).map((item) => [String(item.id), item])),
    [referenceData]
  );
  const referenceArchetypesById = useMemo(
    () => new Map((referenceData?.archetypes || []).map((item) => [String(item.id), item])),
    [referenceData]
  );
  const leaderCardsByNo = useMemo(
    () => new Map(leaders.map((card) => [normalizeDeckSearchText(getDeckCardNo(card)), card])),
    [leaders]
  );
  const publishedTemplates = useMemo(() => (
    (referenceData?.templates || [])
      .filter((template) => template.current_version_id)
      .map((template) => {
        const archetype = referenceArchetypesById.get(String(template.archetype_id));
        const referenceLeader = referenceLeadersById.get(String(archetype?.leader_id));
        const leaderCard = leaderCardsByNo.get(normalizeDeckSearchText(referenceLeader?.card_no));
        return { template, archetype, referenceLeader, leaderCard };
      })
      .filter((item) => item.archetype && item.referenceLeader && item.leaderCard)
  ), [referenceData, referenceArchetypesById, referenceLeadersById, leaderCardsByNo]);
  const templateCountByLeader = useMemo(() => {
    const counts = new Map();
    (referenceData?.templates || []).forEach((template) => {
      if (!template.current_version_id) return;
      const archetype = referenceArchetypesById.get(String(template.archetype_id));
      const leader = referenceLeadersById.get(String(archetype?.leader_id));
      const cardNo = normalizeDeckSearchText(leader?.card_no);
      if (cardNo) counts.set(cardNo, Number(counts.get(cardNo) || 0) + 1);
    });
    return counts;
  }, [referenceData, referenceArchetypesById, referenceLeadersById]);
  const visibleLeaders = useMemo(() => {
    const query = normalizeDeckSearchText(keyword);
    const filtered = query
      ? leaders.filter((card) => [card.name, card.nameEn, card.cardNo, card.baseCardNo]
        .some((value) => normalizeDeckSearchText(value).includes(query)))
      : leaders;
    return [...filtered].sort((a, b) => {
      const usageDelta = Number(popularMap.get(getDeckCardNo(b)) || 0) - Number(popularMap.get(getDeckCardNo(a)) || 0);
      return usageDelta || getDeckCardNo(a).localeCompare(getDeckCardNo(b));
    });
  }, [leaders, keyword, popularMap]);

  function startWithLeader(card) {
    if (authUser) recordLeaderSelection(region, getDeckCardNo(card)).catch(() => {});
    onOpenBuilder(card);
  }

  function startWithTemplate(item) {
    if (!item?.leaderCard || !item?.template) return;
    setTemplateLoadingId(String(item.template.id));
    if (authUser) recordLeaderSelection(region, getDeckCardNo(item.leaderCard)).catch(() => {});
    onOpenBuilder(item.leaderCard, item.template);
  }

  return (
    <main className="renew-subpage renew-deck-lab">
      <section className="renew-deck-lab-head is-controls-only">
        <div className="renew-deck-region-tabs" aria-label={getLocaleText(uiLang, '카드 환경', 'Card environment', 'カード環境')}>
          {['KR', 'JP', 'EN'].map((item) => (
            <button key={item} type="button" className={region === item ? 'is-active' : ''} onClick={() => {
              setRegion(item);
              setKeyword('');
            }}>{item}</button>
          ))}
        </div>
        <button type="button" className="renew-profit-primary-button" onClick={onOpenGuide}>
          {getLocaleText(uiLang, '사용 가이드', 'User guide', '利用ガイド')}
        </button>
      </section>
      {publishedTemplates.length ? (
        <section className="renew-deck-prebuilt">
          <header>
            <div>
              <small>READY DECKS</small>
              <h2>{getLocaleText(uiLang, '검증된 입상 덱', 'Verified tournament decks', '検証済み大会デッキ')}</h2>
            </div>
            <span>{publishedTemplates.length}</span>
          </header>
          <div className="renew-deck-prebuilt-grid">
            {publishedTemplates.map((item) => (
              <button
                key={item.template.id}
                type="button"
                onClick={() => startWithTemplate(item)}
                disabled={Boolean(templateLoadingId)}
              >
                <img src={getCardImageSrc(item.leaderCard)} alt="" onError={placeholderImage} />
                <span>
                  <b>{item.referenceLeader.card_no} · {(item.referenceLeader.colors || []).join('/')}</b>
                  <strong>{item.archetype.nickname}</strong>
                  <small>{item.template.title}</small>
                </span>
                <em>{templateLoadingId === String(item.template.id)
                  ? getLocaleText(uiLang, '불러오는 중', 'Loading', '読み込み中')
                  : getLocaleText(uiLang, '불러오기', 'Load deck', '読み込む')}</em>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="renew-deck-first-step">
        <div>
          <small>STEP 1</small>
          <h2>{getLocaleText(uiLang, '사용할 리더를 먼저 선택하세요', 'Choose a leader first', '最初にリーダーを選択')}</h2>
        </div>
        <div className="renew-deck-leader-filter">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={getLocaleText(uiLang, '리더 이름 또는 카드번호', 'Leader name or card number', 'リーダー名またはカード番号')}
          />
        </div>
      </section>
      {popular.length ? (
        <section className="renew-deck-popular-strip">
          <strong>{getLocaleText(uiLang, '많이 선택한 리더', 'Popular selections', '人気の選択')}</strong>
          <div>
            {popular.slice(0, 6).map((item) => (
              <button key={item.cardNo} type="button" onClick={() => setKeyword(item.cardNo)}>
                <span>{item.cardNo}</span><b>{item.count}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="renew-deck-reference">
        {loading ? <p className="renew-deck-empty">{getLocaleText(uiLang, '리더를 불러오는 중입니다.', 'Loading leaders.', 'リーダーを読み込み中です。')}</p> : null}
        {!loading && !visibleLeaders.length ? (
          <p className="renew-deck-empty">{getLocaleText(uiLang, '검색된 리더가 없습니다.', 'No leaders found.', 'リーダーが見つかりません。')}</p>
        ) : null}
        <div className="renew-deck-leader-grid renew-deck-leader-catalog">
          {visibleLeaders.slice(0, leaderLimit).map((card) => {
            const cardNo = getDeckCardNo(card);
            const templateCount = Number(templateCountByLeader.get(normalizeDeckSearchText(cardNo)) || 0);
            return (
              <article key={card.id}>
                <img src={getCardImageSrc(card)} alt={card.name} onError={placeholderImage} />
                <div>
                  <b>{cardNo}</b>
                  <strong>{card.name}</strong>
                  <small>
                    {card.colorKo || card.color}
                    {templateCount ? ` · ${getLocaleText(uiLang, '추천 덱', 'Verified decks', '推奨デッキ')} ${templateCount}` : ''}
                  </small>
                </div>
                <div className="renew-deck-leader-actions">
                  <button type="button" className="renew-secondary-button" onClick={() => setInsightCard(card)}>
                    {getLocaleText(uiLang, '평가 · 정보', 'Reviews', '評価・情報')}
                  </button>
                  <button type="button" className="renew-primary-button" onClick={() => startWithLeader(card)}>
                    {getLocaleText(uiLang, '이 리더로 시작', 'Start', 'このリーダーで開始')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {visibleLeaders.length > leaderLimit ? (
          <button type="button" className="renew-deck-load-more" onClick={() => setLeaderLimit((current) => current + 30)}>
            {getLocaleText(uiLang, '리더 더 보기', 'Load more leaders', 'リーダーをさらに表示')}
          </button>
        ) : null}
      </section>
      {insightCard ? (
        <RenewLeaderInsightsModal
          card={insightCard}
          region={region}
          authUser={authUser}
          uiLang={uiLang}
          onClose={() => setInsightCard(null)}
          onRequireLogin={onRequireLogin}
        />
      ) : null}
    </main>
  );
}

function RenewDeck({ authUser, userState, setUserState, stateLoading, uiLang, initialLeader, initialTemplate, onOpenGuide }) {
  const t = (key) => getUiText(uiLang, key);
  const [guestDeckState, setGuestDeckState] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem('card-pone-guest-deck-v1') || '{}');
    } catch {
      return {};
    }
  });
  const deckState = authUser ? (userState || {}) : guestDeckState;
  const storedEntries = Array.isArray(deckState?.deckEntries) ? deckState.deckEntries : [];
  const storedLeaderId = String(deckState?.leaderCardId || '');
  const storedLocale = String(storedLeaderId || storedEntries[0]?.id || '').split('::')[0];
  const [environment, setEnvironment] = useState(['KR', 'JP', 'EN'].includes(storedLocale) ? storedLocale : 'KR');
  const [cardCache, setCardCache] = useState({});
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [deckReferenceData, setDeckReferenceData] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [cardPage, setCardPage] = useState(1);
  const [hasMoreCards, setHasMoreCards] = useState(false);
  const deckSaveQueue = useRef(Promise.resolve());
  const initialLeaderAppliedRef = useRef('');
  const storedEntryKey = storedEntries.map((entry) => `${entry?.id}:${entry?.count}`).join('|');
  const entries = storedEntries
    .map((entry) => ({ card: cardCache[String(entry?.id)], count: Number(entry?.count || 0) }))
    .filter((entry) => entry.card && entry.count > 0);
  const leader = cardCache[storedLeaderId] || null;
  const deckDataLoading = Boolean((authUser && stateLoading)
    || (storedLeaderId && !leader)
    || storedEntries.some((entry) => entry?.id && !cardCache[String(entry.id)]));
  const deckEntries = Object.fromEntries(entries.map((entry) => [String(entry.card.id), entry]));
  const deckBuilder = { environment, leader, entries: deckEntries };
  const totalCards = entries.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  const countsByCardNo = entries.reduce((counts, entry) => {
    const cardNo = getDeckCardNo(entry.card);
    counts[cardNo] = Number(counts[cardNo] || 0) + Number(entry.count || 0);
    return counts;
  }, {});
  const invalidColorEntries = deckBuilder.leader
    ? entries.filter((entry) => !isDeckColorLegal(entry.card, deckBuilder.leader))
    : [];
  const activeEnvironment = (deckReferenceData?.environments || [])
    .find((item) => item.format === 'STANDARD')
    || (deckReferenceData?.environments || [])[0]
    || null;
  const activeLegalityRules = useMemo(() => {
    if (!activeEnvironment?.id) return new Map();
    const today = new Date().toISOString().slice(0, 10);
    const rules = (deckReferenceData?.legalityRules || []).filter((rule) => (
      String(rule.environment_id) === String(activeEnvironment.id)
      && String(rule.effective_from || '') <= today
      && (!rule.effective_to || String(rule.effective_to) >= today)
    ));
    return new Map(rules.map((rule) => [
      String(rule.card_no || '').replace(/_p\d+$/i, ''),
      rule
    ]));
  }, [activeEnvironment?.id, deckReferenceData?.legalityRules]);
  const invalidLegalityEntries = entries.filter((entry) => {
    const rule = activeLegalityRules.get(getDeckCardNo(entry.card));
    return rule && Number(entry.count || 0) > Number(rule.max_copies ?? 4);
  });
  const categoryCounts = entries.reduce((counts, entry) => {
    const category = String(entry.card.category || entry.card.categoryKo || 'OTHER').toUpperCase();
    const key = category.includes('CHARACTER') || category.includes('캐릭터') ? 'character'
      : category.includes('EVENT') || category.includes('이벤트') ? 'event'
        : category.includes('STAGE') || category.includes('스테이지') ? 'stage'
          : 'other';
    counts[key] += Number(entry.count || 0);
    return counts;
  }, { character: 0, event: 0, stage: 0, other: 0 });
  const counterCounts = entries.reduce((counts, entry) => {
    const counter = Number(String(entry.card.counter || '').replace(/[^\d]/g, '')) || 0;
    const count = Number(entry.count || 0);
    if (counter >= 2000) counts.counter2000 += count;
    else if (counter >= 1000) counts.counter1000 += count;
    else counts.noCounter += count;
    return counts;
  }, { counter1000: 0, counter2000: 0, noCounter: 0 });

  useEffect(() => {
    const inferredLocale = String(storedLeaderId || storedEntries[0]?.id || '').split('::')[0];
    if (['KR', 'JP', 'EN'].includes(inferredLocale)) setEnvironment(inferredLocale);
  }, [storedLeaderId, storedEntryKey]);

  useEffect(() => {
    let cancelled = false;
    fetchDeckLabReference(environment)
      .then((payload) => {
        if (!cancelled) setDeckReferenceData(payload?.configured === false ? null : payload);
      })
      .catch(() => {
        if (!cancelled) setDeckReferenceData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [environment]);

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set([storedLeaderId, ...storedEntries.map((entry) => String(entry?.id || ''))].filter(Boolean))]
      .filter((id) => !cardCache[id]);
    if (!ids.length) return undefined;
    Promise.all(ids.map((id) => fetchCardById(id)))
      .then((cards) => {
        if (cancelled) return;
        setCardCache((current) => ({
          ...current,
          ...Object.fromEntries(cards.filter(Boolean).map((card) => [String(card.id), compactDeckCard(card)]))
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storedLeaderId, storedEntryKey]);

  async function persistDeck(nextLeader, nextEntries) {
    const serializedEntries = Object.values(nextEntries)
      .filter((entry) => entry?.card?.id && Number(entry.count) > 0)
      .map((entry) => ({ id: String(entry.card.id), count: Number(entry.count) }));
    const nextState = {
      ...(deckState || {}),
      leaderCardId: nextLeader?.id || null,
      deckEntries: serializedEntries
    };
    if (!authUser) {
      setGuestDeckState(nextState);
      window.localStorage.setItem('card-pone-guest-deck-v1', JSON.stringify(nextState));
      setSaveStatus(getLocaleText(uiLang, '이 기기에 저장됨', 'Saved on this device', 'この端末に保存済み'));
      return;
    }
    setUserState(nextState);
    setSaveStatus(getLocaleText(uiLang, '저장 중', 'Saving', '保存中'));
    try {
      deckSaveQueue.current = deckSaveQueue.current
        .catch(() => {})
        .then(() => saveMyState({ ...nextState, __changedFields: ['leaderCardId', 'deckEntries'] }));
      await deckSaveQueue.current;
      setSaveStatus(getLocaleText(uiLang, '저장됨', 'Saved', '保存済み'));
    } catch {
      setSaveStatus(getLocaleText(uiLang, '저장 실패', 'Save failed', '保存失敗'));
    }
  }

  useEffect(() => {
    const initialLeaderId = String(initialLeader?.id || '');
    const initialSelectionKey = `${initialLeaderId}:${initialTemplate?.id || ''}`;
    if (!initialLeaderId || initialLeaderAppliedRef.current === initialSelectionKey || (authUser && stateLoading)) return;
    const compactLeader = compactDeckCard(initialLeader);
    const initialRegion = initialLeaderId.split('::')[0];
    initialLeaderAppliedRef.current = initialSelectionKey;
    if (['KR', 'JP', 'EN'].includes(initialRegion)) setEnvironment(initialRegion);
    setCardCache((current) => ({ ...current, [initialLeaderId]: compactLeader }));
    setKeyword('');
    setResults([]);
    setNotice('');
    if (initialTemplate?.current_version_id) loadVerifiedTemplate(initialTemplate, compactLeader);
    else persistDeck(compactLeader, {});
  }, [initialLeader?.id, initialTemplate?.id, stateLoading, authUser]);

  async function loadLegalCards({ page = 1, append = false, query = '' } = {}) {
    if (!deckBuilder.leader) {
      setResults([]);
      setHasMoreCards(false);
      return;
    }
    setSearching(true);
    setNotice('');
    try {
      const found = await fetchCards({
        locale: deckBuilder.environment,
        color: getDeckCardColors(deckBuilder.leader).join(','),
        excludeCategory: 'LEADER',
        q: query.trim(),
        limit: 48,
        page
      });
      const legalCards = (Array.isArray(found) ? found : [])
        .filter((card) => !isDeckLeaderCard(card) && isDeckColorLegal(card, deckBuilder.leader));
      setResults((current) => append ? [...current, ...legalCards] : legalCards);
      setCardPage(page);
      setHasMoreCards(legalCards.length === 48);
      setCardCache((current) => ({
        ...current,
        ...Object.fromEntries(legalCards.map((card) => [String(card.id), compactDeckCard(card)]))
      }));
    } catch {
      if (!append) setResults([]);
      setNotice(getLocaleText(uiLang, '사용 가능한 카드를 불러오지 못했습니다.', 'Unable to load legal cards.', '使用可能なカードを読み込めませんでした。'));
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    setKeyword('');
    setRoleFilter('all');
    if (deckBuilder.leader) loadLegalCards({ page: 1 });
    else {
      setResults([]);
      setHasMoreCards(false);
    }
  }, [deckBuilder.leader?.id, deckBuilder.environment]);

  async function runSearch() {
    const q = keyword.trim();
    if (!q) return;
    setSearching(true);
    setNotice('');
    try {
      const found = deckBuilder.leader
        ? await fetchCards({
          locale: deckBuilder.environment,
          color: getDeckCardColors(deckBuilder.leader).join(','),
          excludeCategory: 'LEADER',
          q,
          limit: 48,
          page: 1
        })
        : await searchCards(q, deckBuilder.environment);
      const nextResults = (Array.isArray(found) ? found : [])
        .filter((card) => deckBuilder.leader
          ? (!isDeckLeaderCard(card) && isDeckColorLegal(card, deckBuilder.leader))
          : isDeckLeaderCard(card))
        .slice(0, 48);
      setResults(nextResults);
      setCardPage(1);
      setHasMoreCards(Boolean(deckBuilder.leader && nextResults.length === 48));
      setCardCache((current) => ({
        ...current,
        ...Object.fromEntries(nextResults.map((card) => [String(card.id), compactDeckCard(card)]))
      }));
    } catch {
      setResults([]);
      setNotice(getLocaleText(uiLang, '카드를 불러오지 못했습니다.', 'Unable to load cards.', 'カードを読み込めませんでした。'));
    } finally {
      setSearching(false);
    }
  }

  function changeEnvironment(environment) {
    if (environment === deckBuilder.environment) return;
    if (deckDataLoading) return;
    if ((deckBuilder.leader || entries.length) && !window.confirm(getLocaleText(
      uiLang,
      '환경을 변경하면 현재 덱이 초기화됩니다.',
      'Changing the environment will clear the current deck.',
      '環境を変更すると現在のデッキが初期化されます。'
    ))) return;
    setEnvironment(environment);
    setKeyword('');
    setResults([]);
    persistDeck(null, {});
  }

  function setLeader(card) {
    if (deckDataLoading) return;
    const compactCard = compactDeckCard(card);
    setCardCache((current) => ({ ...current, [String(card.id)]: compactCard }));
    setNotice('');
    setKeyword('');
    persistDeck(compactCard, deckBuilder.entries);
    if (authUser) recordLeaderSelection(deckBuilder.environment, getDeckCardNo(compactCard)).catch(() => {});
  }

  function updateDeckCard(card, delta) {
    if (deckDataLoading) return;
    if (isDeckLeaderCard(card)) {
      setNotice(getLocaleText(uiLang, '리더 카드는 리더 슬롯에 설정해 주세요.', 'Set leader cards in the leader slot.', 'リーダーカードはリーダー枠に設定してください。'));
      return;
    }
    const cardId = String(card.id);
    const currentEntry = deckBuilder.entries[cardId];
    const current = Number(currentEntry?.count || 0);
    const canonicalCardNo = getDeckCardNo(card);
    const canonicalCount = Number(countsByCardNo[canonicalCardNo] || 0);
    const legalityRule = activeLegalityRules.get(canonicalCardNo);
    const maxCopies = Number(legalityRule?.max_copies ?? 4);
    if (delta > 0 && totalCards >= 50) {
      setNotice(getLocaleText(uiLang, '메인 덱은 50장을 넘을 수 없습니다.', 'The main deck cannot exceed 50 cards.', 'メインデッキは50枚を超えられません。'));
      return;
    }
    if (delta > 0 && canonicalCount >= maxCopies) {
      setNotice(maxCopies === 0
        ? getLocaleText(uiLang, '현재 환경에서 사용할 수 없는 카드입니다.', 'This card is banned in the selected environment.', '現在の環境では使用できないカードです。')
        : getLocaleText(
          uiLang,
          `현재 환경에서는 같은 카드번호를 최대 ${maxCopies}장 사용할 수 있습니다.`,
          `This environment allows up to ${maxCopies} copies of this card number.`,
          `現在の環境では同じカード番号を最大${maxCopies}枚使用できます。`
        ));
      return;
    }
    const nextCount = Math.max(0, current + delta);
    const nextEntries = { ...deckBuilder.entries };
    if (!nextCount) delete nextEntries[cardId];
    else {
      const compactCard = compactDeckCard(card);
      nextEntries[cardId] = { card: compactCard, count: nextCount };
      setCardCache((currentCache) => ({ ...currentCache, [cardId]: compactCard }));
    }
    setNotice('');
    persistDeck(deckBuilder.leader, nextEntries);
  }

  function clearDeck() {
    if (!deckBuilder.leader && !entries.length) return;
    if (!window.confirm(getLocaleText(uiLang, '현재 덱을 모두 비울까요?', 'Clear the current deck?', '現在のデッキをすべて削除しますか？'))) return;
    setResults([]);
    setNotice('');
    persistDeck(null, {});
  }

  const verifiedTemplates = useMemo(() => {
    if (!deckBuilder.leader || !deckReferenceData) return [];
    const canonicalLeaderNo = normalizeDeckSearchText(getDeckCardNo(deckBuilder.leader));
    const referenceLeaderIds = new Set((deckReferenceData.leaders || [])
      .filter((item) => normalizeDeckSearchText(item.card_no) === canonicalLeaderNo)
      .map((item) => String(item.id)));
    const archetypeIds = new Set((deckReferenceData.archetypes || [])
      .filter((item) => referenceLeaderIds.has(String(item.leader_id)))
      .map((item) => String(item.id)));
    return (deckReferenceData.templates || []).filter((item) => (
      archetypeIds.has(String(item.archetype_id)) && item.current_version_id
    ));
  }, [deckBuilder.leader?.id, deckReferenceData]);

  async function loadVerifiedTemplate(template, leaderOverride = deckBuilder.leader) {
    if (!template?.current_version_id || !leaderOverride) return;
    setSearching(true);
    setNotice('');
    try {
      const payload = await fetchDeckTemplateVersion(template.current_version_id);
      const versionCards = payload?.item?.cards || [];
      const cards = await Promise.all(versionCards.map((item) => fetchCardById(item.card_id)));
      const nextEntries = {};
      cards.forEach((card, index) => {
        if (!card) return;
        if (isDeckLeaderCard(card) || !isDeckColorLegal(card, leaderOverride)) return;
        const compactCard = compactDeckCard(card);
        const count = Number(versionCards[index]?.quantity || 0);
        if (count > 0) nextEntries[String(compactCard.id)] = { card: compactCard, count };
      });
      setCardCache((current) => ({
        ...current,
        ...Object.fromEntries(Object.values(nextEntries).map((entry) => [String(entry.card.id), entry.card]))
      }));
      await persistDeck(leaderOverride, nextEntries);
      setNotice(getLocaleText(uiLang, '검증된 덱 구성을 불러왔습니다.', 'Verified deck loaded.', '検証済みデッキを読み込みました。'));
    } catch {
      setNotice(getLocaleText(uiLang, '추천 덱을 불러오지 못했습니다.', 'Unable to load the recommended deck.', '推奨デッキを読み込めませんでした。'));
    } finally {
      setSearching(false);
    }
  }

  const roleFilteredResults = results.filter((card) => {
    if (roleFilter === 'all') return true;
    const effect = normalizeDeckSearchText(card.effect);
    const category = normalizeDeckSearchText([card.category, card.categoryKo].join(' '));
    const counter = Number(String(card.counter || '').replace(/[^\d]/g, '')) || 0;
    const cost = Number(String(card.cost || '').replace(/[^\d]/g, '')) || 0;
    if (roleFilter === 'counter2000') return counter >= 2000;
    if (roleFilter === 'blocker') return /blocker|블로커|ブロッカー/.test(effect);
    if (roleFilter === 'search') return /덱위|decktop|デッキの上/.test(effect) && /패|hand|手札/.test(effect);
    if (roleFilter === 'finisher') return cost >= 7;
    if (roleFilter === 'event') return /event|이벤트|イベント/.test(category);
    return true;
  });

  const ruleRows = [
    {
      label: getLocaleText(uiLang, '리더 카드 1장', 'One leader card', 'リーダーカード1枚'),
      valid: Boolean(deckBuilder.leader)
    },
    {
      label: getLocaleText(uiLang, '메인 덱 50장', '50-card main deck', 'メインデッキ50枚'),
      valid: totalCards === 50
    },
    {
      label: getLocaleText(uiLang, '같은 카드번호 최대 4장', 'Up to four copies per card number', '同じカード番号は4枚まで'),
      valid: Object.values(countsByCardNo).every((count) => count <= 4)
    },
    {
      label: getLocaleText(uiLang, '리더와 카드 색상 일치', 'Leader and card colors match', 'リーダーとカードの色が一致'),
      valid: Boolean(deckBuilder.leader) && invalidColorEntries.length === 0
    },
    {
      label: getLocaleText(uiLang, '금지·제한 카드 규칙', 'Banned and restricted cards', '禁止・制限カード'),
      valid: invalidLegalityEntries.length === 0
    }
  ];

  return (
    <main className="renew-subpage renew-deck-builder-page">
        <section className="renew-deck-builder-head">
          <div>
            <span>DECK BUILDER</span>
          </div>
          <div className="renew-deck-builder-tools">
            <div className="renew-deck-environment" aria-label={getLocaleText(uiLang, '카드 환경', 'Card environment', 'カード環境')}>
              {['KR', 'JP', 'EN'].map((environment) => (
                <button
                  key={environment}
                  type="button"
                  className={deckBuilder.environment === environment ? 'is-active' : ''}
                  onClick={() => changeEnvironment(environment)}
                >
                  {environment}
                </button>
              ))}
            </div>
            <button type="button" className="renew-profit-primary-button" onClick={onOpenGuide}>
              {getLocaleText(uiLang, '사용 가이드', 'User guide', '利用ガイド')}
            </button>
          </div>
        </section>

        <section className="renew-deck-workspace">
          <div className="renew-deck-editor">
            <section className="renew-deck-leader-slot">
              <div>
                <small>{getLocaleText(uiLang, 'LEADER', 'LEADER', 'LEADER')}</small>
                {deckBuilder.leader ? (
                  <>
                    <strong>{deckBuilder.leader.name}</strong>
                    <span>{getDeckCardNo(deckBuilder.leader)} · {deckBuilder.leader.colorKo || deckBuilder.leader.color}</span>
                  </>
                ) : (
                  <strong>{getLocaleText(uiLang, '먼저 리더를 검색해 설정하세요', 'Choose a leader first', '最初にリーダーを選択')}</strong>
                )}
              </div>
              {deckBuilder.leader ? <img src={deckBuilder.leader.imageUrl} alt={deckBuilder.leader.name} onError={placeholderImage} /> : null}
            </section>

            <div className="renew-market-search renew-deck-search">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
                placeholder={deckBuilder.leader
                  ? getLocaleText(uiLang, '이 리더가 사용할 수 있는 카드 검색', 'Search legal cards for this leader', 'このリーダーが使えるカードを検索')
                  : getLocaleText(uiLang, '리더 이름 또는 카드번호 검색', 'Search leader name or card number', 'リーダー名またはカード番号を検索')}
              />
              <button type="button" onClick={runSearch} disabled={searching}>
                {searching ? getLocaleText(uiLang, '검색 중', 'Searching', '検索中') : t('search')}
              </button>
            </div>
            {notice ? <p className="renew-deck-notice" role="status">{notice}</p> : null}

            {deckBuilder.leader && verifiedTemplates.length ? (
              <div className="renew-deck-template-actions">
                <strong>{getLocaleText(uiLang, '검증된 덱에서 시작', 'Start from a verified deck', '検証済みデッキから開始')}</strong>
                <div>
                  {verifiedTemplates.map((template) => (
                    <button key={template.id} type="button" onClick={() => loadVerifiedTemplate(template)}>
                      {template.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {deckBuilder.leader ? (
              <div className="renew-deck-role-filters" aria-label={getLocaleText(uiLang, '카드 역할 필터', 'Card role filters', 'カード役割フィルター')}>
                {[
                  ['all', getLocaleText(uiLang, '전체', 'All', 'すべて')],
                  ['counter2000', 'Counter 2000'],
                  ['blocker', getLocaleText(uiLang, '블로커', 'Blocker', 'ブロッカー')],
                  ['search', getLocaleText(uiLang, '서치', 'Search', 'サーチ')],
                  ['finisher', getLocaleText(uiLang, '고코스트', 'High cost', '高コスト')],
                  ['event', getLocaleText(uiLang, '이벤트', 'Event', 'イベント')]
                ].map(([key, label]) => (
                  <button key={key} type="button" className={roleFilter === key ? 'is-active' : ''} onClick={() => setRoleFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="renew-deck-search-results">
              {roleFilteredResults.map((card) => {
                const leaderCard = isDeckLeaderCard(card);
                const entry = deckBuilder.entries[String(card.id)];
                return (
                  <article key={card.id}>
                    <img src={getCardImageSrc(card)} alt={card.name} onError={placeholderImage} />
                    <div>
                      <b>{getDeckCardNo(card)}</b>
                      <strong>{card.name}</strong>
                      <small>{card.categoryKo || card.category} · {card.colorKo || card.color}</small>
                    </div>
                    {leaderCard ? (
                      <button type="button" className="renew-deck-set-leader" onClick={() => setLeader(card)}>
                        {getLocaleText(uiLang, '리더 설정', 'Set leader', 'リーダー設定')}
                      </button>
                    ) : (
                      <div className="renew-stepper">
                        <button type="button" onClick={() => updateDeckCard(card, -1)} disabled={!entry?.count}>-</button>
                        <span>{entry?.count || 0}</span>
                        <button type="button" onClick={() => updateDeckCard(card, 1)}>+</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {deckBuilder.leader && hasMoreCards && roleFilter === 'all' ? (
              <button
                type="button"
                className="renew-deck-load-more"
                onClick={() => loadLegalCards({ page: cardPage + 1, append: true, query: keyword })}
                disabled={searching}
              >
                {getLocaleText(uiLang, '사용 가능한 카드 더 보기', 'Load more legal cards', '使用可能なカードをさらに表示')}
              </button>
            ) : null}
          </div>

          <aside className="renew-deck-sidebar">
            <section className="renew-deck-rule-panel">
              <div className="renew-deck-panel-title">
                <strong>{getLocaleText(uiLang, '규칙 검사', 'Rule check', 'ルールチェック')}</strong>
                <span>{deckDataLoading ? getLocaleText(uiLang, '덱 불러오는 중', 'Loading deck', 'デッキ読込中') : saveStatus}</span>
              </div>
              {ruleRows.map((rule) => (
                <div key={rule.label} className={rule.valid ? 'is-valid' : 'is-invalid'}>
                  <span aria-hidden="true">{rule.valid ? '✓' : '!'}</span>
                  <b>{rule.label}</b>
                </div>
              ))}
              {invalidColorEntries.length ? (
                <p>{getLocaleText(uiLang, `색상 불일치 ${invalidColorEntries.length}종`, `${invalidColorEntries.length} color mismatch(es)`, `色の不一致 ${invalidColorEntries.length}種`)}</p>
              ) : null}
            </section>

            <section className="renew-deck-stats">
              <div><span>{getLocaleText(uiLang, '메인 덱', 'Main deck', 'メインデッキ')}</span><strong>{totalCards} / 50</strong></div>
              <div><span>{getLocaleText(uiLang, '캐릭터', 'Characters', 'キャラクター')}</span><strong>{categoryCounts.character}</strong></div>
              <div><span>{getLocaleText(uiLang, '이벤트', 'Events', 'イベント')}</span><strong>{categoryCounts.event}</strong></div>
              <div><span>{getLocaleText(uiLang, '스테이지', 'Stages', 'ステージ')}</span><strong>{categoryCounts.stage}</strong></div>
              <div><span>Counter 2000</span><strong>{counterCounts.counter2000}</strong></div>
              <div><span>Counter 1000</span><strong>{counterCounts.counter1000}</strong></div>
              <div><span>{getLocaleText(uiLang, '카운터 없음', 'No counter', 'カウンターなし')}</span><strong>{counterCounts.noCounter}</strong></div>
            </section>
          </aside>
        </section>

        <section className="renew-deck-list-panel">
          <div className="renew-deck-panel-title">
            <strong>{getLocaleText(uiLang, '현재 덱', 'Current deck', '現在のデッキ')}</strong>
            <button type="button" onClick={clearDeck}>{getLocaleText(uiLang, '전체 비우기', 'Clear all', 'すべて削除')}</button>
          </div>
          {entries.length ? (
            <div className="renew-deck-card-list">
              {entries.map((entry) => (
                <article key={entry.card.id} className={!isDeckColorLegal(entry.card, deckBuilder.leader) ? 'is-invalid' : ''}>
                  <img src={entry.card.imageUrl} alt={entry.card.name} onError={placeholderImage} />
                  <div>
                    <b>{getDeckCardNo(entry.card)}</b>
                    <strong>{entry.card.name}</strong>
                    <small>{entry.card.cost ? `Cost ${entry.card.cost} · ` : ''}{entry.card.colorKo || entry.card.color}</small>
                  </div>
                  <div className="renew-stepper">
                    <button type="button" onClick={() => updateDeckCard(entry.card, -1)}>-</button>
                    <span>{entry.count}</span>
                    <button type="button" onClick={() => updateDeckCard(entry.card, 1)}>+</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="renew-deck-empty">{getLocaleText(uiLang, '검색 결과에서 카드를 추가하면 이곳에 덱이 구성됩니다.', 'Add cards from search results to build the deck here.', '検索結果からカードを追加すると、ここにデッキが表示されます。')}</p>
          )}
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

function getAdminPageLabel(path = '/') {
  const isJapanese = path === '/jp' || path.startsWith('/jp/');
  const appPath = isJapanese ? path.slice(3) || '/' : path;
  const labels = {
    '/': '홈',
    '/cards': '카드 도감',
    '/prices': '시세',
    '/prices/card': '카드 시세 상세',
    '/prices/product': '스니덩크 상품 상세',
    '/prices/box': '박스 시세 상세',
    '/lab': '실험실',
    '/lab/centering': '센터링 측정기',
    '/lab/pack-simulator': '카드깡 시뮬레이터',
    '/lab/decks': '덱 빌더',
    '/lab/decks/builder': '덱 편집기',
    '/tools/portfolio-calculator': '포트폴리오 계산기',
    '/news': '정보',
    '/calendar': '캘린더',
    '/shops': '구매처',
    '/shops/partners': '제휴 카드샵',
    '/shops/detail': '구매처 상세',
    '/about': '서비스 소개'
  };
  const label = labels[appPath] || appPath;
  return isJapanese ? `${label} (JP)` : label;
}

function RenewAdminAnalytics({ authUser, onlineVisitors = 0, onlinePageCounts = {} }) {
  const isAdmin = authUser?.app_metadata?.role === 'admin';
  const [periodDays, setPeriodDays] = useState(7);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    const loadStats = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await fetchAdminStats('admin', periodDays);
        if (!cancelled) setStats(payload || null);
      } catch {
        if (!cancelled) setError('통계 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadStats();
    const timer = window.setInterval(loadStats, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAdmin, periodDays]);

  if (!isAdmin) {
    return (
      <main className="renew-subpage renew-admin-analytics">
        <section className="renew-admin-analytics-empty">
          <strong>관리자 전용 페이지입니다.</strong>
          <p>ADMIN 계정으로 로그인한 경우에만 통계를 확인할 수 있습니다.</p>
        </section>
      </main>
    );
  }

  const popularPages = Array.isArray(stats?.popularPages) ? stats.popularPages : [];
  const dailyTrend = Array.isArray(stats?.dailyTrend) ? stats.dailyTrend : [];
  const livePages = Object.entries(onlinePageCounts)
    .map(([path, count]) => ({ path, count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxTrendVisits = Math.max(1, ...dailyTrend.map((item) => Number(item.visits) || 0));
  const maxPopularVisits = Math.max(1, ...popularPages.map((item) => Number(item.visits) || 0));
  const periodLabel = periodDays === 1 ? '일별' : periodDays === 7 ? '주간' : '월간';
  return (
    <main className="renew-subpage renew-admin-analytics">
      <section className="renew-admin-analytics-head">
        <div>
          <span>ADMIN ANALYTICS</span>
          <h1>사이트 통계</h1>
        </div>
        <div className="renew-admin-period" aria-label="통계 기간">
          {[1, 7, 30].map((days) => (
            <button key={days} type="button" className={periodDays === days ? 'is-active' : ''} onClick={() => setPeriodDays(days)}>
              {days === 1 ? '일별' : days === 7 ? '주간' : '월간'}
            </button>
          ))}
        </div>
      </section>

      <section className="renew-admin-analytics-metrics">
        {[
          ['현재 접속 중', onlineVisitors, true],
          ['오늘 방문', stats?.todayVisits, false],
          [`최근 ${periodDays}일 방문`, stats?.periodVisits, false],
          ['전체 유저 수', stats?.totalUsers, false],
          ['오늘 가입', stats?.todaySignups, false]
        ].map(([label, value, isLive]) => (
          <article key={label} className={isLive ? 'is-live' : undefined}>
            <span>{label}</span>
            <strong>{Number(value || 0).toLocaleString('ko-KR')}</strong>
          </article>
        ))}
      </section>

      {error ? <p className="renew-admin-analytics-error">{error}</p> : null}

      <section className="renew-admin-analytics-grid">
        <article className="renew-admin-analytics-panel">
          <header>
            <div>
              <span>LIVE</span>
              <h2>현재 보고 있는 페이지</h2>
            </div>
            <strong>{Number(onlineVisitors || 0).toLocaleString('ko-KR')}명</strong>
          </header>
          <div className="renew-admin-live-list">
            {livePages.length ? livePages.map((item) => (
              <div key={item.path}>
                <span>{getAdminPageLabel(item.path)}</span>
                <strong>{item.count}명</strong>
              </div>
            )) : <p>현재 접속 정보가 없습니다.</p>}
          </div>
        </article>

        <article className="renew-admin-analytics-panel">
          <header>
            <div>
              <span>TREND</span>
              <h2>일자별 방문 추이</h2>
            </div>
          </header>
          <div className="renew-admin-trend" aria-label="일자별 방문 추이">
            {dailyTrend.length ? dailyTrend.map((item) => (
              <div key={item.date}>
                <span>{item.date.slice(5).replace('-', '.')}</span>
                <i><b style={{ height: `${Math.max(6, (Number(item.visits) / maxTrendVisits) * 100)}%` }} /></i>
                <strong>{Number(item.visits).toLocaleString('ko-KR')}</strong>
              </div>
            )) : <p>{loading ? '통계를 불러오는 중입니다.' : '집계된 방문 기록이 없습니다.'}</p>}
          </div>
        </article>
      </section>

      <section className="renew-admin-analytics-panel renew-admin-popular">
        <header>
          <div>
            <span>POPULAR PAGES</span>
            <h2>{periodLabel} 많이 본 페이지</h2>
          </div>
          <small>같은 브라우저가 같은 페이지를 하루에 여러 번 열어도 1회로 집계합니다.</small>
        </header>
        <div className="renew-admin-popular-list">
          {popularPages.length ? popularPages.map((item, index) => (
            <article key={item.path}>
              <b>{index + 1}</b>
              <div>
                <strong>{getAdminPageLabel(item.path)}</strong>
                <span>{item.path}</span>
              </div>
              <i><em style={{ width: `${Math.max(4, (Number(item.visits) / maxPopularVisits) * 100)}%` }} /></i>
              <strong>{Number(item.visits).toLocaleString('ko-KR')}회</strong>
            </article>
          )) : <p>{loading ? '통계를 불러오는 중입니다.' : '페이지별 집계는 이번 업데이트 이후부터 누적됩니다.'}</p>}
        </div>
      </section>
    </main>
  );
}

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

function getShopMapLinks(shop) {
  const lat = Number(shop?.lat);
  const lng = Number(shop?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const naverKeyword = encodeURIComponent(shop?.name || '');
  const keyword = encodeURIComponent([shop?.name, shop?.address].filter(Boolean).join(' '));
  return {
    naver: shop?.naverMapUrl || `https://map.naver.com/p/search/${naverKeyword}`,
    kakao: shop?.kakaoMapUrl || (hasCoords
      ? `https://map.kakao.com/link/map/${encodeURIComponent(shop?.name || '매장')},${lat},${lng}`
      : `https://map.kakao.com/?q=${keyword}`)
  };
}

function filterPartnerShopRows(items, { sido, gungu, query }) {
  const keyword = String(query || '').trim().toLowerCase();
  return items.filter((shop) => {
    const matchesSido = !sido || sido === '전체' || shop.sido === sido;
    const matchesGungu = !gungu || gungu === '전체' || shop.gungu === gungu;
    const matchesQuery = !keyword || [shop.name, shop.address, shop.sido, shop.gungu]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
    return matchesSido && matchesGungu && matchesQuery;
  });
}

function mergeShopRows(items) {
  const unique = new Map();
  items.forEach((shop) => {
    const key = `${String(shop?.name || '').trim().toLowerCase()}|${String(shop?.address || '').trim().toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, shop);
  });
  return [...unique.values()];
}

function getDistanceKm(from, shop) {
  const lat = Number(shop?.lat);
  const lng = Number(shop?.lng);
  if (!from || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const toRadians = (value) => (value * Math.PI) / 180;
  const latDelta = toRadians(lat - from.lat);
  const lngDelta = toRadians(lng - from.lng);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatShopDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return '';
  if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 1000 / 10) * 10)}m`;
  return `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)}km`;
}

function RenewJapaneseShops() {
  const [prefecture, setPrefecture] = useState('');
  const [query, setQuery] = useState('');
  const prefectures = useMemo(() => [...new Set(JP_OFFICIAL_SHOPS.map((shop) => shop.prefecture))], []);
  const shops = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return JP_OFFICIAL_SHOPS.filter((shop) => {
      if (prefecture && shop.prefecture !== prefecture) return false;
      if (!normalizedQuery) return true;
      return `${shop.name} ${shop.address}`.toLowerCase().includes(normalizedQuery);
    });
  }, [prefecture, query]);

  return (
    <main className="renew-subpage">
      <section className="renew-panel renew-shops renew-jp-shops">
        <div className="renew-jp-shop-intro">
          <div>
            <span>OFFICIAL SHOP</span>
            <h1>ONE PIECEカードゲーム 公式ショップ</h1>
            <p>公式ショップの住所・営業時間を確認できます。商品在庫とイベントは公式サイトの最新案内をご確認ください。</p>
          </div>
          <a href={JP_OFFICIAL_SHOP_SOURCE_URL} target="_blank" rel="noreferrer">公式サイト</a>
        </div>

        <div className="renew-shop-filters renew-jp-shop-filters">
          <select value={prefecture} onChange={(event) => setPrefecture(event.target.value)} aria-label="都道府県を選択">
            <option value="">すべての地域</option>
            {prefectures.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="renew-shop-search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店舗名または住所で検索" aria-label="店舗を検索" />
          </label>
        </div>

        <aside className="renew-jp-shop-resources" aria-label="公式ショップ情報">
          <a href={JP_CERTIFIED_SHOP_SOURCE_URL} target="_blank" rel="noreferrer">
            <strong>公認店を探す</strong>
            <span>地域・市区町村ごとの公認店は公式検索で確認</span>
          </a>
          <a href={JP_EVENT_SOURCE_URL} target="_blank" rel="noreferrer">
            <strong>公式イベント一覧</strong>
            <span>大会・ティーチング会の最新開催情報を確認</span>
          </a>
        </aside>

        <div className="renew-shop-grid">
          {shops.map((shop) => (
            <article key={shop.name}>
              <b>{shop.name}</b>
              <p>{shop.address}</p>
              <small>{shop.prefecture} · 営業時間 {shop.hours}</small>
              <div className="renew-shop-map-links">
                <a href={getGoogleMapsSearchUrl(shop)} target="_blank" rel="noreferrer">Google マップ</a>
                <a href={JP_OFFICIAL_SHOP_SOURCE_URL} target="_blank" rel="noreferrer">公式情報</a>
              </div>
            </article>
          ))}
          {!shops.length ? <p className="renew-jp-shop-empty">条件に一致する公式ショップはありません。</p> : null}
        </div>
        <p className="renew-jp-shop-source">店舗情報の出典: ONE PIECEカードゲーム 公式ショップ（最終確認 2026.07.15）</p>
      </section>
    </main>
  );
}

function RenewShops({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const initialShopRouteState = getShopRouteState();
  const savedViewState = getAppHistoryState().shopsViewState || {};
  const [type, setType] = useState(() => savedViewState.type ?? (initialShopRouteState?.type || ''));
  const [sido, setSido] = useState(() => savedViewState.sido ?? (initialShopRouteState?.sido || '전체'));
  const [gungu, setGungu] = useState(() => savedViewState.gungu || '전체');
  const [draftQuery, setDraftQuery] = useState(() => savedViewState.draftQuery || '');
  const [query, setQuery] = useState(() => savedViewState.query || '');
  const [regions, setRegions] = useState({ sidos: [], gungus: [] });
  const [shops, setShops] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const partnerShopRows = useMemo(() => getPartnerShopRows(uiLang), [uiLang]);

  useEffect(() => {
    if (getPageFromPath(window.location.pathname) !== 'shops') return;
    replaceAppHistoryState({ shopsViewState: { type, sido, gungu, draftQuery, query } });
  }, [type, sido, gungu, draftQuery, query]);

  useEffect(() => {
    let cancelled = false;
    const partnerRows = type === '' || type === 'partner' ? partnerShopRows : [];
    if (type === 'partner') {
      const sidos = [...new Set(partnerRows.map((shop) => shop.sido).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
      const gungus = !sido || sido === '전체'
        ? []
        : [...new Set(partnerRows.filter((shop) => shop.sido === sido).map((shop) => shop.gungu).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
      setRegions({ sidos, gungus });
      return undefined;
    }
    fetchShopRegions(type, sido)
      .then((nextRegions) => {
        if (cancelled) return;
        const sidos = [...new Set([...(nextRegions?.sidos || []), ...partnerRows.map((shop) => shop.sido).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'ko'));
        const partnerGungus = !sido || sido === '전체' ? [] : partnerRows.filter((shop) => shop.sido === sido).map((shop) => shop.gungu).filter(Boolean);
        const gungus = [...new Set([...(nextRegions?.gungus || []), ...partnerGungus])].sort((a, b) => a.localeCompare(b, 'ko'));
        setRegions({ sidos, gungus });
      })
      .catch(() => {
        if (!cancelled) setRegions({ sidos: [], gungus: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [type, sido, partnerShopRows]);

  useEffect(() => {
    let cancelled = false;
    const partnerRows = type === '' || type === 'partner'
      ? filterPartnerShopRows(partnerShopRows, { sido, gungu, query })
      : [];
    if (type === 'partner') {
      setShops(partnerRows);
      return undefined;
    }
    fetchShops({ type, sido, gungu, q: query })
      .then((items) => {
        if (!cancelled) setShops(mergeShopRows([...(Array.isArray(items) ? items : []), ...partnerRows]));
      })
      .catch(() => {
        if (!cancelled) setShops(partnerRows);
      });
    return () => {
      cancelled = true;
    };
  }, [type, sido, gungu, query, partnerShopRows]);

  const displayedShops = useMemo(() => {
    if (!userPosition) return shops;
    return shops
      .map((shop) => ({ ...shop, distanceKm: getDistanceKm(userPosition, shop) }))
      .sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity));
  }, [shops, userPosition]);

  const handleNearbySort = () => {
    if (userPosition) {
      setUserPosition(null);
      setLocationError('');
      return;
    }
    if (!navigator.geolocation) {
      setLocationError(uiLang === 'EN' ? 'Location is not supported on this device.' : '이 기기에서는 위치 기능을 사용할 수 없습니다.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPosition({ lat: coords.latitude, lng: coords.longitude });
        setLocationLoading(false);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setLocationError(
          uiLang === 'EN'
            ? denied ? 'Location permission was denied.' : 'Unable to determine your location.'
            : denied ? '위치 권한이 차단되었습니다. 기기 설정에서 권한을 허용해 주세요.' : '현재 위치를 확인하지 못했습니다.'
        );
        setLocationLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <main className="renew-subpage">
      <section className="renew-panel renew-shops">
        <div className="renew-shop-partner-link">
          <div>
            <small>{uiLang === 'EN' ? 'PARTNER SHOPS' : 'PARTNER SHOPS'}</small>
            <strong>{uiLang === 'EN' ? 'Partner card shops' : '제휴 카드샵'}</strong>
            <span>{uiLang === 'EN' ? 'Check partner stores and shop news.' : '제휴 카드샵 위치와 입고소식을 확인할 수 있습니다.'}</span>
          </div>
          <a href="/shops/partners" onClick={() => rememberCurrentAppView()}>{uiLang === 'EN' ? 'View' : '보기'}</a>
        </div>
        <div className="renew-shop-filters">
          <select value={type} onChange={(event) => { setType(event.target.value); setSido('전체'); setGungu('전체'); }}>
            <option value="">{t('allShops')}</option>
            <option value="official">{t('officialShop')}</option>
            <option value="general">{t('searchShop')}</option>
            <option value="partner">{t('partnerShop')}</option>
          </select>
          <select value={sido} onChange={(event) => { setSido(event.target.value); setGungu('전체'); }}>
            <option value="전체">{t('allRegions')}</option>
            {regions.sidos?.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={gungu} onChange={(event) => setGungu(event.target.value)}>
            <option value="전체">{t('allDistricts')}</option>
            {regions.gungus?.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <form className="renew-shop-search" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery.trim()); }}>
            <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder={t('shopSearchPlaceholder')} />
            <button type="submit">검색</button>
          </form>
        </div>
        <div className="renew-shop-sortbar">
          <button
            type="button"
            className={userPosition ? 'is-active' : ''}
            onClick={handleNearbySort}
            disabled={locationLoading}
            aria-pressed={Boolean(userPosition)}
          >
            {locationLoading
              ? (uiLang === 'EN' ? 'Locating...' : '위치 확인 중...')
              : userPosition
                ? (uiLang === 'EN' ? 'Nearby first ON' : '내 주변순 적용 중')
                : (uiLang === 'EN' ? 'Sort by distance' : '내 주변순')}
          </button>
          {locationError ? <small role="status">{locationError}</small> : null}
        </div>
        <div className="renew-shop-grid">
          {displayedShops.map((shop) => {
            const links = getShopMapLinks(shop);
            return (
              <article key={`${shop.name}-${shop.address}`}>
                <b>{shop.name}</b>
                <p>{shop.address}</p>
                <small>{shop.sido} {shop.gungu} · {shop.sourceLabel || shop.sourceType}</small>
                {userPosition && Number.isFinite(shop.distanceKm) ? (
                  <strong className="renew-shop-distance">
                    {uiLang === 'EN' ? 'About ' : '현재 위치에서 약 '}{formatShopDistance(shop.distanceKm)}
                  </strong>
                ) : null}
                <div className="renew-shop-map-links">
                  <a href={links.naver} target="_blank" rel="noreferrer">{t('naverMap')}</a>
                  <a href={links.kakao} target="_blank" rel="noreferrer">{t('kakaoMap')}</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <RenewSeoSummary page="shops" titleAs="h1" placement="footer" uiLang={uiLang} />
    </main>
  );
}

export default function RenewApp() {
  const initialPage = getPageFromPath(window.location.pathname);
  const [activePage, setActivePage] = useState(initialPage);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  });
  const [uiLang, setUiLang] = useState(() => {
    if (typeof window === 'undefined') return 'KR';
    const routeLocale = getPathLocale(window.location.pathname);
    if (routeLocale) return routeLocale;
    const savedLocale = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
    return ['EN', 'JP'].includes(savedLocale) ? savedLocale : 'KR';
  });
  const [authUser, setAuthUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(!supabase);
  const [notifications, setNotifications] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userState, setUserState] = useState(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [onlineVisitors, setOnlineVisitors] = useState(0);
  const [onlinePageCounts, setOnlinePageCounts] = useState({});
  const [visitorToken, setVisitorToken] = useState('');
  const [legalOpen, setLegalOpen] = useState(null);
  const [catalogInitialSearch, setCatalogInitialSearch] = useState(null);
  const [catalogViewState, setCatalogViewState] = useState(() => window.history.state?.catalogViewState || getCatalogRouteViewState());
  const [catalogReturnScrollY, setCatalogReturnScrollY] = useState(() => {
    if (initialPage !== 'cards') return null;
    const scrollY = Number(window.history.state?.cardPoneScrollY);
    return Number.isFinite(scrollY) ? scrollY : null;
  });
  const [routeReturnScrollY, setRouteReturnScrollY] = useState(() => {
    if (initialPage === 'cards') return null;
    const scrollY = Number(window.history.state?.cardPoneScrollY);
    return Number.isFinite(scrollY) ? scrollY : null;
  });
  const [marketInitialCode, setMarketInitialCode] = useState('');
  const [marketInitialApparelId, setMarketInitialApparelId] = useState(null);
  const [marketInitialCardId, setMarketInitialCardId] = useState('');
  const [deckBuilderInitialLeader, setDeckBuilderInitialLeader] = useState(null);
  const [deckBuilderInitialTemplate, setDeckBuilderInitialTemplate] = useState(null);
  const [marketListings, setMarketListings] = useState(MARKETPLACE_SAMPLE_LISTINGS);
  const [marketFilterCardId, setMarketFilterCardId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('cardId') || '';
  });
  const [newsComingSoonOpen, setNewsComingSoonOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [routeRevision, setRouteRevision] = useState(0);
  const internalNavigationRef = useRef(false);
  const presenceChannelRef = useRef(null);

  const pageTitle = useMemo(() => getUiText(uiLang, NAV_ITEMS.find((item) => item.id === (activePage === 'seriesGuide' ? 'cards' : ['centering', 'centeringGuide', 'packSimulator', 'packSimulatorGuide', 'portfolioCalculator', 'portfolioCalculatorGuide', 'deckLab', 'deckBuilder', 'deckGuide'].includes(activePage) ? 'lab' : activePage))?.labelKey), [activePage, uiLang]);
  const displayName = useMemo(() => getUserDisplayName(authUser), [authUser]);
  const isAdminUser = useMemo(() => authUser?.app_metadata?.role === 'admin', [authUser]);
  const needsSocialConsent = useMemo(() => {
    const provider = String(authUser?.app_metadata?.provider || '').toLowerCase();
    return Boolean(authUser?.id
      && ['google', 'kakao', 'custom:naver', 'naver'].includes(provider)
      && (!authUser.user_metadata?.terms_accepted_at || !authUser.user_metadata?.privacy_accepted_at));
  }, [authUser]);
  const t = (key) => getUiText(uiLang, key);
  const handleCatalogViewStateChange = useCallback((nextViewState) => {
    setCatalogViewState(nextViewState);
    if (getPageFromPath(window.location.pathname) !== 'cards') return;
    replaceAppHistoryState({ catalogViewState: nextViewState });
  }, []);
  const refreshNotifications = useCallback(async () => {
    if (!authUser?.id) {
      setNotifications([]);
      return;
    }
    const payload = await fetchMarketplaceNotifications();
    setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
  }, [authUser?.id]);

  useEffect(() => {
    applyPageSeo(activePage, uiLang);
  }, [activePage, uiLang]);

  useEffect(() => {
    if (window.location.pathname === '/deck' || window.location.pathname === '/deck-simulator') {
      replaceAppHistoryState({}, '/news');
    }
  }, []);

  useEffect(() => {
    if (!MARKETPLACE_ENABLED) {
      setMarketListings([]);
      return undefined;
    }
    let cancelled = false;
    fetchMarketplaceListings()
      .then((payload) => {
        if (cancelled) return;
        const listings = Array.isArray(payload?.listings) ? payload.listings : [];
        setMarketListings(listings);
      })
      .catch(() => {
        if (!cancelled) setMarketListings(MARKETPLACE_SAMPLE_LISTINGS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 520);
    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    return () => window.removeEventListener('scroll', updateBackToTop);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, uiLang);
  }, [uiLang]);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (activePage === 'prices') {
      const routeState = getMarketRouteState(window.location.pathname, window.location.search);
      setMarketInitialCode(routeState.code);
      setMarketInitialApparelId(routeState.apparelId);
      setMarketInitialCardId(routeState.cardId);
    }
  }, []);

  useEffect(() => {
    const handlePopState = (event) => {
      setRouteRevision((value) => value + 1);
      internalNavigationRef.current = Boolean(event.state?.cardPoneInternal);
      const routeLocale = getPathLocale(window.location.pathname);
      if (routeLocale) setUiLang(routeLocale);
      else setUiLang((current) => current === 'JP' ? 'KR' : current);
      const nextPage = getPageFromPath(window.location.pathname);
      if (nextPage === 'home') {
        setCatalogInitialSearch(null);
        setCatalogViewState(null);
      }
      if (nextPage === 'cards') {
        setCatalogViewState(event.state?.catalogViewState || getCatalogRouteViewState(window.location.pathname));
        setCatalogReturnScrollY(Number.isFinite(Number(event.state?.cardPoneScrollY)) ? Number(event.state.cardPoneScrollY) : null);
      }
      setRouteReturnScrollY(nextPage === 'cards' || !Number.isFinite(Number(event.state?.cardPoneScrollY))
        ? null
        : Number(event.state.cardPoneScrollY));
      setActivePage(nextPage);
      if (nextPage === 'prices') {
        const routeState = getMarketRouteState(window.location.pathname, window.location.search);
        setMarketInitialCode(routeState.code);
        setMarketInitialApparelId(routeState.apparelId);
        setMarketInitialCardId(routeState.cardId);
      }
      if (nextPage === 'marketplace') {
        const params = new URLSearchParams(window.location.search);
        setMarketFilterCardId(params.get('cardId') || '');
      }
      if (!['/privacy', '/terms'].includes(getAppPath(window.location.pathname))) setLegalOpen(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (routeReturnScrollY == null) return undefined;
    return restoreAppScrollPosition(routeReturnScrollY, { onDone: () => setRouteReturnScrollY(null) });
  }, [activePage, routeReturnScrollY]);

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
    if (!visitorToken || !authResolved || isAdminUser) return undefined;
    const analyticsPath = getAnalyticsVisitPath(window.location.pathname);
    const storageKey = `optcg_visit_${getKstDateKey(Date.now())}_${analyticsPath}`;
    if (window.localStorage.getItem(storageKey)) return undefined;
    const reportVisit = () => {
      trackVisit(visitorToken, analyticsPath)
        .then(() => window.localStorage.setItem(storageKey, '1'))
        .catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(reportVisit, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(reportVisit, 1500);
    return () => window.clearTimeout(timer);
  }, [activePage, authResolved, isAdminUser, routeRevision, visitorToken]);

  useEffect(() => {
    if (!supabase || !visitorToken || !authResolved) return undefined;

    const channel = supabase.channel('site-presence-v1', {
      config: { presence: { key: visitorToken } }
    });
    presenceChannelRef.current = channel;
    const syncOnlineVisitors = () => {
      const presenceState = channel.presenceState() || {};
      const pageCounts = {};
      let visitorCount = 0;
      Object.values(presenceState).forEach((metas) => {
        if (!Array.isArray(metas) || !metas.length) return;
        visitorCount += 1;
        const sortedMetas = [...metas].sort((a, b) => String(a.onlineAt || '').localeCompare(String(b.onlineAt || '')));
        const latest = sortedMetas[sortedMetas.length - 1];
        const page = getAnalyticsVisitPath(latest?.page || '/');
        pageCounts[page] = (pageCounts[page] || 0) + 1;
      });
      setOnlineVisitors(visitorCount);
      setOnlinePageCounts(pageCounts);
    };

    channel
      .on('presence', { event: 'sync' }, syncOnlineVisitors)
      .on('presence', { event: 'join' }, syncOnlineVisitors)
      .on('presence', { event: 'leave' }, syncOnlineVisitors)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || isAdminUser) return;
        await channel.track({
          page: window.location.pathname,
          onlineAt: new Date().toISOString()
        });
      });

    return () => {
      if (presenceChannelRef.current === channel) presenceChannelRef.current = null;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [authResolved, isAdminUser, visitorToken]);

  useEffect(() => {
    const channel = presenceChannelRef.current;
    if (!channel || !visitorToken || isAdminUser) return;
    channel.track({
      page: getAnalyticsVisitPath(window.location.pathname),
      onlineAt: new Date().toISOString()
    }).catch(() => {});
  }, [activePage, isAdminUser, routeRevision, visitorToken]);

  useEffect(() => {
    if (!supabase) {
      setAuthResolved(true);
      return undefined;
    }
    let mounted = true;
    supabase.auth.getSession()
      .then(async ({ data }) => {
        let user = data.session?.user || null;
        if (user?.user_metadata?.username === 'admin' && user?.app_metadata?.role !== 'admin') {
          const { data: freshData } = await supabase.auth.getUser();
          user = freshData?.user || user;
        }
        if (mounted) setAuthUser(user);
      })
      .catch(() => {
        if (mounted) setAuthUser(null);
      })
      .finally(() => {
        if (mounted) setAuthResolved(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
      setAuthResolved(true);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser?.id || !window.localStorage.getItem(PENDING_SOCIAL_CONSENT_KEY)) return undefined;
    let cancelled = false;
    applyPendingSocialConsent(authUser).then((nextUser) => {
      if (!cancelled && nextUser?.id) setAuthUser(nextUser);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    syncNativePushRegistration().catch(() => {});
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) {
      setNotifications([]);
      return undefined;
    }
    let cancelled = false;
    const load = () => refreshNotifications().catch(() => {
      if (!cancelled) setNotifications([]);
    });
    load();
    const timer = window.setInterval(load, 60_000);
    const handleFocus = () => load();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authUser?.id, refreshNotifications]);

  useEffect(() => {
    let cancelled = false;
    if (!authUser) {
      setUserState(null);
      setPortfolioHoldings([]);
      setStateLoading(false);
      return undefined;
    }
    setStateLoading(true);
    (async () => {
      try {
        const portfolio = await fetchPortfolio();
        if (!cancelled) setPortfolioHoldings(Array.isArray(portfolio?.holdings) ? portfolio.holdings : []);
      } catch {
        if (!cancelled) setPortfolioHoldings([]);
      }
      try {
        const state = await fetchMyState();
        if (!cancelled) setUserState(state || null);
      } catch {
        if (!cancelled) setUserState(null);
      } finally {
        if (!cancelled) setStateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  async function handleAuthClick(action = 'login') {
    if (action === 'mypage' && authUser) {
      setAccountOpen(true);
      return;
    }
    if (action === 'logout') {
      await handleLogout();
      return;
    }
    setAuthOpen(true);
  }

  async function handleLogout() {
    if (authUser && supabase) {
      await supabase.auth.signOut();
      setAuthUser(null);
    }
    setAccountOpen(false);
  }

  async function handleNotificationSelect(notification) {
    if (!notification) return;
    if (!notification.read_at) {
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, read_at: readAt } : item)));
      try {
        await markMarketplaceNotificationRead(notification.id);
      } catch {
        refreshNotifications().catch(() => {});
      }
    }
    const link = String(notification.link_url || '');
    if (link.startsWith('/')) {
      const target = new URL(link, window.location.origin);
      const nextPage = getPageFromPath(target.pathname);
      if (nextPage === 'prices') {
        const routeState = getMarketRouteState(target.pathname, target.search);
        setMarketInitialCode(routeState.code);
        setMarketInitialApparelId(routeState.apparelId);
        setMarketInitialCardId(routeState.cardId);
      }
      if (nextPage === 'marketplace') setMarketFilterCardId(target.searchParams.get('cardId') || '');
      setActivePage(nextPage);
      internalNavigationRef.current = true;
      pushAppHistory(`${target.pathname}${target.search}`);
    }
  }

  async function handleNotificationsReadAll() {
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    try {
      await markAllMarketplaceNotificationsRead();
    } catch {
      refreshNotifications().catch(() => {});
    }
  }

  function changeUiLanguage(nextLanguage) {
    const language = ['KR', 'EN', 'JP'].includes(nextLanguage) ? nextLanguage : 'KR';
    const nextPath = localizeAppPath(window.location.pathname, language);
    const nextUrl = `${nextPath}${window.location.search}`;
    setUiLang(language);
    if (window.location.pathname + window.location.search !== nextUrl) {
      replaceAppHistoryState({}, nextUrl);
    }
  }

  function navigatePage(page, options = {}) {
    if (page === 'community') {
      page = 'lab';
    }
    if (page === 'marketplace' && !MARKETPLACE_TAB_VISIBLE) {
      page = 'home';
    }
    const path = getLocalizedPagePath(page, uiLang);
    const query = options.query ? `?${options.query}` : '';
    const nextUrl = `${path}${query}`;
    if (page === 'home') {
      setCatalogInitialSearch(null);
      setCatalogViewState(null);
    }
    if (page === 'marketplace' && !options.query) {
      setMarketFilterCardId('');
    }
    setActivePage(page);
    if (page === 'prices' && !options.query) {
      setMarketInitialCode('');
      setMarketInitialApparelId(null);
      setMarketInitialCardId('');
    }
    if (window.location.pathname + window.location.search !== nextUrl) {
      internalNavigationRef.current = true;
      pushAppHistory(nextUrl);
    }
  }

  function openLegal(type) {
    setLegalOpen(type);
    internalNavigationRef.current = true;
    pushAppHistory(localizeAppPath(`/${type}`, uiLang));
  }

  function closeLegal() {
    setLegalOpen(null);
    const path = getAppPath(window.location.pathname);
    if (path === '/privacy' || path === '/terms') {
      if (window.history.state?.cardPoneInternal) window.history.back();
      else replaceAppHistoryState({}, getLocalizedPagePath(activePage, uiLang));
    }
  }

  function openMobileNews() {
    navigatePage('news');
  }

  const routeBackInfo = getRouteBackInfo(window.location.pathname, window.location.search);
  const hideLabBackOnDesktop = [
    'lab',
    'centering',
    'centeringGuide',
    'packSimulator',
    'packSimulatorGuide',
    'portfolioCalculator',
    'portfolioCalculatorGuide',
    'deckLab',
    'deckBuilder',
    'deckGuide',
  ].includes(activePage);

  function handleRouteBack() {
    if (!routeBackInfo) return;
    const sameOriginReferrer = document.referrer && document.referrer.startsWith(SITE_ORIGIN);
    if (internalNavigationRef.current || sameOriginReferrer || window.history.state?.cardPoneInternal) {
      const currentUrl = window.location.href;
      window.history.back();
      window.setTimeout(() => {
        if (window.location.href === currentUrl) navigatePage(routeBackInfo.page);
      }, 250);
      return;
    }
    navigatePage(routeBackInfo.page);
  }

  return (
    <div className={`renew-app ${isDark ? 'is-dark' : ''}`} data-build-revision={APP_BUILD_REVISION}>
      <RenewHeader
        activePage={activePage}
        onNavigate={navigatePage}
        onMobileNews={openMobileNews}
        isDark={isDark}
        onToggleTheme={() => setIsDark((value) => !value)}
        isLoggedIn={Boolean(authUser)}
        isAdmin={isAdminUser}
        displayName={displayName}
        onAuthClick={handleAuthClick}
        uiLang={uiLang}
        onUiLangChange={changeUiLanguage}
        notifications={notifications}
        onNotificationSelect={handleNotificationSelect}
        onNotificationsReadAll={handleNotificationsReadAll}
      />
      {routeBackInfo ? (
        <RenewRouteBackButton
          label={getRouteBackLabel(uiLang)}
          onClick={handleRouteBack}
          hideOnDesktop={hideLabBackOnDesktop}
        />
      ) : null}
      {activePage === 'home' ? (
        <RenewHome
          authUser={authUser}
          userState={userState}
          portfolioHoldings={portfolioHoldings}
          setPortfolioHoldings={setPortfolioHoldings}
          stateLoading={stateLoading}
          visitorToken={visitorToken}
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
          onNavigateNews={(query) => navigatePage('news', { query })}
          onOpenIndex={(indexType = 'manga') => {
            setMarketInitialCode('');
            setMarketInitialApparelId(null);
            setMarketInitialCardId('');
            navigatePage('prices', { query: `tab=index&index=${encodeURIComponent(indexType)}` });
          }}
          onOpenPrices={() => navigatePage('prices')}
        />
      ) : activePage === 'adminAnalytics' ? (
        <RenewAdminAnalytics
          authUser={authUser}
          onlineVisitors={onlineVisitors}
          onlinePageCounts={onlinePageCounts}
        />
      ) : activePage === 'cards' ? (
        <RenewCatalog
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          initialSearch={catalogInitialSearch}
          initialViewState={catalogViewState}
          viewStateRevision={routeRevision}
          restoreScrollY={catalogReturnScrollY}
          onRestoreScrollDone={() => setCatalogReturnScrollY(null)}
          onViewStateChange={handleCatalogViewStateChange}
          onOpenMarket={(marketTarget) => {
            const nextCode = typeof marketTarget === 'object' ? marketTarget?.code : marketTarget;
            const nextApparelId = typeof marketTarget === 'object' ? marketTarget?.apparelId : null;
            const nextCardId = typeof marketTarget === 'object' ? marketTarget?.cardId : '';
            setCatalogReturnScrollY(typeof window !== 'undefined' ? getCurrentAppScrollY() : null);
            setMarketInitialCode(nextCode || '');
            setMarketInitialApparelId(nextApparelId || null);
            setMarketInitialCardId(nextCardId || '');
            const query = new URLSearchParams();
            if (nextCode) query.set('code', nextCode);
            if (nextApparelId) query.set('apparelId', String(nextApparelId));
            if (nextCardId) query.set('cardId', String(nextCardId));
            navigatePage('prices', { query: query.toString() });
          }}
          onOpenMarketplace={MARKETPLACE_ENABLED ? ((card) => {
            const cardId = card?.id || '';
            setMarketFilterCardId(cardId);
            const query = new URLSearchParams();
            if (cardId) query.set('cardId', cardId);
            navigatePage('marketplace', { query: query.toString() });
          }) : undefined}
          onOpenSeriesGuide={(series) => {
            setActivePage('seriesGuide');
            internalNavigationRef.current = true;
            pushAppHistory(localizeAppPath(getSeriesGuideRoutePath(series), uiLang));
          }}
          onRequireLogin={() => handleAuthClick('login')}
          marketListings={MARKETPLACE_ENABLED ? marketListings : []}
          uiLang={uiLang}
        />
      ) : activePage === 'seriesGuide' ? (
        <RenewSeriesGuide
          onOpenCatalog={(series) => {
            setCatalogViewState({
              locale: series?.locale || 'JP',
              selectedSeries: series?.id || getDefaultRenewSeriesId('JP'),
              searchKeyword: '',
              activeRarity: 'ALL',
              collectionFilter: 'all',
              catalogSortMode: 'rarity',
              openSection: getSeriesSectionId(series)
            });
            navigatePage('cards');
          }}
          onSelectPopular={(item) => {
            if (item.type === 'box' && item.targetId) {
              setMarketInitialCode(item.label || item.query || '');
              setMarketInitialApparelId(item.targetId);
              setMarketInitialCardId('');
              navigatePage('prices', { query: `tab=box&code=${encodeURIComponent(item.label || '')}&apparelId=${encodeURIComponent(item.targetId)}` });
              return;
            }
            setCatalogViewState(null);
            setCatalogInitialSearch({
              locale: item.locale || 'JP',
              q: String(item.query || item.label || '').trim(),
              id: Date.now()
            });
            const query = item.type === 'card' && item.targetId
              ? `cardId=${encodeURIComponent(item.targetId)}`
              : '';
            navigatePage('cards', query ? { query } : undefined);
          }}
          onOpenCard={(series, card) => {
            setCatalogViewState({
              locale: series?.locale || 'JP',
              selectedSeries: series?.id || getDefaultRenewSeriesId('JP'),
              searchKeyword: '',
              activeRarity: 'ALL',
              collectionFilter: 'all',
              catalogSortMode: 'rarity',
              openSection: getSeriesSectionId(series)
            });
            navigatePage('cards', { query: `cardId=${encodeURIComponent(card.id)}` });
          }}
          onOpenPrices={() => navigatePage('prices')}
        />
      ) : activePage === 'prices' ? (
        <RenewMarket
          authUser={authUser}
          portfolioHoldings={portfolioHoldings}
          setPortfolioHoldings={setPortfolioHoldings}
          initialCode={marketInitialCode}
          initialApparelId={marketInitialApparelId}
          initialCardId={marketInitialCardId}
          routeRevision={routeRevision}
          onRequireLogin={() => handleAuthClick('login')}
          uiLang={uiLang}
        />
      ) : activePage === 'marketplace' ? (
        MARKETPLACE_ENABLED ? (
          <RenewMarketplace
            authUser={authUser}
            marketListings={marketListings}
            setMarketListings={setMarketListings}
            filterCardId={marketFilterCardId}
            onClearFilter={() => {
              setMarketFilterCardId('');
              navigatePage('marketplace');
            }}
            onOpenPrice={(cardNo, listingId) => {
              if (!cardNo) return;
              if (listingId && typeof window !== 'undefined') {
                window.sessionStorage.setItem('optcg_market_return_listing_id', String(listingId));
              }
              setMarketInitialCode(cardNo);
              setMarketInitialApparelId(null);
              navigatePage('prices', { query: `code=${encodeURIComponent(cardNo)}` });
            }}
          />
        ) : (
          <RenewMarketplaceHidden />
        )
      ) : activePage === 'profitCalculator' ? (
        <ProfitCalculator uiLang={uiLang} onOpenGuide={() => navigatePage('profitGuide')} />
      ) : activePage === 'profitGuide' ? (
        <ProfitCalculatorGuide uiLang={uiLang} onOpenCalculator={() => navigatePage('profitCalculator')} />
      ) : activePage === 'portfolioCalculator' ? (
        <PortfolioCalculator
          uiLang={uiLang}
          authUser={authUser}
          onOpenGuide={() => navigatePage('portfolioCalculatorGuide')}
          onRequireLogin={() => handleAuthClick('login')}
          onSearchCards={searchPortfolioCalculatorCards}
          onLoadQuote={loadPortfolioCalculatorQuote}
          onEstimatePrice={findPortfolioEstimatePoint}
          onSave={async ({ card, quote, grade, lot }) => {
            const imageUrl = card.imageUrl || card.image_url || card.image || card.thumbnailUrl || '';
            const payload = await savePortfolioPurchase({
              holding: {
                code: card.marketCode || card.cardNo,
                apparelId: quote.apparelId,
                cardId: card.id,
                name: card.name,
                setName: card.seriesName || '',
                imageUrl,
                previewImageUrl: imageUrl,
                sourceUrl: quote.sourceUrl || '',
                grade: normalizeMarketConditionKey(grade)
              },
              purchase: lot
            });
            setPortfolioHoldings(Array.isArray(payload?.holdings) ? payload.holdings : []);
          }}
          onOpenDetail={(card, quote) => {
            const code = card.marketCode || card.cardNo;
            setMarketInitialCode(code);
            setMarketInitialApparelId(quote?.apparelId || null);
            setMarketInitialCardId(card.id || '');
            const query = new URLSearchParams();
            if (code) query.set('code', code);
            if (quote?.apparelId) query.set('apparelId', String(quote.apparelId));
            if (card.id) query.set('cardId', card.id);
            navigatePage('prices', { query: query.toString() });
          }}
          rates={{ krwPerJpy: MARKET_USD_TO_KRW / MARKET_USD_TO_JPY, jpyPerUsd: MARKET_USD_TO_JPY }}
        />
      ) : activePage === 'portfolioCalculatorGuide' ? (
        <PortfolioCalculatorGuide uiLang={uiLang} onOpenCalculator={() => navigatePage('portfolioCalculator')} />
      ) : activePage === 'centeringGuide' ? (
        <RenewLabToolGuide type="centering" uiLang={uiLang} onOpenTool={() => navigatePage('centering')} />
      ) : activePage === 'packSimulatorGuide' ? (
        <RenewLabToolGuide type="packSimulator" uiLang={uiLang} onOpenTool={() => navigatePage('packSimulator')} />
      ) : activePage === 'deckGuide' ? (
        <RenewLabToolGuide type="deckBuilder" uiLang={uiLang} onOpenTool={() => navigatePage('deckLab')} />
      ) : activePage === 'calendar' ? (
        <RenewCalendar uiLang={uiLang} />
      ) : activePage === 'lab' ? (
        <RenewLabHome
          uiLang={uiLang}
          onOpenCentering={() => navigatePage('centering')}
          onOpenSimulator={() => navigatePage('packSimulator')}
          onOpenPortfolioCalculator={() => navigatePage('portfolioCalculator')}
          onOpenDeckLab={() => navigatePage('deckLab')}
        />
      ) : activePage === 'deckLab' ? (
        <RenewDeckLabHomeV2
          uiLang={uiLang}
          authUser={authUser}
          onRequireLogin={() => handleAuthClick('login')}
          onOpenGuide={() => navigatePage('deckGuide')}
          onOpenBuilder={(leader = null, template = null) => {
            setDeckBuilderInitialLeader(leader);
            setDeckBuilderInitialTemplate(template);
            navigatePage('deckBuilder');
          }}
        />
      ) : activePage === 'deckBuilder' ? (
        <RenewDeck
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          stateLoading={stateLoading}
          uiLang={uiLang}
          initialLeader={deckBuilderInitialLeader}
          initialTemplate={deckBuilderInitialTemplate}
          onOpenGuide={() => navigatePage('deckGuide')}
        />
      ) : activePage === 'packSimulator' ? (
        <RenewPackSimulator
          uiLang={uiLang}
          onOpenCard={(card) => {
            const query = new URLSearchParams();
            if (card?.id) query.set('cardId', card.id);
            navigatePage('cards', { query: query.toString() });
          }}
          onOpenGuide={() => navigatePage('packSimulatorGuide')}
        />
      ) : activePage === 'centering' ? (
        <CenteringLab uiLang={uiLang} onOpenGuide={() => navigatePage('centeringGuide')} />
      ) : activePage === 'news' ? (
        <RenewNews
          uiLang={uiLang}
          onOpenCalendar={() => navigatePage('calendar')}
        />
      ) : activePage === 'partnerShops' ? (
        isJapaneseUi(uiLang) ? <RenewJapaneseShops /> : <RenewPartnerShopSeoPage uiLang={uiLang} />
      ) : activePage === 'shops' ? (
        isJapaneseUi(uiLang) ? <RenewJapaneseShops /> : <RenewShops uiLang={uiLang} />
      ) : activePage === 'about' || activePage === 'dataPolicy' || activePage === 'terms' || activePage === 'privacy' ? (
        <RenewStaticInfoPage type={activePage} />
      ) : activePage === 'statsPrototype' ? (
        <RenewStatsPrototype />
      ) : (
        <PlaceholderPage title={pageTitle} />
      )}
      {showBackToTop ? (
        <button
          type="button"
          className="renew-back-to-top"
          aria-label="맨 위로 이동"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      ) : null}
      {authOpen ? <RenewAuthModal onClose={() => setAuthOpen(false)} onSignedIn={setAuthUser} /> : null}
      {needsSocialConsent ? (
        <RenewSocialConsentModal
          authUser={authUser}
          onAccepted={setAuthUser}
          onLogout={handleLogout}
        />
      ) : null}
      {accountOpen && authUser ? (
        <RenewAccountModal
          authUser={authUser}
          userState={userState}
          displayName={displayName}
          uiLang={uiLang}
          onClose={() => setAccountOpen(false)}
          onLogout={handleLogout}
          onUserUpdated={(user) => {
            if (user) setAuthUser(user);
          }}
        />
      ) : null}
      {newsComingSoonOpen ? (
        <RenewComingSoonModal
          uiLang={uiLang}
          onClose={() => setNewsComingSoonOpen(false)}
          titleKey="newsComingSoonTitle"
          bodyKey="newsComingSoonBody"
        />
      ) : null}
      <footer className="renew-footer" data-nosnippet>
        <strong>© 2026 Card Pone. All rights reserved.</strong>
        <p>{t('footerIntro')}</p>
        <p>{t('footerDisclaimer')}</p>
        <div className="renew-footer-links">
          <a href={getLocalizedPagePath('about', uiLang)} onClick={(event) => { event.preventDefault(); navigatePage('about'); }}>{t('about')}</a>
          <span>·</span>
          <a href={getLocalizedPagePath('dataPolicy', uiLang)} onClick={(event) => { event.preventDefault(); navigatePage('dataPolicy'); }}>{t('dataPolicy')}</a>
          <span>·</span>
          <a href={getLocalizedPagePath('terms', uiLang)} onClick={(event) => { event.preventDefault(); navigatePage('terms'); }}>{t('terms')}</a>
          <span>·</span>
          <a href={getLocalizedPagePath('privacy', uiLang)} onClick={(event) => { event.preventDefault(); navigatePage('privacy'); }}>{t('privacy')}</a>
        </div>
      </footer>
      {legalOpen ? <RenewLegalModal type={legalOpen} onClose={closeLegal} /> : null}
    </div>
  );
}
