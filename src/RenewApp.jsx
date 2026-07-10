import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAdminStats, trackVisit } from './api/admin';
import { resolveLoginEmail } from './api/auth';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import { fetchMyState } from './api/me';
import { saveMyState } from './api/me';
import { createMarketplaceListing, deleteMarketplaceListing, deleteMarketplaceVerification, fetchMarketplaceConversations, fetchMarketplaceListings, fetchMarketplaceMessages, fetchMarketplaceMyVerification, fetchMarketplaceVerifications, incrementMarketplaceListingView, sendMarketplaceMessage, startMarketplaceConversation, submitMarketplaceVerification, updateMarketplaceListing, updateMarketplaceListingInterest, updateMarketplaceVerification, uploadMarketplaceImage } from './api/marketplace';
import { fetchShopRegions, fetchShops } from './api/shops';
import { hasSupabaseAuthConfig, supabase } from './lib/supabase';
import boxMarketItems from './data/box-market-items';
import seriesData from './data/series.json';
import seriesCardCounts from './data/series-card-counts.json';
import topicsData from './data/topics.json';
import './renew.css';

const LOGO_SRC = '/optcg-logo-light.png';
const CARD_THUMBNAIL_BASE_URL = (import.meta.env.VITE_CARD_THUMBNAIL_BASE_URL || '/api/card-thumb').replace(/\/+$/, '');
const SNKRDUNK_MARKET_URL = 'https://snkrdunk.com/en/invitation/AGJ872';
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
  'P-2022': 'Promotional Pack 2022',
  'TPP-NFE': 'New Four Emperors Pack'
};
const BOX_MARKET_PAGE_SIZE = 20;
const THEME_STORAGE_KEY = 'one-piece-tcg-theme';
const UI_LANG_STORAGE_KEY = 'one-piece-tcg-ui-lang';
const VISITOR_TOKEN_KEY = 'one-piece-tcg-visitor-token';
const MARKET_INTEREST_STORAGE_PREFIX = 'one-piece-tcg-market-interest-';
const RENEWAL_NOTICE_KEY = 'one-piece-tcg-news-notice-2026-06-30-kr-op13';
const PORTFOLIO_IMAGE_CACHE_KEY = 'one-piece-tcg-portfolio-image-cache-v2';
const MARKET_USD_TO_JPY = 155;
const MARKET_USD_TO_KRW = MARKET_USD_TO_JPY * 9.4;
const RECENT_SALES_VISIBLE_MS = 1000 * 60 * 60 * 24 * 365;
const MARKETPLACE_TAB_VISIBLE = true;
const MARKETPLACE_ENABLED = false;
const RARITY_ORDER = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const DEFERRED_RARITIES = new Set(['C', 'UC']);

function getBoxReleaseSortValue(item) {
  const rawDate = item?.releaseDate || item?.release_date || item?.releasedAt || item?.released_at;
  const normalizedDate = typeof rawDate === 'string' ? rawDate.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1') : rawDate;
  const releaseTime = normalizedDate ? Date.parse(normalizedDate) : NaN;
  if (Number.isFinite(releaseTime)) return releaseTime;
  return Number(item?.sortOrder ?? String(item?.code || '').match(/\d+/)?.[0]) || 0;
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
      '거래완료 게시물은 거래방 추가 메시지 입력 제한',
      '모바일 거래 화면과 다크모드 가독성 개선'
    ]
  },
  {
    id: '2026-06-11-news',
    title: '[26.06.11] 업데이트 안내',
    summary: 'News 탭 업데이트 완료',
    details: [
      '한글판·일본판 공식 공지사항 영역 추가',
      'OP-17 아마존 사전예약 응모 바로가기 추가',
      '온라인 오리파 바로가기 추가',
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
const OFFICIAL_TOPIC_ITEMS = Array.isArray(topicsData) ? topicsData : [];
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
    title: '아마존 사전예약 응모',
    description: '',
    status: 'AMAZON',
    links: [
      {
        label: 'OP-17 사전예약',
        subLabel: 'Amazon Japan',
        href: 'https://www.amazon.co.jp/dp/B0H43ZX8LK/ref=nosim?tag=optcgkorea26-22',
        imageUrl: '/uploads/amazon-op17.png',
        badge: 'OP-17'
      }
    ]
  },
  {
    id: 'oripa',
    title: '온라인 오리파',
    description: '',
    status: 'Online Mystery pack',
    links: [
      {
        label: 'Beezie',
        subLabel: 'Mystery pack',
        href: 'https://beezie.com/r/grailhunter_266594',
        imageUrl: '/uploads/oripa-beezie.png',
        badge: 'BZ'
      },
      {
        label: 'Phygitals',
        subLabel: 'Online mystery pack',
        href: 'https://phygitals.com/invite/7deb4f',
        imageUrl: '/uploads/oripa-phygitals.png',
        badge: 'PH'
      },
      {
        label: 'Renaiss',
        subLabel: 'Online mystery pack',
        href: 'https://www.renaiss.xyz/ref/badgersfail8806',
        imageUrl: '/uploads/oripa-renaiss.png',
        badge: 'RN'
      }
    ]
  }
];
const NEWS_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'notice', label: '공지사항' },
  { id: 'guide', label: '가이드/Q&A' },
  { id: 'preorder', label: '사전예약' },
  { id: 'oripa', label: '오리파' },
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
        '7D, 1M, 6M, ALL 기간을 바꿔 가격 흐름을 비교할 수 있습니다.',
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
    label: 'OP-17 사전예약 응모',
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
    imageUrl: '/partners/card-sungji.png',
    actions: [
      { labelKr: '네이버 지도', labelEn: 'Naver Map', href: 'https://naver.me/xQe4VQum' },
      { labelKr: '인스타그램', labelEn: 'Instagram', href: 'https://www.instagram.com/card_sungji/' }
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
      return { ...item, label: preorderLink.label, description: 'Amazon Japan 사전예약 응모' };
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
    title: '구매/예약/오리파 가이드',
    items: [
      {
        question: '공인점포와 취급점포는 무엇이 다른가요?',
        answer: '공인점포와 취급점포는 공식 홈페이지 기준의 매장 구분입니다. 지역별 검색, 내 주변순 정렬, 지도 바로가기는 /guide/shops에서 확인할 수 있습니다.'
      },
      {
        question: '온라인 오리파 이용 시 주의할 점은 무엇인가요?',
        answer: '온라인 오리파는 확률형 상품이므로 원하는 카드가 반드시 나오는 구조가 아닙니다. 이용 전 가격, 확률, 배송 가능 여부, 수수료, 관세 가능성을 확인하고 소액으로 먼저 테스트하는 것이 좋습니다.'
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
    title: '아마존 사전예약 응모 안내',
    description: '',
    sections: [
      {
        title: '이용 방법',
        type: 'steps',
        items: [
          '일본 아마존 계정으로 로그인합니다.',
          'OP-17 상품 페이지에 접속합니다.',
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
  },
  oripa: {
    title: '온라인 오리파란?',
    description: '',
    sections: [
      {
        title: '온라인 오리파 설명',
        paragraphs: [
          '온라인 오리파는 온라인에서 랜덤팩을 열고, 뽑힌 카드를 사이트 안에 보관하거나 판매하거나 실물 배송 신청을 할 수 있는 서비스입니다.'
        ],
        items: [
          '사이트 안에 카드 보관',
          '획득 카드 판매',
          '실물 배송 신청'
        ]
      },
      {
        title: '일반적인 흐름',
        type: 'steps',
        items: [
          '사이트 가입',
          '결제수단 연결 또는 포인트 충전',
          '원하는 팩 선택',
          '온라인으로 팩 오픈',
          '결과 카드 확인',
          '사이트 내 보관, 판매, 교환 또는 실물 배송 신청'
        ]
      },
      {
        title: '주의사항',
        items: [
          '온라인 오리파는 확률형 상품입니다.',
          '원하는 카드가 반드시 나오는 구조가 아닙니다.',
          '뽑기 비용보다 낮은 가치의 카드가 나올 수도 있습니다.'
        ]
      }
    ],
    platforms: [
      {
        id: 'beezie',
        label: 'Beezie',
        title: 'Beezie 사용법',
        description: '',
        sections: [
          {
            title: '기본 사용 흐름',
            type: 'steps',
            items: [
              'Beezie 사이트에 접속합니다.',
              '회원가입 또는 로그인을 진행합니다.',
              '원하는 뽑기 또는 마켓 메뉴를 선택합니다.',
              '상품 가격과 확률, 구성품을 확인합니다.',
              '결제 후 뽑기를 진행합니다.',
              '획득한 아이템을 계정 내 보관함에서 확인합니다.',
              '필요하면 실물 배송, 교환, 판매 기능을 이용합니다.'
            ]
          },
          {
            title: '확인할 점',
            items: [
              '배송 국가 지원 여부',
              '배송비',
              '보험 선택 여부',
              '관세 발생 가능성',
              '리딤 후 취소 가능 여부'
            ]
          }
        ]
      },
      {
        id: 'phygitals',
        label: 'Phygitals',
        title: 'Phygitals 사용법',
        description: '',
        sections: [
          {
            title: '기본 사용 흐름',
            type: 'steps',
            items: [
              'Phygitals 사이트에 접속합니다.',
              '회원가입 또는 로그인을 진행합니다.',
              'Packs 또는 Marketplace 메뉴를 확인합니다.',
              '원하는 카드팩이나 상품을 선택합니다.',
              '가격, 구성, 확률, 배송 조건을 확인합니다.',
              '결제 후 팩을 오픈합니다.',
              '획득한 카드를 계정 내에서 확인합니다.',
              '보관, 판매, 바이백 또는 실물 배송을 선택합니다.'
            ]
          },
          {
            title: '확인할 점',
            items: [
              '팩 가격',
              '카드별 확률',
              '바이백 가능 여부',
              '바이백 비율',
              '실물 배송 가능 여부',
              '배송비와 보험',
              '한국 배송 가능 여부',
              '관세 발생 가능성'
            ]
          }
        ]
      },
      {
        id: 'renaiss',
        label: 'Renaiss',
        title: 'Renaiss 사용법',
        description: '',
        sections: [
          {
            title: '기본 사용 흐름',
            type: 'steps',
            items: [
              'Renaiss 사이트에 접속합니다.',
              '회원가입 또는 지갑 연결을 진행합니다.',
              'Gacha 또는 Marketplace 메뉴를 확인합니다.',
              '원하는 팩이나 상품을 선택합니다.',
              '가격, 확률, 리딤 조건을 확인합니다.',
              '결제 또는 지갑 승인을 진행합니다.',
              '결과 아이템을 확인합니다.',
              '보관, 마켓 판매 또는 실물 리딤을 선택합니다.'
            ]
          },
          {
            title: '확인할 점',
            items: [
              '지갑 연결 필요 여부',
              '디지털 자산 구조 이해',
              '리딤 조건',
              '거래 취소 불가 가능성',
              '수수료 / 가스비 발생 가능성'
            ]
          }
        ]
      }
    ]
  }
};
const COUPANG_DISCLOSURE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
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

function normalizeSeriesSlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getSeriesSlug(series) {
  return normalizeSeriesSlug(series?.officialSeriesKeyword || getBaseSeriesId(series) || series?.id);
}

function getSeriesRoutePath(series) {
  const slug = getSeriesSlug(series);
  return slug ? `/cards/${slug}` : '/cards';
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
  if (/^https:\/\/(www\.)?onepiece-cardgame\.(com|kr)\//.test(source)) {
    if (typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname)) {
      return source;
    }
    return `/api/card-image?url=${encodeURIComponent(source)}`;
  }
  return source;
}

function getCardThumbnailKey(card) {
  if (!card?.id || !card?.locale) return '';
  return `cards/${card.locale}/${String(card.id).replace(/^[A-Z]+::/, '')}.webp`;
}

function getCardThumbnailSrc(card) {
  const key = getCardThumbnailKey(card);
  if (CARD_THUMBNAIL_BASE_URL === '/api/card-thumb' && key) {
    return `/api/card-thumb?key=${encodeURIComponent(key)}`;
  }
  return CARD_THUMBNAIL_BASE_URL && key
    ? `${CARD_THUMBNAIL_BASE_URL}/${key}`
    : getCardImageSrc(card);
}

function placeholderImage(event) {
  event.currentTarget.src = '/card-placeholder.svg';
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
  const fallbackSrc = event.currentTarget.dataset.fallbackSrc;
  if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
    event.currentTarget.src = fallbackSrc;
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

function makeMarketStateKey(item, grade) {
  return `MARKET::${item.code}::${item.apparelId || item.sourceUrl || item.name}::${grade}`;
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

function getMarketRangeChartPoints(conditionSeries = {}, listingConditionSeries = {}, range = '7d') {
  const primary = conditionSeries?.[range] || (range === '1y' ? conditionSeries?.all : []) || [];
  const listing = listingConditionSeries?.[range] || (range === '1y' ? listingConditionSeries?.all : []) || [];
  return primary.length ? primary : listing;
}

function resolveMarketChartRange(conditionSeries = {}, listingConditionSeries = {}, requestedRange = '7d') {
  const safeRange = MARKET_DETAIL_RANGE_KEYS.has(requestedRange) ? requestedRange : '7d';
  if (getMarketRangeChartPoints(conditionSeries, listingConditionSeries, safeRange).length) return safeRange;
  return MARKET_DETAIL_RANGES.find((item) => getMarketRangeChartPoints(conditionSeries, listingConditionSeries, item.key).length)?.key || safeRange;
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
  const response = await fetch(`/api/market?${params.toString()}`, { cache: 'no-store' });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  return payload;
}

async function fetchPsa10MarketPrice(cardId) {
  if (!cardId) return null;
  const params = new URLSearchParams({ cardId });
  const response = await fetch(`/api/psa10-market?${params.toString()}`, { cache: 'no-store' });
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
  const getKey = (record) => {
    if (record?.sourceUrl) return `url:${record.sourceUrl}`;
    return [record?.date || record?.soldAt || '', record?.price || '', record?.platform || record?.source || '', record?.title || ''].join('|');
  };
  const mergeRecords = (base = [], extra = [], order = 'desc') => {
    const merged = new Map();
    [...base, ...extra].filter(Boolean).forEach((record) => {
      const key = getKey(record);
      if (!merged.has(key)) merged.set(key, record);
    });
    return [...merged.values()].sort((a, b) => (
      order === 'asc' ? getTime(a) - getTime(b) : getTime(b) - getTime(a)
    ));
  };
  const pickLatest = (base, extra) => {
    if (!base) return extra || null;
    if (!extra) return base;
    return getTime(extra) > getTime(base) ? extra : base;
  };
  const basePsaSeries = detail.series?.psa10 || {};
  const extraPsaSeries = psaDetail.series?.psa10 || {};
  const basePsaRecent = detail.recentSalesByCondition?.psa10 || [];
  const extraPsaRecent = psaDetail.recentSalesByCondition?.psa10 || [];
  const hasPsaSupplement = Boolean(
    psaDetail.latestByCondition?.psa10
    || extraPsaRecent.length
    || extraPsaSeries['7d']?.length
    || extraPsaSeries['1m']?.length
    || extraPsaSeries['1y']?.length
    || extraPsaSeries.all?.length
  );
  if (!hasPsaSupplement) return detail;
  return {
    ...detail,
    conditions,
    latestByCondition: {
      ...(detail.latestByCondition || {}),
      psa10: pickLatest(detail.latestByCondition?.psa10, psaDetail.latestByCondition?.psa10)
    },
    series: {
      ...(detail.series || {}),
      psa10: {
        ...basePsaSeries,
        ...extraPsaSeries,
        '7d': mergeRecords(basePsaSeries['7d'], extraPsaSeries['7d'], 'asc'),
        '1m': mergeRecords(basePsaSeries['1m'], extraPsaSeries['1m'], 'asc'),
        '1y': mergeRecords(basePsaSeries['1y'] || basePsaSeries.all, extraPsaSeries['1y'] || extraPsaSeries.all, 'asc')
      }
    },
    recentSalesByCondition: {
      ...(detail.recentSalesByCondition || {}),
      psa10: mergeRecords(basePsaRecent, extraPsaRecent, 'desc')
    }
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
  { id: 'shops', labelKey: 'navShops' }
];
const VISIBLE_RENEW_HOME_UPDATES = RENEW_HOME_UPDATES.filter((item) => MARKETPLACE_ENABLED || item.id !== '2026-06-19-marketplace');
const UI_TEXT = {
  KR: {
    navCards: '도감',
    navPrices: '시세',
    navMarketplace: '거래',
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
    backToCatalog: '← 도감으로 돌아가기',
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
    usersTotal: '전체 회원 수',
    signupsToday: '오늘 가입자',
    footerIntro: 'Card Pone는 원피스 카드게임 유저를 위한 비공식 카드 도감·시세·컬렉션 관리 서비스입니다.',
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
    terms: '이용약관',
    privacy: '개인정보처리방침',
    contact: '문의하기',
    partnership: '광고/제휴 문의'
  },
  EN: {
    navCards: 'Cards',
    navPrices: 'Prices',
    navMarketplace: 'Trade',
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
    backToCatalog: '← Back to Cards',
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
    marketCardSortFocus: 'Featured',
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
    usersTotal: 'Total users',
    signupsToday: 'New users today',
    footerIntro: 'Card Pone is an unofficial card database, market price, and collection management service for ONE PIECE CARD GAME players.',
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
  ...(MARKETPLACE_TAB_VISIBLE ? { marketplace: '/market' } : {}),
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
PATH_PAGES['/deck'] = 'news';
PATH_PAGES['/deck-simulator'] = 'news';
const SITE_ORIGIN = 'https://www.optcgkorea.com';
function normalizeSitePath(pathname = '/') {
  const normalized = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return normalized === '' ? '/' : normalized;
}

function getRouteSeoPage(pathname = '/') {
  const path = normalizeSitePath(pathname);
  if (PATH_PAGES[path]) return PATH_PAGES[path];
  if (path.startsWith('/cards')) return 'cards';
  if (path.startsWith('/prices')) return 'prices';
  if (path.startsWith('/news') || path.startsWith('/guide') || path.startsWith('/faq')) return 'news';
  if (path.startsWith('/shops/partners')) return 'partnerShops';
  if (path.startsWith('/shops')) return 'shops';
  if (path.startsWith('/market')) return 'marketplace';
  return 'home';
}

function getCatalogRouteViewState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  const path = normalizeSitePath(pathname);
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
  const path = normalizeSitePath(pathname);
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
  const path = normalizeSitePath(pathname);
  if (!path.startsWith('/prices/box/')) return '';
  return path.slice('/prices/box/'.length).toUpperCase();
}

function getNewsRouteState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/', search = typeof window !== 'undefined' ? window.location.search : '') {
  const path = normalizeSitePath(pathname);
  const params = new URLSearchParams(search);
  if (path.startsWith('/guide')) return { section: 'guide', mode: 'guide' };
  if (path.startsWith('/faq')) return { section: 'guide', mode: 'qa' };
  return {
    section: params.get('section') || '',
    mode: params.get('mode') || ''
  };
}

function getShopRouteState(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  const path = normalizeSitePath(pathname);
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
  news: {
    title: '원피스카드 정보 - 공지사항, 가이드, 사전예약 | Card Pone',
    h1: '원피스카드 정보',
    description: '원피스카드 공식 소식, 업데이트 공지, 이용 가이드, 사전예약, 온라인 오리파, 카드 보관용품 정보를 확인할 수 있습니다.',
    keywords: 'Card Pone 정보, 원피스카드 공지사항, 원피스카드 뉴스, 원피스카드 가이드, 원피스카드 Q&A',
    body: '정보 영역에서는 업데이트 공지, 공식 소식, 사전예약, 온라인 오리파, 카드 보관용품, 이용 가이드를 확인할 수 있습니다.'
  },
  shops: {
    title: '원피스카드 구매처 - 지역별 공인점포 취급점포 | Card Pone',
    h1: '원피스카드 구매처',
    description: '지역별 원피스카드 오프라인 공인점포와 취급점포를 검색하고 지도 링크로 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스 카드 공인점포, 원피스카드 매장, 원피스카드 취급점포',
    body: '구매처 페이지에서는 지역별 오프라인 공인점포와 취급점포를 필터로 찾고 네이버지도 또는 카카오맵으로 위치를 확인할 수 있습니다.'
  },
  about: {
    title: 'Card Pone 소개 | 원피스카드 도감·시세·컬렉션 관리',
    h1: 'Card Pone 소개',
    description: 'Card Pone의 운영 목적, 제공 기능, 비공식 팬 서비스 고지와 문의 채널을 안내합니다.',
    keywords: 'Card Pone 소개, 원피스카드 도감, 원피스카드 시세, 원피스카드 컬렉션',
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
    title: 'OPTCG Collector Index | Card Pone',
    h1: 'OPTCG Collector Index',
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
  '/prices/index/sp': {
    title: 'OPTCG SP Index | Card Pone',
    h1: 'OPTCG SP Index',
    description: '원피스카드 SP 계열 카드 가격 흐름을 지수로 확인할 수 있습니다.',
    keywords: '원피스카드 SP, SP 카드 시세, OPTCG SP Index',
    body: '원피스카드 SP 계열 카드의 가격 흐름을 지수로 확인할 수 있습니다.'
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
  '/faq': {
    title: '원피스카드 Q&A | Card Pone',
    h1: '원피스카드 Q&A',
    description: '원피스카드 레어도, 패러렐, 박스 봉입률, 시세 확인에 대한 자주 묻는 질문을 정리합니다.',
    keywords: '원피스카드 Q&A, 원피스카드 FAQ, 원피스카드 레어도',
    body: '원피스카드 이용자가 자주 묻는 질문과 답변을 정리합니다.'
  }
};

function getClientRouteSeo(page) {
  if (typeof window === 'undefined') return null;
  const path = normalizeSitePath(window.location.pathname);
  const seoAliases = {
    '/prices/collector-index': '/prices/index',
    '/prices/manga-index': '/prices/index/manga',
    '/prices/premium-art-index': '/prices/index/premium-art',
    '/prices/sp-index': '/prices/index/sp',
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
  const path = normalizeSitePath(pathname);
  const hasSearch = Boolean(String(search || '').replace(/^\?/, ''));
  if (path.startsWith('/shops/partners/')) return { label: '제휴 카드샵으로 돌아가기', page: 'partnerShops' };
  if (path === '/shops/partners') return { label: '구매처로 돌아가기', page: 'shops' };
  if (path === '/' || (['/cards', '/prices', '/news', '/shops', '/market'].includes(path) && !hasSearch)) return null;
  if (path.startsWith('/cards')) return { label: '도감으로 돌아가기', page: 'cards' };
  if (path.startsWith('/prices') || (path === '/prices' && hasSearch)) return { label: '시세로 돌아가기', page: 'prices' };
  if (path.startsWith('/news') || path.startsWith('/guide') || path.startsWith('/faq')) return { label: '정보로 돌아가기', page: 'news' };
  if (path.startsWith('/shops')) return { label: '구매처로 돌아가기', page: 'shops' };
  if (path.startsWith('/market')) return { label: '거래로 돌아가기', page: 'marketplace' };
  if (['/about', '/data-policy', '/terms', '/privacy'].includes(path)) return { label: '홈으로 돌아가기', page: 'home' };
  return null;
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

function getPageJsonLd(page, seo) {
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
      inLanguage: 'ko-KR',
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
  return { '@context': 'https://schema.org', '@graph': graph };
}

function applyPageSeo(page) {
  const seo = getClientRouteSeo(page) || PAGE_SEO[page] || PAGE_SEO.home;
  const url = getCanonicalUrl(page);
  document.title = seo.title;
  setHeadMeta('meta[name="description"]', { content: seo.description });
  setHeadMeta('meta[name="keywords"]', { content: seo.keywords || '' });
  setHeadMeta('link[rel="canonical"]', { rel: 'canonical', href: url });
  setHeadMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  setHeadMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ko_KR' });
  setHeadMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
  setHeadMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
  setHeadMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  setHeadMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Card Pone' });
  setHeadMeta('meta[property="og:image"]', { property: 'og:image', content: `${SITE_ORIGIN}/og-card-pone.jpg` });
  setHeadMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  setHeadMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
  setHeadMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
  setHeadMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: `${SITE_ORIGIN}/og-card-pone.jpg` });
  setJsonLd('optcg-page-jsonld', getPageJsonLd(page, seo));
}

const TERMS_SECTIONS = [
  ['제1조 목적', '본 약관은 Card Pone가 제공하는 카드 도감, 시세 확인, 컬렉션 관리 및 관련 서비스의 이용 조건과 절차를 정함을 목적으로 합니다.'],
  ['제2조 서비스의 성격', '본 사이트는 원피스 카드게임 유저를 위한 비공식 정보 제공 서비스입니다.\n본 사이트는 BANDAI, ONE PIECE CARD GAME 공식 유통사 및 관련 권리자와 제휴되어 있지 않습니다.'],
  ['제3조 제공 서비스', '본 사이트는 카드 정보, 카드 시세, 컬렉션 관리, 위시리스트, 덱 시뮬레이터, 공지사항 등의 기능을 제공할 수 있습니다.'],
  ['제4조 시세 정보의 이용', '본 사이트에서 제공하는 시세 정보는 외부 거래 플랫폼, 공개 정보 또는 자체 수집 데이터를 기반으로 한 참고용 정보입니다.\n실제 거래 가격과 차이가 있을 수 있으며, 카드 구매·판매·투자 판단의 책임은 이용자 본인에게 있습니다.'],
  ['제5조 회원 및 계정', '이용자는 카카오 로그인 등 소셜 로그인 기능을 통해 서비스를 이용할 수 있습니다.\n이용자는 본인의 계정 정보를 안전하게 관리해야 하며, 계정 사용으로 발생하는 책임은 이용자에게 있습니다.'],
  ['제6조 금지행위', '이용자는 다음 행위를 해서는 안 됩니다.\n- 사이트의 정상적인 운영을 방해하는 행위\n- 허위 정보 입력 또는 타인의 계정 도용\n- 무단 크롤링, 자동화 프로그램을 이용한 과도한 접근\n- 저작권, 상표권 등 제3자의 권리를 침해하는 행위\n- 기타 법령 또는 공서양속에 반하는 행위'],
  ['제7조 광고 및 제휴', '본 사이트에는 Google AdSense 등 제3자 광고 서비스 또는 제휴 링크가 포함될 수 있습니다.\n광고 및 제휴 링크를 통해 발생하는 외부 사이트 이용에 대해서는 해당 외부 사이트의 정책이 적용됩니다.\n본 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.'],
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
  ['8. 개인정보 보호책임자', '개인정보 관련 문의는 아래 연락처로 문의할 수 있습니다.\n운영자: Card Pone\n이메일: optkr26@gmail.com'],
  ['9. 개인정보처리방침 변경', '본 개인정보처리방침은 법령, 서비스 변경 사항에 따라 수정될 수 있으며, 변경 시 사이트 공지사항 또는 본 페이지를 통해 안내합니다.\n시행일: 2026년 5월 28일']
];

const STATIC_INFO_PAGES = {
  about: {
    title: 'Card Pone 소개',
    lead: 'Card Pone는 원피스 카드게임 유저를 위한 비공식 카드 도감, 시세 확인, 컬렉션 관리 서비스입니다.',
    sections: [
      {
        title: '서비스 목적',
        body: [
          '한글판과 일본판 원피스 카드게임 카드를 한 곳에서 검색하고 비교할 수 있도록 정리합니다.',
          '카드별 시세, 박스 가격, 수집 진행도, 구매처 정보를 함께 제공해 수집 판단에 필요한 정보를 줄이는 것을 목표로 합니다.'
        ]
      },
      {
        title: '제공 기능',
        list: [
          '한글판·일본판 카드 도감 검색',
          '카드별 시세, 최근 거래 기록, 가격 그래프 확인',
          '박스 가격과 OPTCG Index 확인',
          '보유 카드, 위시리스트, 포트폴리오 관리',
          '지역별 공인점포·취급점포 검색',
          '공지사항, 사전예약, 가이드, Q&A 정보 제공'
        ]
      },
      {
        title: '운영 고지',
        body: [
          '본 사이트는 BANDAI 및 ONE PIECE CARD GAME 공식 유통사와 제휴된 공식 서비스가 아닙니다.',
          'ONE PIECE CARD GAME 관련 이미지, 명칭, 상표의 권리는 각 권리자에게 있습니다.',
          '시세 정보는 참고용이며 실제 거래 가격, 환율, 수수료, 배송비와 차이가 있을 수 있습니다.'
        ]
      },
      {
        title: '문의',
        body: ['서비스 오류, 데이터 수정, 광고·제휴 문의는 optkr26@gmail.com 으로 연락할 수 있습니다.']
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
          '소셜 로그인 정보: 카카오 계정 식별자, 닉네임, 프로필 이미지, 이메일',
          '서비스 이용 정보: 보유 카드, 위시리스트, 컬렉션 정보',
          '자동 수집 정보: 접속 IP, 브라우저 정보, 접속 기록, 쿠키, 기기 정보',
          '문의 시 수집 정보: 이메일 주소, 문의 내용'
        ]
      },
      {
        title: '이용 목적',
        list: [
          '회원 식별 및 로그인 기능 제공',
          '컬렉션 관리, 위시리스트, 보유 카드 저장 기능 제공',
          '서비스 이용 기록 관리 및 부정 이용 방지',
          '문의 응대 및 서비스 개선',
          '광고 표시 및 광고 성과 분석'
        ]
      },
      {
        title: '외부 서비스',
        body: [
          '본 사이트는 Supabase, Kakao Login, Google AdSense, 방문 통계 분석 도구를 사용할 수 있습니다.',
          '사용하는 외부 서비스가 변경될 경우 본 방침 또는 공지사항을 통해 안내합니다.'
        ]
      },
      {
        title: '문의 및 삭제 요청',
        body: ['개인정보 조회, 수정, 삭제, 처리 정지 요청은 optkr26@gmail.com 으로 접수할 수 있습니다.']
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
    news: <><path d="M15 18h-5" /><path d="M18 14h-8" /><path d="M18 10h-8" /><path d="M4 22h16a2 2 0 0 0 2-2V4H8a2 2 0 0 0-2 2v14a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" /></>,
    shops: <><path d="M20 10c0 4.5-8 12-8 12S4 14.5 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
    account: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
    supplies: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    dark: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9" />,
    light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[type] || paths.home}
    </svg>
  );
}

function RenewHeader({ activePage, onNavigate, onMobileNews, isDark, onToggleTheme, isLoggedIn, displayName, onAuthClick, uiLang, onUiLangChange }) {
  const t = (key) => getUiText(uiLang, key);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const handleAccountClick = () => {
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
        <button type="button" className="renew-mobile-logo" onClick={() => onNavigate('home')} aria-label="메인으로 이동">
          <img src={LOGO_SRC} alt="Card Pone" />
        </button>
        <div className="renew-mobile-actions">
          <button type="button" onClick={onToggleTheme} aria-label="테마 전환">
            <MobileNavIcon type={isDark ? 'light' : 'dark'} />
          </button>
          <div className={`renew-account-menu ${accountMenuOpen ? 'is-open' : ''}`}>
            <button type="button" onClick={handleAccountClick} aria-label={isLoggedIn ? displayName : t('login')}>
              <MobileNavIcon type="account" />
            </button>
            {isLoggedIn ? (
              <div className="renew-account-dropdown">
                <button type="button" onClick={() => handleAccountMenu('mypage')}>마이페이지</button>
                <button type="button" onClick={() => handleAccountMenu('logout')}>{t('logout')}</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="renew-nav">
        <button type="button" className="renew-logo-button" onClick={() => onNavigate('home')} aria-label="메인으로 이동">
          <img src={LOGO_SRC} alt="Card Pone" className="renew-logo" />
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
          <div className={`renew-account-menu ${accountMenuOpen ? 'is-open' : ''}`}>
            <button type="button" className="renew-pill is-filled renew-account-pill" onClick={handleAccountClick}>
              {isLoggedIn ? displayName : t('login')}
            </button>
            {isLoggedIn ? (
              <div className="renew-account-dropdown">
                <button type="button" onClick={() => handleAccountMenu('mypage')}>마이페이지</button>
                <button type="button" onClick={() => handleAccountMenu('logout')}>{t('logout')}</button>
              </div>
            ) : null}
          </div>
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
      <nav className="renew-bottom-nav" aria-label="모바일 하단 메뉴">
        <button type="button" className={activePage === 'cards' ? 'is-active' : ''} onClick={() => onNavigate('cards')} aria-label="도감">
          <MobileNavIcon type="cards" />
          <span>{t('navCards')}</span>
        </button>
        <button type="button" className={activePage === 'prices' ? 'is-active' : ''} onClick={() => onNavigate('prices')} aria-label="시세">
          <MobileNavIcon type="prices" />
          <span>{t('navPrices')}</span>
        </button>
        {MARKETPLACE_TAB_VISIBLE ? (
          <button type="button" className={activePage === 'marketplace' ? 'is-active' : ''} onClick={() => onNavigate('marketplace')} aria-label="거래">
            <MobileNavIcon type="marketplace" />
            <span>{t('navMarketplace')}</span>
          </button>
        ) : null}
        <button type="button" className={activePage === 'news' ? 'is-active' : ''} onClick={onMobileNews} aria-label="정보">
          <MobileNavIcon type="news" />
          <span>{t('navNews')}</span>
        </button>
        <button type="button" className={activePage === 'shops' ? 'is-active' : ''} onClick={() => onNavigate('shops')} aria-label="구매처">
          <MobileNavIcon type="shops" />
          <span>{t('navShops')}</span>
        </button>
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
        aria-label="카드명 또는 일련번호 검색"
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

function RenewSeoSummary({ page, titleAs = 'h1', placement = 'page' }) {
  const seo = PAGE_SEO[page] || PAGE_SEO.home;
  const Heading = titleAs;
  return (
    <section className={`renew-seo-summary renew-seo-summary-${page} renew-seo-summary-${placement}`} aria-label={`${seo.h1} 설명`}>
      <Heading>{seo.h1}</Heading>
      <p>{seo.body}</p>
    </section>
  );
}

function RenewAuthModal({ onClose, onSignedIn }) {
  useBodyScrollLock();
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

function RenewAccountModal({ authUser, userState, displayName, onClose, onLogout, onUserUpdated }) {
  useBodyScrollLock();
  const email = authUser?.email || '';
  const username = authUser?.user_metadata?.username || email.split('@')[0] || '-';
  const provider = authUser?.app_metadata?.provider || 'email';
  const [unlocked, setUnlocked] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nickname, setNickname] = useState(displayName || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

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
    if (!supabase || !nickname.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { ...(authUser?.user_metadata || {}), nickname: nickname.trim() }
      });
      if (error) throw error;
      onUserUpdated(data?.user || null);
      setMessage('닉네임이 변경되었습니다.');
    } catch (error) {
      setMessage(error?.message || '닉네임 변경에 실패했습니다.');
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

  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>마이페이지</h2>
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
            <div className="renew-account-summary">
              <div>
                <span>닉네임</span>
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
                <button type="button" onClick={saveNickname} disabled={loading || !nickname.trim()}>닉네임 변경</button>
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
                <strong>{provider === 'kakao' ? '카카오' : '일반 계정'}</strong>
              </div>
            </div>
            <div className="renew-account-actions">
              <button type="button" onClick={() => setPasswordOpen(true)} disabled={provider === 'kakao'}>비밀번호 변경</button>
              <button type="button" onClick={onLogout}>로그아웃</button>
            </div>
            {provider === 'kakao' ? <p className="renew-account-help">카카오 로그인 계정은 비밀번호 변경을 지원하지 않습니다.</p> : null}
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
      </div>
    </div>
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

function RenewHome({ authUser, userState, setUserState, stateLoading, adminStats, onSubmitSearch, onNavigateNews, onOpenIndex, onOpenPrices, uiLang }) {
  const [marketTotalJpy, setMarketTotalJpy] = useState(null);
  const [marketCards, setMarketCards] = useState([]);
  const [valueModalGrade, setValueModalGrade] = useState(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [renewalNoticeOpen, setRenewalNoticeOpen] = useState(false);
  const [partnerNewsOpen, setPartnerNewsOpen] = useState(false);
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
  const valuationEntries = Array.from(new Map([
    ...(userState?.ownedMarketItems && typeof userState.ownedMarketItems === 'object' ? Object.entries(userState.ownedMarketItems) : []),
    ...(userState?.valuationMarketItems && typeof userState.valuationMarketItems === 'object' ? Object.entries(userState.valuationMarketItems) : [])
  ]).entries());
  const storedTotalJpy = valuationEntries.reduce((sum, [, item]) => sum + normalizePortfolioPriceJpy(item), 0);
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
      const grade = normalizeMarketConditionKey(valuationGradeMap[key] || item.grade || 'a');
      try {
        const summary = await fetchMarketPrice({ code: item.code, apparelId: item.apparelId, summary: true });
        const livePrice = Number(getMarketConditionBucket(summary?.latestByCondition, grade)?.price || 0) || 0;
        const price = livePrice > 0 ? livePrice : normalizePortfolioPriceJpy(item);
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
        const price = normalizePortfolioPriceJpy(item);
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
  const homeNewsLinks = useMemo(() => getHomeNewsLinks(), []);
  const latestPartnerNews = useMemo(() => getActivePartnerShopNews()[0] || null, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(RENEWAL_NOTICE_KEY)) return;
    window.localStorage.setItem(RENEWAL_NOTICE_KEY, '1');
    setRenewalNoticeOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !latestPartnerNews || renewalNoticeOpen) return;
    const storageKey = `card-pone-partner-news-${latestPartnerNews.id}`;
    if (window.localStorage.getItem(storageKey)) return;
    setPartnerNewsOpen(true);
  }, [latestPartnerNews, renewalNoticeOpen]);

  function closePartnerNews() {
    if (typeof window !== 'undefined' && latestPartnerNews) {
      window.localStorage.setItem(`card-pone-partner-news-${latestPartnerNews.id}`, '1');
    }
    setPartnerNewsOpen(false);
  }

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
      <h1 className="renew-sr-only">{PAGE_SEO.home.h1}</h1>
      <p className="renew-sr-only">{PAGE_SEO.home.body}</p>
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
            <span>{authUser ? formatUsdWonFromYen(totalJpy) : t('portfolioLoginRequired')}</span>
          </div>
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
          <RenewHomeCollectorIndex onOpen={onOpenIndex} />
        </article>

        <article className="renew-float-card renew-home-news">
          <div className="renew-card-title">새 소식</div>
          <div className="renew-home-news-list">
            {homeNewsLinks.map((item) => (
              <button key={item.label} type="button" onClick={() => onNavigateNews?.(item.query)}>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <button type="button" className="renew-home-news-more" onClick={() => onNavigateNews?.('section=all')}>
            전체 소식 보기
          </button>
        </article>
      </section>
      <RenewPartnerAdSection uiLang={uiLang} />
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
      <button type="button" className="renew-home-updates-mini" onClick={() => setUpdatesOpen(true)}>
        <span>업데이트 내역</span>
      </button>
      {valueModalGrade ? (
        <RenewValueModal
          grade={valueModalGrade}
          cards={modalCards}
          onClose={() => setValueModalGrade(null)}
          onRemove={removeValuationCard}
          uiLang={uiLang}
          onOpenPrices={() => {
            setValueModalGrade(null);
            onOpenPrices?.();
          }}
        />
      ) : null}
      {updatesOpen ? <RenewUpdateModal onClose={() => setUpdatesOpen(false)} /> : null}
      {renewalNoticeOpen ? <RenewalNoticeModal onClose={() => setRenewalNoticeOpen(false)} /> : null}
      {partnerNewsOpen && latestPartnerNews ? (
        <PartnerShopNewsModal news={latestPartnerNews} uiLang={uiLang} onClose={closePartnerNews} />
      ) : null}
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

function RenewPartnerAdSection({ uiLang }) {
  const isEn = uiLang === 'EN';
  return (
    <section className="renew-partner-ad" aria-label={isEn ? 'Partner card shop news' : '제휴 카드샵 소식'}>
      <div className="renew-partner-ad-head">
        <span>{isEn ? 'Partner Shops' : '제휴 카드샵'}</span>
        <a className="renew-partner-ad-contact" href="mailto:optkr26@gmail.com?subject=Card%20Pone%20card%20shop%20partnership">
          {isEn ? 'Contact' : '제휴 문의'}
        </a>
      </div>
      <div className="renew-partner-ad-grid">
        {PARTNER_AD_ITEMS.map((item) => {
          const shopNews = null;
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
              <div className="renew-partner-ad-actions">
                <a href={getPartnerShopUrl(item)}>
                  {isEn ? 'Details' : '상세 보기'}
                </a>
                {(item.actions || []).filter((action) => action?.href).map((action) => {
                  const isExternal = action.href.startsWith('http');
                  return (
                  <a key={action.href} href={action.href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
                    {isEn ? action.labelEn : action.labelKr}
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
  const shops = PARTNER_AD_ITEMS;

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

  const renderShopCard = (item) => (
    <article key={item.key} className="renew-partner-seo-card">
      <a className="renew-partner-seo-card-link" href={getPartnerShopUrl(item)}>
        {item.imageUrl ? <img src={item.imageUrl} alt={item.titleEn || item.titleKr} loading="lazy" /> : null}
        <div>
          <small>{isEn ? 'Partner card shop' : '제휴 카드샵'}</small>
          <h2>{isEn ? item.titleEn : item.titleKr}</h2>
          <p>{isEn ? item.bodyEn : item.bodyKr}</p>
          {item.metaKr ? <em>{isEn ? item.metaEn : item.metaKr}</em> : null}
        </div>
      </a>
      {renderActions(item)}
    </article>
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
      <article className="renew-panel renew-partner-seo-list">
        <header className="renew-partner-seo-hero">
          <small>{isEn ? 'PARTNER SHOPS' : 'PARTNER SHOPS'}</small>
          <h1>{isEn ? 'Partner Card Shops' : '원피스카드 파는곳 - 제휴 카드샵'}</h1>
        </header>
        <div className="renew-partner-seo-grid">
          {shops.map(renderShopCard)}
        </div>
        <section className="renew-partner-seo-copy">
          <h2>{isEn ? 'How to use this page' : '원피스카드 매장 찾기'}</h2>
          <p>
            {isEn
              ? 'Use this page when you want to find nearby partner shops or check store channels before visiting.'
              : '원피스카드 파는곳을 찾을 때 제휴 카드샵 위치와 링크를 먼저 확인할 수 있습니다. 매장 방문 전 재고, 이벤트, 운영시간은 각 매장 채널에서 한 번 더 확인하는 것이 좋습니다.'}
          </p>
        </section>
      </article>
    </main>
  );
}

function RenewHomeCollectorIndex({ onOpen }) {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/market-index?type=collector&condition=a&range=7d', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!payload?.currentValue) return null;

  return (
    <button type="button" className="renew-home-index-summary" onClick={onOpen} aria-label="OPTCG Collector Index 바로가기">
      <div>
        <span>Collector Index</span>
        <strong>{formatIndexValue(payload.currentValue)}</strong>
      </div>
      <div className="renew-home-index-change">
        <em className={Number(payload?.change?.d1) >= 0 ? 'is-up' : 'is-down'}>1D {formatIndexChange(payload?.change?.d1)}</em>
        <em className={Number(payload?.change?.d7) >= 0 ? 'is-up' : 'is-down'}>7D {formatIndexChange(payload?.change?.d7)}</em>
      </div>
    </button>
  );
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

function RenewProgressModal({ progressData, locale, onLocaleChange, onClose }) {
  useBodyScrollLock();
  const [progressGroup, setProgressGroup] = useState('OP');
  const current = progressData[locale] || { owned: 0, total: 0, percent: 0, series: [] };
  const progressGroups = ['OP', 'EB', 'ST', 'PR'];
  const visibleSeries = useMemo(
    () => current.series.filter((series) => getProgressSeriesGroup(series) === progressGroup),
    [current.series, progressGroup]
  );
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
          <div className="renew-progress-groups" role="tablist" aria-label="시리즈 분류">
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
              <div className="renew-progress-empty">{progressGroup} 시리즈가 없습니다.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewValueModal({ grade, cards, onClose, onRemove, onOpenPrices, uiLang }) {
  useBodyScrollLock();
  const t = (key) => getUiText(uiLang, key);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => (window.innerWidth <= 560 ? 8 : 12));
  const imageCacheRef = useRef(loadPortfolioImageCache());
  const total = cards.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  const visibleCards = cards.slice(page * pageSize, page * pageSize + pageSize);
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
  }, [grade, pageSize]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const modal = (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal" onClick={(event) => event.stopPropagation()}>
        <div className="renew-modal-head">
          <div>
            <h2>{grade === 'psa10' ? 'PSA10 Collection' : 'Single Collection'}</h2>
            <p>{cards.length}장 · {formatUsdWonFromYen(total)}</p>
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
              <b>{formatUsdWonFromYen(item.price)}</b>
            </article>
          )) : (
            <div className="renew-empty-note renew-value-empty">
              <p>{t('portfolioEmptyHelp')}</p>
              <button type="button" onClick={onOpenPrices}>{t('goToPrices')}</button>
            </div>
          )}
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

function RenewNews({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialPath = typeof window !== 'undefined' ? normalizeSitePath(window.location.pathname) : '/news';
  const isCardStorageGuide = initialPath === '/guide/card-storage';
  const isShopBuyingGuide = initialPath === '/guide/shops';
  const isCardPriceGuide = initialPath === '/guide/card-price';
  const isCardCatalogGuide = initialPath === '/guide/card-catalog';
  const initialRouteState = getNewsRouteState(initialPath, typeof window !== 'undefined' ? window.location.search : '');
  const routeSection = initialPath === '/guide' || initialPath === '/faq'
    ? 'guide'
    : initialPath.startsWith('/news/official')
      ? 'notice'
      : initialPath.startsWith('/news/preorder')
        ? 'preorder'
        : initialPath.startsWith('/news/oripa')
          ? 'oripa'
          : initialPath.startsWith('/news/supplies')
            ? 'supplies'
            : '';
  const initialSection = initialRouteState.section || routeSection || initialParams.get('section') || 'all';
  const initialLocale = (initialParams.get('locale') || 'KR').toUpperCase();
  const [newsFilter, setNewsFilter] = useState(NEWS_FILTERS.some((item) => item.id === initialSection) ? initialSection : 'all');
  const [noticeLocale, setNoticeLocale] = useState(initialLocale === 'JP' ? 'JP' : 'KR');
  const [supplyFilter, setSupplyFilter] = useState('all');
  const [guideQaMode, setGuideQaMode] = useState(initialRouteState.mode === 'qa' || initialPath === '/faq' || initialParams.get('mode') === 'qa' ? 'qa' : 'guide');
  const [guideTarget, setGuideTarget] = useState(null);
  const officialTopics = OFFICIAL_TOPIC_ITEMS
    .filter((item) => (item.locale || '').toUpperCase() === noticeLocale)
    .slice(0, 3);
  const supplyItems = COUPANG_PARTNER_ITEMS
    .filter((item) => supplyFilter === 'all' || item.category === supplyFilter);
  const visibleLinkGroups = NEWS_LINK_GROUPS
    .filter((item) => newsFilter === 'all' || item.id === newsFilter);
  const showNotice = newsFilter === 'all' || newsFilter === 'notice';
  const showGuide = newsFilter === 'all' || newsFilter === 'guide';
  const showSupplies = newsFilter === 'all' || newsFilter === 'supplies';
  const showTopSection = showNotice || visibleLinkGroups.length > 0;
  const visibleGuideQaGroups = GUIDE_QA_GROUPS.filter((group) => group.kind === guideQaMode);
  return (
    <main className="renew-main renew-news-main">
      <div className="renew-news-filter-tabs" role="group" aria-label="뉴스 분류">
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
      </div>

      {showTopSection ? (
        <div className={`renew-news-overview ${newsFilter !== 'all' ? 'is-filtered' : ''}`}>
          {showNotice ? (
          <section className="renew-news-card renew-news-notice-card" aria-labelledby="official-news-heading">
            <div className="renew-news-card-head">
              <div>
                <span>OFFICIAL NEWS</span>
                <h2 id="official-news-heading">공지사항</h2>
              </div>
              <div className="renew-news-toggle" role="group" aria-label="공지 언어 선택">
                <button type="button" className={noticeLocale === 'KR' ? 'is-active' : ''} onClick={() => setNoticeLocale('KR')}>한글판</button>
                <button type="button" className={noticeLocale === 'JP' ? 'is-active' : ''} onClick={() => setNoticeLocale('JP')}>일본판</button>
              </div>
            </div>
            <div className="renew-topic-list renew-topic-list-compact">
              {officialTopics.map((item) => (
                <article key={item.id} className="renew-topic-card">
                  <a className={`renew-topic-thumb${item.imageUrl ? '' : ' is-empty'}`} href={item.url} target="_blank" rel="noreferrer" aria-label={item.title}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span>{item.locale}</span>}
                  </a>
                  <div className="renew-topic-body">
                    <div className="renew-topic-meta">
                      <span>{TOPIC_SOURCE_LABEL[item.source] || item.locale || '공식'}</span>
                      <span>{item.category}</span>
                      <time dateTime={item.date}>{item.date}</time>
                    </div>
                    <h2>{item.title}</h2>
                    <a href={item.url} target="_blank" rel="noreferrer">원문 보기</a>
                  </div>
                </article>
              ))}
            </div>
          </section>
          ) : null}

          {visibleLinkGroups.length ? (
          <div className={`renew-news-links ${visibleLinkGroups.length === 1 ? 'is-single' : ''}`} aria-label="예약구매 및 온라인 오리파">
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

      {showGuide && !isCardStorageGuide && !isShopBuyingGuide && !isCardPriceGuide && !isCardCatalogGuide ? (
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
          <a className="renew-guide-feature-link" href="/guide/card-storage">
            <span>STORAGE GUIDE</span>
            <strong>원피스카드 보관 방법</strong>
            <small>슬리브, 탑로더, 카드세이버, 바인더 보관 기준을 확인합니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/shops">
            <span>SHOP GUIDE</span>
            <strong>원피스카드 사는 방법</strong>
            <small>공인점포, 취급점포, 지역별 검색과 내 주변 구매처 찾는 방법을 확인합니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/card-price">
            <span>PRICE GUIDE</span>
            <strong>원피스카드 시세 보는 방법</strong>
            <small>카드 가격, 박스 가격, 최근 거래 기록과 기간별 그래프를 확인하는 방법을 정리했습니다.</small>
          </a>
          <a className="renew-guide-feature-link" href="/guide/card-catalog">
            <span>CATALOG GUIDE</span>
            <strong>원피스카드 도감 사용법</strong>
            <small>한글판, 일본판, OP/EB/ST/PR 시리즈와 일련번호 검색 방법을 확인합니다.</small>
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

      <RenewSeoSummary page="news" titleAs="h1" placement="footer" />
      {guideTarget ? (
        <RenewNewsGuideModal
          guideId={guideTarget}
          onClose={() => setGuideTarget(null)}
        />
      ) : null}
    </main>
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
          <div className="renew-news-guide-tabs" role="group" aria-label="오리파 플랫폼 선택">
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
            <section key={section.title} className="renew-static-info-card">
              <h2>{section.title}</h2>
              {Array.isArray(section.body) ? section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              )) : null}
              {Array.isArray(section.list) ? (
                <ul>
                  {section.list.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

function RenewLegalModal({ type, onClose }) {
  useBodyScrollLock();
  const isPrivacy = type === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  return (
    <div className="renew-modal-backdrop" onClick={onClose}>
      <div className="renew-info-modal renew-legal-modal" onClick={(event) => event.stopPropagation()}>
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
    </div>
  );
}

function RenewCatalog({ authUser, userState, setUserState, initialSearch, initialViewState, restoreScrollY = null, onRestoreScrollDone, onViewStateChange, onOpenMarket, onOpenMarketplace, marketListings = [], uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const hasInitialSearch = Boolean(initialSearch?.q);
  const initialLocale = hasInitialSearch ? (initialSearch?.locale || 'JP') : (initialViewState?.locale || 'JP');
  const [locale, setLocale] = useState(initialLocale);
  const [selectedSeries, setSelectedSeries] = useState(() => hasInitialSearch ? getDefaultRenewSeriesId(initialLocale) : (initialViewState?.selectedSeries || getDefaultRenewSeriesId(initialLocale)));
  const [openSection, setOpenSection] = useState('');
  const [searchKeyword, setSearchKeyword] = useState(hasInitialSearch ? initialSearch.q : (initialViewState?.searchKeyword || ''));
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
      fetch('/api/market?summary=latest', { cache: 'no-store' })
        .then((res) => res.ok ? res.json() : null)
        .catch(() => null),
      fetch('/api/psa10-market?summary=latest', { cache: 'no-store' })
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
    if (localeSeries.some((series) => series.id === selectedSeries)) return;
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
    setExpandedDeferredRarities(new Set());
  }, [locale, selectedSeries, searchKeyword, activeRarity, collectionFilter]);

  useEffect(() => {
    if (loading || restoreScrollY == null || typeof window === 'undefined') return undefined;
    const targetY = Math.max(0, Number(restoreScrollY) || 0);
    const restore = () => window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
    const frameId = window.requestAnimationFrame(restore);
    const timerId = window.setTimeout(() => {
      restore();
      onRestoreScrollDone?.();
    }, 220);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, [loading, restoreScrollY, onRestoreScrollDone]);

  useEffect(() => {
    onViewStateChange?.({
      locale,
      selectedSeries,
      searchKeyword,
      activeRarity,
      collectionFilter,
      catalogSortMode
    });
  }, [locale, selectedSeries, searchKeyword, activeRarity, collectionFilter, catalogSortMode, onViewStateChange]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/box-market', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !Array.isArray(payload?.items)) return;
        setSeriesBoxImageByCode((current) => {
          const next = new Map(current);
          payload.items.forEach((item) => {
            if (item?.code && item?.previewImageUrl) next.set(item.code, item.previewImageUrl);
          });
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
              ? await fetchCards(isAllSeriesMode ? { locale } : { locale, series: selectedSeries })
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

  async function openCard(cardId) {
    const detail = await fetchCardById(cardId).catch(() => null);
    setSelectedCard(detail || cards.find((card) => card.id === cardId) || null);
  }

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
      url: `${SITE_ORIGIN}/cards`
    });
  }, [selectedCard, locale]);

  const selectCatalogSeries = (series, options = {}) => {
    setSelectedSeries(series.id);
    setSearchKeyword('');
    setActiveRarity('ALL');
    if (options.closeSection) setOpenSection('');
    if (typeof window !== 'undefined') {
      const nextPath = getSeriesRoutePath(series);
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, '', nextPath);
      }
    }
  };

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
                <button
                  key={series.id}
                  type="button"
                  className={`renew-series-item ${selectedSeries === series.id && !searchKeyword.trim() ? 'is-active' : ''}`}
                  onClick={() => selectCatalogSeries(series, { closeSection: true })}
                >
                  <RenewSeriesOptionContent series={series} boxImageByCode={seriesBoxImageByCode} />
                </button>
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
                    <button
                      key={series.id}
                      type="button"
                      className={`renew-series-item ${selectedSeries === series.id && !searchKeyword.trim() ? 'is-active' : ''}`}
                      onClick={() => selectCatalogSeries(series)}
                    >
                      <RenewSeriesOptionContent series={series} boxImageByCode={seriesBoxImageByCode} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <section className="renew-catalog-main">
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
            <span className="renew-chip-group-label">{uiLang === 'EN' ? 'View' : '보기'}</span>
            <button type="button" className={collectionFilter === 'all' ? 'is-active' : ''} onClick={() => setCollectionFilter('all')}>{t('all')}</button>
            <button type="button" className={collectionFilter === 'owned' ? 'is-active' : ''} onClick={() => setCollectionFilter('owned')}>{t('owned')}</button>
            <button type="button" className={collectionFilter === 'wish' ? 'is-active' : ''} onClick={() => setCollectionFilter('wish')}>{t('wishlist')}</button>
          </div>
          <div className="renew-chip-group renew-catalog-sort-group">
            <span className="renew-chip-group-label">{uiLang === 'EN' ? 'Sort' : '정렬'}</span>
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
                        <b>{card.cardNo}</b>
                        <div className="renew-card-price-row" title={card.name}>
                          <span className="renew-card-price-chip">
                            <em>Single</em>
                            <b>{catalogMarketPrice?.priceUsd ? formatCatalogWonFromUsd(catalogMarketPrice.priceUsd) : '-'}</b>
                          </span>
                          <span className="renew-card-price-chip">
                            <em>PSA10</em>
                            <b>{catalogMarketPrice?.psa10PriceUsd ? formatCatalogWonFromUsd(catalogMarketPrice.psa10PriceUsd) : '-'}</b>
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

      <RenewSeoSummary page="cards" titleAs="h1" placement="footer" />
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

function RenewCardModal({ card, onClose, onOpenMarket, onSearchSameName, marketListingCount = 0, onOpenMarketplace, uiLang }) {
  useBodyScrollLock();
  const t = (key) => getUiText(uiLang, key);
  const [snkrdunkApparelId, setSnkrdunkApparelId] = useState(null);
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
            {snkrdunkUrl ? <a href={snkrdunkUrl} target="_blank" rel="noreferrer">{t('openSnkrdunk')}</a> : null}
            {marketListingCount ? (
              <button type="button" className="renew-modal-market-link" onClick={() => onOpenMarketplace?.(card)}>
                관련 매물 {marketListingCount}개 보기
              </button>
            ) : null}
            <button type="button" onClick={() => onSearchSameName?.(card.name)}>{t('searchSameName')}</button>
            {card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer">{t('officialInfo')}</a> : null}
          </div>
        </div>
      </div>
    </div>
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
  const isMarketplaceAdmin = authUser?.user_metadata?.username === 'admin';
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
                      <img src={getCardThumbnailSrc(registerLinkedCard)} alt={registerLinkedCard.name || registerLinkedCard.cardNo} loading="lazy" />
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
                          <img src={getCardThumbnailSrc(card)} alt={card.name || card.cardNo} loading="lazy" />
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

function RenewRouteBackButton({ label = '뒤로가기', onClick }) {
  return (
    <div className="renew-route-back-wrap" data-nosnippet>
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
  const isLongMarketRange = range === '1y' || range === 'all';
  const orderedPoints = isLongMarketRange
    ? compressMarketAllChartPoints(aggregatedPoints, isMobileChart ? 72 : 108)
    : aggregatedPoints;
  if (!orderedPoints.length) {
    return <div className="renew-chart-placeholder"><span>{t('noChart')}</span></div>;
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
      const midX = (previous.x + point.x) / 2;
      const midY = (previous.y + point.y) / 2;
      return `${path} Q ${previous.x} ${previous.y} ${midX} ${midY}`;
    }, '') + ` L ${plotted[plotted.length - 1].x} ${plotted[plotted.length - 1].y}`
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
  const rangeLabel = range === '1d' ? '1D' : range === '1m' ? '1M' : range === '1y' ? '1Y' : range === '6m' ? '6M' : range === 'all' ? 'ALL' : '7D';

  return (
    <div className="renew-market-chart-box">
      <span className="renew-chart-range-label">{rangeLabel}</span>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="시세 그래프" preserveAspectRatio="none">
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
        <text className="renew-chart-boundary-label is-max" x={padX + 4} y={Math.max(22, maxLabelY - 8)}>{formatUsd(maxBoundaryPrice / MARKET_USD_TO_JPY)}</text>
        <text className="renew-chart-boundary-label is-min" x={padX + 4} y={Math.min(height - 14, minLabelY + 22)}>{formatUsd(minBoundaryPrice / MARKET_USD_TO_JPY)}</text>
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
            aria-label={`${formatMarketDate(point.timestamp)} ${formatUsdWonFromYen(point.price)}`}
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
            <text className="renew-chart-tip-price" x={tipX + 14} y={tipY + 46}>{formatUsdWonFromYen(active.price)}</text>
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
  { key: 'collector', label: 'Collector', title: 'OPTCG Collector Index' },
  { key: 'manga', label: 'Manga', title: 'OPTCG Manga Index' },
  { key: 'premium_art', label: 'Premium Art', title: 'OPTCG Premium Art Index' },
  { key: 'sp', label: 'SP', title: 'OPTCG SP Index' },
  { key: 'luffy', label: 'Luffy', title: 'OPTCG Luffy Index' },
];
const MARKET_SECTOR_INDEX_OPTIONS = MARKET_INDEX_OPTIONS.filter((item) => item.key !== 'collector');
const MARKET_INDEX_COMPONENTS_PER_PAGE = 8;

function getMarketIndexTypeFromPath(path) {
  const aliasMap = {
    '/prices/collector-index': 'collector',
    '/prices/manga-index': 'manga',
    '/prices/waifu-index': 'premium_art',
    '/prices/premium-art-index': 'premium_art',
    '/prices/sp-index': 'sp',
    '/prices/luffy-index': 'luffy'
  };
  if (aliasMap[path]) return aliasMap[path];
  const slug = path.startsWith('/prices/index/') ? path.slice('/prices/index/'.length) : '';
  const legacyMap = { collector: 'collector', manga: 'manga', waifu: 'premium_art', premium: 'premium_art', 'premium-art': 'premium_art', sp: 'sp', luffy: 'luffy' };
  return legacyMap[slug] || 'collector';
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

function RenewMarketIndex() {
  const [payload, setPayload] = useState(null);
  const [indexType, setIndexType] = useState(() => {
    if (typeof window === 'undefined') return 'collector';
    const path = normalizeSitePath(window.location.pathname);
    return getMarketIndexTypeFromPath(path);
  });
  const [range, setRange] = useState('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [componentPage, setComponentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const selectedIndex = MARKET_INDEX_OPTIONS.find((item) => item.key === indexType) || MARKET_INDEX_OPTIONS[0];

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setComponentPage(1);
    setLoading(true);
    fetch(`/api/market-index?type=${encodeURIComponent(indexType)}&condition=a&range=${range}`, { cache: 'no-store' })
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

  const components = Array.isArray(payload?.components) ? payload.components.filter((item) => item.hasData) : [];
  const componentPageCount = Math.max(1, Math.ceil(components.length / MARKET_INDEX_COMPONENTS_PER_PAGE));
  const visibleComponents = components.slice((componentPage - 1) * MARKET_INDEX_COMPONENTS_PER_PAGE, componentPage * MARKET_INDEX_COMPONENTS_PER_PAGE);
  return (
    <section className="renew-box-market renew-index-market">
      <div className="renew-index-head">
        <div>
          <span>Index</span>
          <h2>{selectedIndex.title}</h2>
        </div>
        <div className="renew-chip-group">
          <button type="button" className={range === '1d' ? 'is-active' : ''} onClick={() => setRange('1d')}>1D</button>
          <button type="button" className={range === '7d' ? 'is-active' : ''} onClick={() => setRange('7d')}>7D</button>
          <button type="button" className={range === '1m' ? 'is-active' : ''} onClick={() => setRange('1m')}>1M</button>
          <button type="button" className={range === '6m' ? 'is-active' : ''} onClick={() => setRange('6m')}>6M</button>
          <button type="button" className={range === 'all' ? 'is-active' : ''} onClick={() => setRange('all')}>ALL</button>
        </div>
      </div>
      <div className="renew-index-primary" aria-label="Representative market index">
        <button
          type="button"
          className={indexType === 'collector' ? 'is-active' : ''}
          onClick={() => {
            setIndexType('collector');
            setDetailsOpen(false);
          }}
        >
          <span>Core Benchmark</span>
          <strong>OPTCG Collector Index</strong>
        </button>
      </div>
      <div className="renew-index-sector-head">
        <span>Sector Index</span>
        <em>Manga, Premium Art, SP, Luffy</em>
      </div>
      <div className="renew-index-tabs" aria-label="Market sector index type">
        {MARKET_SECTOR_INDEX_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={indexType === option.key ? 'is-active' : ''}
            onClick={() => {
              setIndexType(option.key);
              setDetailsOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="renew-index-summary">
        <strong>{loading ? '...' : formatIndexValue(payload?.currentValue)}</strong>
        <span>Base 100 · {payload?.index?.baseDate || '2025-01-01'}</span>
        <div>
          <em className={Number(payload?.change?.d1) >= 0 ? 'is-up' : 'is-down'}>1D {formatIndexChange(payload?.change?.d1)}</em>
          <em className={Number(payload?.change?.d7) >= 0 ? 'is-up' : 'is-down'}>7D {formatIndexChange(payload?.change?.d7)}</em>
          <em className={Number(payload?.change?.m1) >= 0 ? 'is-up' : 'is-down'}>1M {formatIndexChange(payload?.change?.m1)}</em>
          <em className={Number(payload?.change?.m6) >= 0 ? 'is-up' : 'is-down'}>6M {formatIndexChange(payload?.change?.m6)}</em>
          <em className={Number(payload?.change?.all) >= 0 ? 'is-up' : 'is-down'}>ALL {formatIndexChange(payload?.change?.all)}</em>
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
            <span>Single SNKRDUNK 일별 중앙값 기준</span>
          </div>
          <div className="renew-index-components">
            {visibleComponents.map((item) => (
              <article key={item.apparelId}>
                <b>{item.code}</b>
                <strong>{item.name}</strong>
                <span>{item.note} · #{item.apparelId}</span>
                <div className="renew-index-component-metrics">
                  <em>{formatIndexValue(item.currentIndex)}</em>
                  <i className={Number.isFinite(Number(item.change?.d1)) ? Number(item.change?.d1) >= 0 ? 'is-up' : 'is-down' : ''}>1D {formatIndexChange(item.change?.d1)}</i>
                </div>
              </article>
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
  const [sortMode, setSortMode] = useState('latest');
  const [boxPage, setBoxPage] = useState(1);
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
  useEffect(() => {
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
              <small>SNKRDUNK #{box.apparelId}</small>
              <b>{box.minPrice ? formatUsdWonFromUsd(box.minPrice) : t('checkPrice')}</b>
            </div>
          </a>
        ))}
      </div>
      {totalBoxPages > 1 && (
        <div className="renew-box-market-pager" aria-label={uiLang === 'en' ? 'Box price pages' : '박스 시세 페이지'}>
          <button type="button" disabled={currentBoxPage <= 1} onClick={() => setBoxPage((page) => Math.max(1, page - 1))}>
            {uiLang === 'en' ? 'Prev' : '이전'}
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
            {uiLang === 'en' ? 'Next' : '다음'}
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

function getMarketCandidatePriceText(item, fallbackText) {
  const livePriceJpy = Number(item?.displayPriceJpy || item?.latestPriceJpy || 0);
  if (livePriceJpy > 0) return formatUsdWonFromYen(livePriceJpy);
  const staticPriceUsd = Number(item?.minPrice || 0);
  return staticPriceUsd > 0 ? formatUsdWonFromUsd(staticPriceUsd) : fallbackText;
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
  const [sortMode, setSortMode] = useState('focus');
  const [items, setItems] = useState([]);

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
    const source = withPrice.length ? withPrice : items;
    const sorted = [...source].sort((a, b) => {
      if (sortMode === 'high') return (Number(b.minPrice) || 0) - (Number(a.minPrice) || 0);
      return getMarketFocusScore(b) - getMarketFocusScore(a);
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

function RenewMarket({ authUser, userState, setUserState, initialCode, initialApparelId, initialCardId, onBackToCatalog, uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [code, setCode] = useState(initialCode || '');
  const [marketProductLocale, setMarketProductLocale] = useState('JP');
  const [homeTab, setHomeTab] = useState(() => {
    if (typeof window === 'undefined') return 'box';
    const path = normalizeSitePath(window.location.pathname);
    if (isMarketIndexPath(path)) return 'index';
    if (path.startsWith('/prices/product/') || path.startsWith('/prices/card/')) return 'card';
    if (path.startsWith('/prices/box/')) return 'box';
    if (path === '/prices/cards') return 'card';
    if (path === '/prices/boxes') return 'box';
    return new URLSearchParams(window.location.search).get('tab') === 'index' ? 'index' : 'box';
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
  const marketDetailRef = useRef(null);
  const marketCandidateRef = useRef(null);
  const marketCandidateScrollYRef = useRef(0);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      searchMarket(initialCode, initialApparelId);
      return;
    }
    if (initialApparelId) {
      loadMarketCards()
        .then((items) => {
          const item = items.find((candidate) => String(candidate.apparelId) === String(initialApparelId));
          if (!item?.code) return;
          setCode(item.code);
          searchMarket(item.code, initialApparelId);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, initialApparelId]);

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

  async function searchMarket(nextCode = code, targetApparelId = null) {
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
      const primaryLocale = String(marketProductLocale || 'JP').toUpperCase();
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
      const shouldSortCandidatesByPrice = !targetApparelId && !exactCodeResult.length;
      const result = expandedResult
        .filter((item) => {
          if (targetApparelId && String(item.apparelId) === String(targetApparelId)) return true;
          if (exactCodeResult.length && normalizeCode(item.code) === normalized) return true;
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

  async function addValuation(grade) {
    if (!authUser || !selected) {
      window.alert(t('loginRequired'));
      return;
    }
    const gradeKey = normalizeMarketConditionKey(grade);
    const key = makeMarketStateKey(selected, gradeKey);
    const approvedLink = await findApprovedCardMarketLinkByApparelId(selected.apparelId);
    const linkedCard = approvedLink?.cardId ? await fetchCardById(approvedLink.cardId) : null;
    const linkedImageUrl = linkedCard?.imageUrl || linkedCard?.image_url || linkedCard?.image || selected.previewImageUrl;
    const livePriceJpy = Number(getMarketConditionBucket(marketDetail?.latestByCondition, gradeKey)?.price || 0) || 0;
    const fallbackPriceUsd = Number(selected.minPrice || 0) || 0;
    const valuationPriceJpy = livePriceJpy > 0
      ? livePriceJpy
      : (fallbackPriceUsd > 0 ? Math.round(fallbackPriceUsd * MARKET_USD_TO_JPY) : 0);
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
          minPrice: valuationPriceJpy,
          priceCurrency: 'JPY',
          fallbackPriceUsd
        }
      },
      valuationCardGrades: {
        ...(userState?.valuationCardGrades || {}),
        [key]: gradeKey
      }
    };
    setUserState(nextState);
    await saveMyState({ ...nextState, __changedFields: ['valuationMarketItems', 'valuationCardGrades'] });
    const gradeLabel = grade === 'a'
      ? (uiLang === 'en' ? 'Single Grade' : 'Single등급')
      : (uiLang === 'en' ? 'PSA10 Grade' : 'PSA10등급');
    window.alert(`${gradeLabel} ${t('addedToPortfolio')}`);
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
  const listingConditionSeries = getMarketConditionBucket(marketDetail?.listingSeriesByCondition, normalizedCondition) || {};
  const chartRange = resolveMarketChartRange(conditionSeries, listingConditionSeries, marketRange);
  const chartPoints = getMarketRangeChartPoints(conditionSeries, listingConditionSeries, chartRange);
  const recentSales = getMarketConditionBucket(marketDetail?.recentSalesByCondition, normalizedCondition) || [];
  const recentSalesInRange = recentSales.filter((sale) => {
    const timestamp = Number(sale?.timestamp || 0);
    return timestamp && Date.now() - timestamp <= RECENT_SALES_VISIBLE_MS;
  });
  const recentSalesVisible = recentSalesInRange.length ? recentSalesInRange : recentSales;
  const currentPrice = selectedLatest?.price ? formatUsdWonFromYen(selectedLatest.price) : getMarketCandidatePriceText(selected, t('checkPrice'));
  const latestSourceUrl = selectedLatest?.sourceUrl || '';
  const psaSourceUrl = normalizedCondition === 'psa10' && latestSourceUrl && !/snkrdunk\.com/i.test(latestSourceUrl)
    ? latestSourceUrl
    : recentSales.find((sale) => sale?.sourceUrl && !/snkrdunk\.com/i.test(sale.sourceUrl))?.sourceUrl || '';
  const currentPriceLabel = normalizedCondition === 'psa10' ? t('psa10IntegratedPrice') : t('snkrLowestPrice');
  const showMarketHome = !code.trim() && !selected && !candidates.length;
  const canMapInitialCard = authUser?.user_metadata?.username === 'admin' && Boolean(initialCardId);

  useEffect(() => {
    if (!selected) {
      setJsonLd('optcg-market-detail-jsonld', null);
      return;
    }
    setJsonLd('optcg-market-detail-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: getMarketShortName(selected),
      sku: selected.code,
      image: selected.previewImageUrl,
      description: selected.setName || selected.name,
      url: `${SITE_ORIGIN}/prices?code=${encodeURIComponent(selected.code)}&apparelId=${encodeURIComponent(selected.apparelId || '')}`,
      offers: selectedLatest?.price ? {
        '@type': 'Offer',
        price: Math.round((selectedLatest.price / MARKET_USD_TO_JPY) * 100) / 100,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: selected.sourceUrl
      } : undefined
    });
  }, [selected, selectedLatest]);

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
              <button type="button" className={homeTab === 'index' ? 'is-active' : ''} onClick={() => setHomeTab('index')}>Index</button>
            </div>
            {homeTab === 'box' ? <RenewBoxMarket uiLang={uiLang} initialBoxCode={getBoxRouteCode()} /> : homeTab === 'card' ? <RenewCardMarket uiLang={uiLang} marketLocale={marketProductLocale} /> : <RenewMarketIndex />}
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
                            <b>{getMarketCandidatePriceText(item, t('checkPrice'))}</b>
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
            {candidates.length > 1 ? (
              <button type="button" className="renew-market-detail-back" onClick={returnToMarketCandidates}>
                ← {t('reselectVariant')}
              </button>
            ) : null}
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
                <button type="button" onClick={() => addValuation('a')}><span className="renew-action-full">{t('addAGrade')}</span><span className="renew-action-compact">{t('addAGradeShort')}</span></button>
                <button type="button" onClick={() => addValuation('psa10')}><span className="renew-action-full">{t('addPsa10')}</span><span className="renew-action-compact">{t('addPsa10Short')}</span></button>
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
                    <strong>{formatUsdWonFromYen(sale.price)}</strong>
                  </div>
                ))}
                {!recentSalesVisible.length ? <div className="renew-empty">{t('noRecentSales')}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
      <RenewSeoSummary page="prices" titleAs="h1" placement="footer" />
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
      <RenewSeoSummary page="shops" titleAs="h1" placement="footer" />
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

function getShopMapLinks(shop) {
  const lat = Number(shop?.lat);
  const lng = Number(shop?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const naverKeyword = encodeURIComponent(shop?.name || '');
  const keyword = encodeURIComponent([shop?.name, shop?.address].filter(Boolean).join(' '));
  return {
    naver: `https://map.naver.com/p/search/${naverKeyword}`,
    kakao: hasCoords
      ? `https://map.kakao.com/link/map/${encodeURIComponent(shop?.name || '매장')},${lat},${lng}`
      : `https://map.kakao.com/?q=${keyword}`
  };
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

function RenewShops({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const initialShopRouteState = getShopRouteState();
  const [type, setType] = useState(initialShopRouteState && initialShopRouteState.type ? initialShopRouteState.type : '');
  const [sido, setSido] = useState(initialShopRouteState && initialShopRouteState.sido ? initialShopRouteState.sido : '전체');
  const [gungu, setGungu] = useState('전체');
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [regions, setRegions] = useState({ sidos: [], gungus: [] });
  const [shops, setShops] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    fetchShopRegions(type, sido).then(setRegions).catch(() => setRegions({ sidos: [], gungus: [] }));
  }, [type, sido]);

  useEffect(() => {
    fetchShops({ type, sido, gungu, q: query }).then((items) => setShops(Array.isArray(items) ? items : []));
  }, [type, sido, gungu, query]);

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
          <a href="/shops/partners">{uiLang === 'EN' ? 'View' : '보기'}</a>
        </div>
        <div className="renew-shop-filters">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">{t('allShops')}</option>
            <option value="official">{t('officialShop')}</option>
            <option value="general">{t('searchShop')}</option>
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
    return window.localStorage.getItem(UI_LANG_STORAGE_KEY) === 'EN' ? 'EN' : 'KR';
  });
  const [authUser, setAuthUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userState, setUserState] = useState(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [visitorToken, setVisitorToken] = useState('');
  const [legalOpen, setLegalOpen] = useState(null);
  const [catalogInitialSearch, setCatalogInitialSearch] = useState(null);
  const [catalogViewState, setCatalogViewState] = useState(() => getCatalogRouteViewState());
  const [catalogReturnScrollY, setCatalogReturnScrollY] = useState(null);
  const [canReturnToCatalog, setCanReturnToCatalog] = useState(false);
  const [marketInitialCode, setMarketInitialCode] = useState('');
  const [marketInitialApparelId, setMarketInitialApparelId] = useState(null);
  const [marketInitialCardId, setMarketInitialCardId] = useState('');
  const [marketListings, setMarketListings] = useState(MARKETPLACE_SAMPLE_LISTINGS);
  const [marketFilterCardId, setMarketFilterCardId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('cardId') || '';
  });
  const [deckComingSoonOpen, setDeckComingSoonOpen] = useState(false);
  const [newsComingSoonOpen, setNewsComingSoonOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const internalNavigationRef = useRef(false);

  const pageTitle = useMemo(() => getUiText(uiLang, NAV_ITEMS.find((item) => item.id === activePage)?.labelKey), [activePage, uiLang]);
  const displayName = useMemo(() => getUserDisplayName(authUser), [authUser]);
  const t = (key) => getUiText(uiLang, key);

  useEffect(() => {
    applyPageSeo(activePage);
  }, [activePage]);

  useEffect(() => {
    if (window.location.pathname === '/deck' || window.location.pathname === '/deck-simulator') {
      window.history.replaceState(null, '', '/news');
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
    if (activePage === 'prices') {
      const routeState = getMarketRouteState(window.location.pathname, window.location.search);
      setMarketInitialCode(routeState.code);
      setMarketInitialApparelId(routeState.apparelId);
      setMarketInitialCardId(routeState.cardId);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextPage = getPageFromPath(window.location.pathname);
      if (nextPage === 'home') {
        setCatalogInitialSearch(null);
        setCatalogViewState(null);
      }
      if (nextPage === 'cards') {
        setCatalogViewState(getCatalogRouteViewState(window.location.pathname));
      }
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

  function navigatePage(page, options = {}) {
    if (page === 'marketplace' && !MARKETPLACE_TAB_VISIBLE) {
      page = 'home';
    }
    if (page === 'deck') {
      setDeckComingSoonOpen(true);
      return;
    }
    const path = PAGE_PATHS[page] || '/';
    const query = options.query ? `?${options.query}` : '';
    const nextUrl = `${path}${query}`;
    if (page === 'marketplace') {
      window.location.assign(nextUrl);
      return;
    }
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
      setCanReturnToCatalog(false);
    }
    if (window.location.pathname + window.location.search !== nextUrl) {
      internalNavigationRef.current = true;
      window.history.pushState(null, '', nextUrl);
    }
  }

  function openLegal(type) {
    setLegalOpen(type);
    internalNavigationRef.current = true;
    window.history.pushState(null, '', `/${type}`);
  }

  function closeLegal() {
    setLegalOpen(null);
    if (window.location.pathname === '/privacy' || window.location.pathname === '/terms') {
      window.history.pushState(null, '', PAGE_PATHS[activePage] || '/');
    }
  }

  function openMobileNews() {
    navigatePage('news');
  }

  const routeBackInfo = getRouteBackInfo(window.location.pathname, window.location.search);

  function handleRouteBack() {
    if (!routeBackInfo) return;
    const sameOriginReferrer = document.referrer && document.referrer.startsWith(SITE_ORIGIN);
    if (internalNavigationRef.current || sameOriginReferrer) {
      window.history.back();
      return;
    }
    navigatePage(routeBackInfo.page);
  }

  return (
    <div className={`renew-app ${isDark ? 'is-dark' : ''}`}>
      <RenewHeader
        activePage={activePage}
        onNavigate={navigatePage}
        onMobileNews={openMobileNews}
        isDark={isDark}
        onToggleTheme={() => setIsDark((value) => !value)}
        isLoggedIn={Boolean(authUser)}
        displayName={displayName}
        onAuthClick={handleAuthClick}
        uiLang={uiLang}
        onUiLangChange={setUiLang}
      />
      {routeBackInfo ? <RenewRouteBackButton label={routeBackInfo.label} onClick={handleRouteBack} /> : null}
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
          onNavigateNews={(query) => navigatePage('news', { query })}
          onOpenIndex={() => {
            setMarketInitialCode('');
            setMarketInitialApparelId(null);
            setMarketInitialCardId('');
            setCanReturnToCatalog(false);
            navigatePage('prices', { query: 'tab=index' });
          }}
          onOpenPrices={() => navigatePage('prices')}
        />
      ) : activePage === 'cards' ? (
        <RenewCatalog
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          initialSearch={catalogInitialSearch}
          initialViewState={catalogViewState}
          restoreScrollY={catalogReturnScrollY}
          onRestoreScrollDone={() => setCatalogReturnScrollY(null)}
          onViewStateChange={setCatalogViewState}
          onOpenMarket={(marketTarget) => {
            const nextCode = typeof marketTarget === 'object' ? marketTarget?.code : marketTarget;
            const nextApparelId = typeof marketTarget === 'object' ? marketTarget?.apparelId : null;
            const nextCardId = typeof marketTarget === 'object' ? marketTarget?.cardId : '';
            setCatalogReturnScrollY(typeof window !== 'undefined' ? window.scrollY : null);
            setMarketInitialCode(nextCode || '');
            setMarketInitialApparelId(nextApparelId || null);
            setMarketInitialCardId(nextCardId || '');
            setCanReturnToCatalog(true);
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
          marketListings={MARKETPLACE_ENABLED ? marketListings : []}
          uiLang={uiLang}
        />
      ) : activePage === 'prices' ? (
        <RenewMarket
          authUser={authUser}
          userState={userState}
          setUserState={setUserState}
          initialCode={marketInitialCode}
          initialApparelId={marketInitialApparelId}
          initialCardId={marketInitialCardId}
          onBackToCatalog={canReturnToCatalog ? () => navigatePage('cards') : null}
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
      ) : activePage === 'news' ? (
        <RenewNews uiLang={uiLang} />
      ) : activePage === 'partnerShops' ? (
        <RenewPartnerShopSeoPage uiLang={uiLang} />
      ) : activePage === 'shops' ? (
        <RenewShops uiLang={uiLang} />
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
      {accountOpen && authUser ? (
        <RenewAccountModal
          authUser={authUser}
          userState={userState}
          displayName={displayName}
          onClose={() => setAccountOpen(false)}
          onLogout={handleLogout}
          onUserUpdated={(user) => {
            if (user) setAuthUser(user);
          }}
        />
      ) : null}
      {deckComingSoonOpen ? <RenewComingSoonModal uiLang={uiLang} onClose={() => setDeckComingSoonOpen(false)} /> : null}
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
          <a href="/about">소개</a>
          <span>·</span>
          <a href="/data-policy">데이터 운영 정책</a>
          <span>·</span>
          <a href="/terms">{t('terms')}</a>
          <span>·</span>
          <a href="/privacy">{t('privacy')}</a>
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
