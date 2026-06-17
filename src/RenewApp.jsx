import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  'OP-16': 'The Time of Battle'
};
const THEME_STORAGE_KEY = 'one-piece-tcg-theme';
const UI_LANG_STORAGE_KEY = 'one-piece-tcg-ui-lang';
const VISITOR_TOKEN_KEY = 'one-piece-tcg-visitor-token';
const RENEWAL_NOTICE_KEY = 'one-piece-tcg-news-notice-2026-06-11';
const PORTFOLIO_IMAGE_CACHE_KEY = 'one-piece-tcg-portfolio-image-cache-v2';
const RECENT_SALES_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;
const RARITY_ORDER = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const DEFERRED_RARITIES = new Set(['C', 'UC']);
const RENEW_HOME_UPDATES = [
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

function getHomeNewsLinks() {
  const jpTopic = OFFICIAL_TOPIC_ITEMS.find((item) => (item.locale || '').toUpperCase() === 'JP');
  const preorderLink = NEWS_LINK_GROUPS.find((item) => item.id === 'preorder')?.links?.[0];
  return HOME_NEWS_LINKS.map((item) => {
    if (item.query === 'section=preorder' && preorderLink?.label) {
      return { ...item, label: preorderLink.label, description: 'Amazon Japan 사전예약 응모' };
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
        question: 'OPTCG Korea는 어떤 사이트인가요?',
        answer: 'OPTCG Korea는 원피스 카드게임 유저를 위한 비공식 카드 도감, 시세 확인, 구매처 검색, 컬렉션 관리 서비스입니다. 한글판과 일본판 카드를 검색하고 보유 카드, 위시리스트, Portfolio를 한 곳에서 관리할 수 있습니다.'
      },
      {
        question: '일련번호 검색과 카드명 검색은 어떻게 다른가요?',
        answer: '일련번호 검색은 OP05-119, ST21-014처럼 카드 일련번호를 기준으로 정확한 후보를 찾는 방식입니다. 카드명 검색은 루피, 야마토처럼 이름을 기준으로 관련 카드를 찾는 방식이며, 일본판에서도 가능한 범위 안에서 한글 이름 검색을 지원합니다.'
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
        answer: 'OP는 정규 부스터팩, EB는 엑스트라 부스터 또는 프리미엄 부스터 계열, ST는 스타터덱, PR은 프로모 카드 계열입니다. 도감에서는 이 분류를 기준으로 한글판과 일본판 카드를 빠르게 좁혀 볼 수 있습니다.'
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
        answer: '시세 탭에서 카드 일련번호를 검색하면 같은 일련번호를 가진 시세 후보가 표시됩니다. 후보가 여러 개라면 일반판, 패러렐, 프로모 등 원하는 버전을 선택한 뒤 상세 시세를 확인하면 됩니다.'
      },
      {
        question: '시세 정보는 어떻게 봐야 하나요?',
        answer: '시세 정보는 외부 거래 데이터와 현재 매물 정보를 참고해 보여주는 보조 지표입니다. 실제 구매가, 판매가, 배송비, 관세, 카드 상태에 따라 최종 가격은 달라질 수 있으므로 거래 전 원문 페이지와 최종 결제 화면을 함께 확인해야 합니다.'
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
        answer: '공인점포는 공식 이벤트나 제품 취급 기준을 충족한 매장이고, 취급점포는 원피스 카드게임 제품을 판매하는 매장입니다. 구매처 페이지에서 지역과 시군구 기준으로 매장을 찾고 지도 링크로 이동할 수 있습니다.'
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
        answer: 'OP는 정규 부스터팩 계열, EB는 엑스트라 부스터 계열, ST는 스타터덱 계열, PR은 프로모 카드 계열을 뜻합니다. 카드 일련번호 앞부분을 보면 어떤 상품 계열에서 나온 카드인지 대략 구분할 수 있습니다.'
      },
      {
        question: 'OP05-119 같은 일련번호는 어떻게 읽나요?',
        answer: 'OP05-119는 OP-05 계열 상품에 포함된 119번 카드를 뜻합니다. 같은 일련번호라도 일반판, 패러렐, 특별 일러스트, 프로모 변형이 존재할 수 있어 이미지와 등급을 함께 확인하는 것이 안전합니다.'
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
        answer: '공식 카드명은 일본어 기준이지만, OPTCG Korea에서는 가능한 범위에서 한글 카드명 검색도 함께 지원합니다. 다만 번역명과 표기 차이가 있을 수 있어 일련번호 검색이 가장 정확합니다.'
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
        answer: '슬리브는 기본 보호용, 탑로더는 배송이나 단기 보관용, 자석케이스는 고가 카드의 전시와 장기 보관용으로 많이 사용됩니다. 고가 카드는 슬리브를 먼저 씌운 뒤 추가 보호 케이스에 넣는 방식이 안전합니다.'
      },
      {
        question: '카드 휘어짐을 줄이려면 어떻게 해야 하나요?',
        answer: '습도와 온도 변화가 큰 곳을 피하고, 직사광선과 압력을 받는 보관을 피하는 것이 좋습니다. 슬리브와 보관함을 사용하고, 장기간 보관할 때는 카드가 과하게 눌리거나 휘지 않도록 공간을 안정적으로 유지해야 합니다.'
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
        answer: 'PSA10은 PSA 감정에서 최고 등급인 Gem Mint 10을 받은 상태를 뜻합니다. 일반 카드 가격과 달리 카드 상태, 감정 결과, 케이스 보관 상태, 감정 수요가 가격에 함께 반영됩니다.'
      },
      {
        question: '시세 정보는 실제 거래가와 같나요?',
        answer: '시세 정보는 거래 판단을 돕는 참고 자료입니다. 실제 거래 가격은 판매처, 배송비, 관세, 환율, 카드 상태, 결제 시점에 따라 달라질 수 있으므로 최종 구매나 판매 결정은 사용자가 직접 확인해야 합니다.'
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

function fallbackToOriginalCardImage(event) {
  const fallbackSrc = event.currentTarget.dataset.fallbackSrc;
  if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
    event.currentTarget.src = fallbackSrc;
    return;
  }
  placeholderImage(event);
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

function formatYenWon(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '가격 정보 없음';
  return `${formatYen(amount)} / ${formatWonFromYen(amount)}`;
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
    : [{ key: 'a', label: 'A등급' }, { key: 'psa10', label: 'PSA10' }];
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
        all: mergeRecords(basePsaSeries.all, extraPsaSeries.all, 'asc')
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
  { id: 'news', labelKey: 'navNews' },
  { id: 'shops', labelKey: 'navShops' }
];
const UI_TEXT = {
  KR: {
    navCards: '도감',
    navPrices: '시세',
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
    addAGrade: 'A등급 추가',
    addAGradeShort: 'A 추가',
    addPsa10: 'PSA10등급 추가',
    addPsa10Short: 'PSA10 추가',
    aGrade: 'A등급',
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
    snkrLowestPrice: 'SNKRDUNK 최저가',
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
    addAGrade: 'Add A Grade',
    addAGradeShort: 'Add A',
    addPsa10: 'Add PSA10 Grade',
    addPsa10Short: 'Add PSA10',
    aGrade: 'A Grade',
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
    snkrLowestPrice: 'SNKRDUNK Lowest',
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
  news: '/news',
  shops: '/shops',
  statsPrototype: '/stats-prototype'
};
const PATH_PAGES = Object.fromEntries(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]));
PATH_PAGES['/deck'] = 'news';
PATH_PAGES['/deck-simulator'] = 'news';
const SITE_ORIGIN = 'https://www.optcgkorea.com';
const PAGE_SEO = {
  home: {
    title: 'OPTCG Korea - 원피스카드 도감, 시세, 컬렉션 관리',
    h1: '원피스카드 도감·시세·컬렉션 관리',
    description: 'OPTCG Korea는 원피스카드 유저를 위한 비공식 카드 도감, 시세 확인, 컬렉션 관리 서비스입니다.',
    keywords: '원피스카드, 원피스 카드게임, 원피스카드 도감, 원피스카드 시세, 원피스카드 구매처, OPTCG, OPTCG Korea',
    body: 'OPTCG Korea는 원피스카드 유저가 한글판·일본판 카드 도감, 카드별 시세, 컬렉션 관리, 구매처 정보를 한 곳에서 확인할 수 있는 비공식 팬 서비스입니다.'
  },
  cards: {
    title: '원피스카드 도감 - 한글판 일본판 카드 검색 | OPTCG Korea',
    h1: '원피스카드 도감',
    description: '한글판과 일본판 원피스카드의 OP, EB, ST, 프로모 카드를 카드명과 일련번호로 검색할 수 있습니다.',
    keywords: '원피스카드 도감, 원피스 카드 검색, OP16, OP15, 일본판 원피스카드, 한글판 원피스카드',
    body: '원피스카드 도감에서는 한글판과 일본판 카드를 OP, EB, ST, 프로모 시리즈별로 확인하고 카드명 또는 일련번호로 검색할 수 있습니다.'
  },
  prices: {
    title: '원피스카드 시세 - 카드별 시세 그래프와 박스 가격 | OPTCG Korea',
    h1: '원피스카드 시세',
    description: '원피스카드별 시세, 박스 가격, 일본판과 한글판 거래 가격 흐름을 확인할 수 있습니다.',
    keywords: '원피스카드 시세, 원피스 카드 가격, 원피스카드 박스 시세, PSA10 시세, SNKRDUNK 원피스카드',
    body: '시세 페이지에서는 카드별 거래 가격, 박스 가격, 최근 거래 내역과 7일, 1개월, 전체 기간 그래프를 확인할 수 있습니다.'
  },
  news: {
    title: '원피스카드 정보 - 공지사항, 가이드, 사전예약 | OPTCG Korea',
    h1: '원피스카드 정보',
    description: '원피스카드 공식 소식, 업데이트 공지, 이용 가이드, 사전예약, 온라인 오리파, 카드 보관용품 정보를 확인할 수 있습니다.',
    keywords: 'OPTCG Korea 정보, 원피스카드 공지사항, 원피스카드 뉴스, 원피스카드 가이드, 원피스카드 Q&A',
    body: '정보 영역에서는 업데이트 공지, 공식 소식, 사전예약, 온라인 오리파, 카드 보관용품, 이용 가이드를 확인할 수 있습니다.'
  },
  shops: {
    title: '원피스카드 구매처 - 지역별 공인점포 취급점포 | OPTCG Korea',
    h1: '원피스카드 구매처',
    description: '지역별 원피스카드 오프라인 공인점포와 취급점포를 검색하고 지도 링크로 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스 카드 공인점포, 원피스카드 매장, 원피스카드 취급점포',
    body: '구매처 페이지에서는 지역별 오프라인 공인점포와 취급점포를 필터로 찾고 네이버지도 또는 카카오맵으로 위치를 확인할 수 있습니다.'
  }
};

function getPageFromPath(pathname = '/') {
  return PATH_PAGES[pathname] || 'home';
}

function getCanonicalUrl(page) {
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
    { '@type': 'ListItem', position: 1, name: 'OPTCG Korea', item: SITE_ORIGIN },
    { '@type': 'ListItem', position: 2, name: seo.h1, item: url }
  ];
  const graph = [
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
  if (page === 'news') {
    graph.push({
      '@type': 'FAQPage',
      name: 'OPTCG Korea 이용 가이드',
      mainEntity: GUIDE_QA_GROUPS.flatMap((group) => group.items).slice(0, 10).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    });
    graph.push({
      '@type': 'Article',
      headline: 'OPTCG Korea 업데이트 안내',
      description: seo.description,
      author: { '@type': 'Organization', name: 'OPTCG Korea' },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      mainEntityOfPage: url
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function applyPageSeo(page) {
  const seo = PAGE_SEO[page] || PAGE_SEO.home;
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
  setHeadMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'OPTCG Korea' });
  setHeadMeta('meta[property="og:image"]', { property: 'og:image', content: `${SITE_ORIGIN}/og-preview.jpg` });
  setHeadMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  setHeadMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
  setHeadMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
  setHeadMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: `${SITE_ORIGIN}/og-preview.jpg` });
  setJsonLd('optcg-page-jsonld', getPageJsonLd(page, seo));
}

const TERMS_SECTIONS = [
  ['제1조 목적', '본 약관은 OPTCG Korea가 제공하는 카드 도감, 시세 확인, 컬렉션 관리 및 관련 서비스의 이용 조건과 절차를 정함을 목적으로 합니다.'],
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
  ['8. 개인정보 보호책임자', '개인정보 관련 문의는 아래 연락처로 문의할 수 있습니다.\n운영자: OPTCG Korea\n이메일: optkr26@gmail.com'],
  ['9. 개인정보처리방침 변경', '본 개인정보처리방침은 법령, 서비스 변경 사항에 따라 수정될 수 있으며, 변경 시 사이트 공지사항 또는 본 페이지를 통해 안내합니다.\n시행일: 2026년 5월 28일']
];

function MobileNavIcon({ type }) {
  const paths = {
    home: <><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
    cards: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5a1 1 0 0 1 1 1V5a1 1 0 0 0-1-1h-5a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4a1 1 0 0 0-1 1z" /></>,
    prices: <><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></>,
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
          <img src={LOGO_SRC} alt="ONE PIECE CARD GAME" />
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
        <button type="button" className={activePage === 'home' ? 'is-active' : ''} onClick={() => onNavigate('home')} aria-label="홈">
          <MobileNavIcon type="home" />
        </button>
        <button type="button" className={activePage === 'cards' ? 'is-active' : ''} onClick={() => onNavigate('cards')} aria-label="도감">
          <MobileNavIcon type="cards" />
        </button>
        <button type="button" className={activePage === 'prices' ? 'is-active' : ''} onClick={() => onNavigate('prices')} aria-label="시세">
          <MobileNavIcon type="prices" />
        </button>
        <button type="button" onClick={onMobileNews} aria-label="뉴스">
          <MobileNavIcon type="news" />
        </button>
        <button type="button" className={activePage === 'shops' ? 'is-active' : ''} onClick={() => onNavigate('shops')} aria-label="구매처">
          <MobileNavIcon type="shops" />
        </button>
      </nav>
    </header>
  );
}

function RenewSuppliesModal({ onClose }) {
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

function RenewHome({ authUser, userState, setUserState, stateLoading, adminStats, onSubmitSearch, onNavigateNews, uiLang }) {
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
  const homeNewsLinks = useMemo(() => getHomeNewsLinks(), []);

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
        <strong>{RENEW_HOME_UPDATES[0].title.match(/\[[^\]]+\]/)?.[0] ?? ''} {RENEW_HOME_UPDATES[0].summary}</strong>
      </button>
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
        <span>NEWS UPDATE</span>
        <h2>News 탭 업데이트가 완료되었습니다.</h2>
        <p>
          한글판·일본판 공식 공지사항, OP-17 아마존 사전예약 응모,
          온라인 오리파, 가이드/Q&A, 카드 보관용품 바로가기를 확인할 수 있습니다.
        </p>
        <button type="button" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

function RenewProgressModal({ progressData, locale, onLocaleChange, onClose }) {
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
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const pageCount = Math.ceil(RENEW_HOME_UPDATES.length / pageSize);
  const items = RENEW_HOME_UPDATES.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
  const initialSection = initialParams.get('section') || 'all';
  const initialLocale = (initialParams.get('locale') || 'KR').toUpperCase();
  const [newsFilter, setNewsFilter] = useState(NEWS_FILTERS.some((item) => item.id === initialSection) ? initialSection : 'all');
  const [noticeLocale, setNoticeLocale] = useState(initialLocale === 'JP' ? 'JP' : 'KR');
  const [supplyFilter, setSupplyFilter] = useState('all');
  const [guideQaMode, setGuideQaMode] = useState(initialParams.get('mode') === 'qa' ? 'qa' : 'guide');
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
      <RenewSeoSummary page="news" titleAs="h1" placement="page" />
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

      {showGuide ? (
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

function RenewNewsGuideModal({ guideId, onClose }) {
  const guide = NEWS_GUIDE_CONTENT[guideId];
  const [platformId, setPlatformId] = useState('');
  const activePlatform = guide?.platforms?.find((item) => item.id === platformId) || null;
  useEffect(() => {
    if (!guide) return undefined;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [guide]);
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
  const [openSection, setOpenSection] = useState('');
  const [searchKeyword, setSearchKeyword] = useState(hasInitialSearch ? initialSearch.q : (initialViewState?.searchKeyword || ''));
  const [activeRarity, setActiveRarity] = useState(hasInitialSearch ? 'ALL' : (initialViewState?.activeRarity || 'ALL'));
  const [collectionFilter, setCollectionFilter] = useState(hasInitialSearch ? 'all' : (initialViewState?.collectionFilter || 'all'));
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [expandedDeferredRarities, setExpandedDeferredRarities] = useState(() => new Set());
  const [rarityPanelOpen, setRarityPanelOpen] = useState(false);
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
    const nextSeries = getDefaultRenewSeriesId(locale);
    setSelectedSeries(nextSeries);
    setOpenSection('');
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

  const visibleCards = useMemo(() => {
    return cards.filter((card) => {
      const rarityOk = activeRarity === 'ALL' || getRarityBucket(card.rarity) === activeRarity;
      const collectionOk = collectionFilter === 'owned'
        ? ownedSet.has(card.id)
        : collectionFilter === 'wish'
          ? wishSet.has(card.id)
          : true;
      return rarityOk && collectionOk;
    });
  }, [cards, activeRarity, collectionFilter, ownedSet, wishSet]);

  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cards)], [cards]);
  const mobileRarityOptions = ['ALL', 'SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C'];
  const groupedCards = useMemo(() => groupByRarity(visibleCards), [visibleCards]);

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
                  onClick={() => {
                    setSelectedSeries(series.id);
                    setSearchKeyword('');
                    setActiveRarity('ALL');
                    setOpenSection('');
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
        </div>
      </aside>

      <section className="renew-catalog-main">
        <RenewSeoSummary page="cards" titleAs="h1" placement="page" />
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
          <div className="renew-chip-group">
            <button type="button" className={collectionFilter === 'all' ? 'is-active' : ''} onClick={() => setCollectionFilter('all')}>{t('all')}</button>
            <button type="button" className={collectionFilter === 'owned' ? 'is-active' : ''} onClick={() => setCollectionFilter('owned')}>{t('owned')}</button>
            <button type="button" className={collectionFilter === 'wish' ? 'is-active' : ''} onClick={() => setCollectionFilter('wish')}>{t('wishlist')}</button>
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
          const shouldLimitGroup = activeRarity === 'ALL' && collectionFilter === 'all' && (
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
                      {owned ? <span className="renew-owned-badge">{t('owned')}</span> : null}
                    </div>
                      <div className="renew-card-body">
                        <b>{card.cardNo}</b>
                        <strong>{card.name}</strong>
                        <div className="renew-card-actions" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className={owned ? 'is-owned' : ''} onClick={() => toggleListValue('ownedCardIds', card.id)}>{owned ? 'O' : 'X'}</button>
                        <button type="button" className={wished ? 'is-wished' : ''} onClick={() => toggleListValue('wishlistCardIds', card.id)}>♥</button>
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

function RenewMarketChart({ points = [], uiLang, range }) {
  const t = (key) => getUiText(uiLang, key);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [isMobileChart, setIsMobileChart] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobileChart(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  const orderedPoints = points
    .map((point) => ({
      ...point,
      timestamp: Number(point.timestamp || 0),
      price: Number(point.price || 0)
    }))
    .filter((point) => Number.isFinite(point.timestamp) && point.timestamp > 0 && point.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
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
  const outlierMin = iqr > 0 ? Math.max(min, q1 - iqr * 1.5) : min;
  const outlierMax = iqr > 0 ? Math.min(max, q3 + iqr * 1.5) : max;
  const useOutlierScale = points.length >= 6 && outlierMax > outlierMin && (outlierMin > min || outlierMax < max);
  const scaleMinBase = useOutlierScale ? outlierMin : min;
  const scaleMaxBase = useOutlierScale ? outlierMax : max;
  const scalePadding = Math.max((scaleMaxBase - scaleMinBase) * 0.16, scaleMaxBase * 0.012, 1000);
  const scaleMin = Math.max(0, scaleMinBase - scalePadding);
  const scaleMax = scaleMaxBase + scalePadding;
  const priceRange = Math.max(scaleMax - scaleMin, 1);
  const maxLabelPrice = Math.min(scaleMax, Math.max(scaleMin, max));
  const minLabelPrice = Math.min(scaleMax, Math.max(scaleMin, min));
  const maxLabelY = padTop + ((scaleMax - maxLabelPrice) / priceRange) * (height - padTop - padBottom);
  const minLabelY = padTop + ((scaleMax - minLabelPrice) / priceRange) * (height - padTop - padBottom);
  const minTime = orderedPoints[0].timestamp;
  const maxTime = orderedPoints[orderedPoints.length - 1].timestamp;
  const timeRange = Math.max(maxTime - minTime, 1);
  const plotted = orderedPoints.map((point) => {
    const x = padX + ((width - padX * 2) * (point.timestamp - minTime) / timeRange);
    const price = Number(point.price || 0);
    const clampedPrice = Math.min(scaleMax, Math.max(scaleMin, price));
    const y = padTop + ((scaleMax - clampedPrice) / priceRange) * (height - padTop - padBottom);
    return { ...point, x, y, isClamped: price !== clampedPrice };
  });
  const path = plotted.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${plotted[plotted.length - 1].x} ${height - padBottom} L ${plotted[0].x} ${height - padBottom} Z`;
  const active = plotted[hoverIndex ?? plotted.length - 1];
  const tipX = active ? Math.min(active.x + 12, width - tipWidth - 8) : 0;
  const tipY = active ? Math.max(active.y - tipHeight - 10, 8) : 0;
  const midPoint = plotted[Math.floor((plotted.length - 1) / 2)] || plotted[0];
  const axisLabels = [
    { key: 'start', className: 'is-start', x: padX, text: formatChartAxisDate(plotted[0]?.timestamp) },
    { key: 'middle', className: 'is-middle', x: midPoint?.x || width / 2, text: formatChartAxisDate(midPoint?.timestamp) },
    { key: 'end', className: 'is-end', x: width - padX, text: formatChartAxisDate(plotted[plotted.length - 1]?.timestamp) }
  ].filter((item) => item.text);
  const rangeLabel = range === '1m' ? '1M' : range === 'all' ? 'ALL' : '7D';

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
        <text className="renew-chart-boundary-label is-max" x={padX + 4} y={Math.max(22, maxLabelY - 8)}>{formatYen(max)}</text>
        <text className="renew-chart-boundary-label is-min" x={padX + 4} y={Math.min(height - 14, minLabelY + 22)}>{formatYen(min)}</text>
        <path d={area} className="renew-chart-area" />
        <path d={path} className="renew-chart-line" />
        {axisLabels.map((item) => (
          <text key={item.key} className={`renew-chart-axis-date ${item.className}`} x={item.x} y={height - 12}>
            {item.text}
          </text>
        ))}
        {plotted.map((point, index) => (
          <circle
            key={`${point.timestamp}-${index}`}
            className={`renew-chart-point ${point.isClamped ? 'is-clamped' : ''}`}
            cx={point.x}
            cy={point.y}
            r={index === hoverIndex || (hoverIndex == null && index === plotted.length - 1) ? activePointRadius : pointRadius}
          />
        ))}
        {plotted.map((point, index) => (
          <circle
            key={`hit-${point.timestamp}-${index}`}
            className="renew-chart-hit"
            cx={point.x}
            cy={point.y}
            r={hitRadius}
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
            <rect x={tipX} y={tipY} width={tipWidth} height={tipHeight} rx="10" />
            <text className="renew-chart-tip-date" x={tipX + 14} y={tipY + 24}>{formatMarketDate(active.timestamp)}</text>
            <text className="renew-chart-tip-price" x={tipX + 14} y={tipY + 46}>{formatYenWon(active.price)}</text>
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
      const codeA = Number(String(a.code || '').match(/\d+/)?.[0]) || 0;
      const codeB = Number(String(b.code || '').match(/\d+/)?.[0]) || 0;
      return codeB - codeA || a.index - b.index;
    });
  }, [boxes, sortMode]);

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
        {sortedBoxes.map((box) => (
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
              <b>{box.minPrice ? (box.minPriceFormat || formatYen(box.minPrice)) : t('checkPrice')}</b>
            </div>
          </a>
        ))}
      </div>
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

function RenewCardMarket({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [sortMode, setSortMode] = useState('focus');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    import('./data/market-cards.js')
      .then((mod) => {
        if (!cancelled && Array.isArray(mod.default)) {
          setItems(mod.default.filter((item) => item?.locale === 'JP' && item?.apparelId));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
              <small>{item.code}</small>
              <strong title={item.name}>{getMarketDisplayName(item)}</strong>
              <span>{item.setName}</span>
              <b>{item.minPrice ? (item.minPriceFormat || formatYen(item.minPrice)) : t('checkPrice')}</b>
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
  const [homeTab, setHomeTab] = useState('box');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [marketDetail, setMarketDetail] = useState(null);
  const [condition, setCondition] = useState('a');
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [candidatePanelCollapsed, setCandidatePanelCollapsed] = useState(false);
  const marketDetailRef = useRef(null);

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
    setCandidatePanelCollapsed(false);
    try {
      const items = await loadMarketCards();
      const result = items
        .filter((item) => normalizeCode(item.code) === normalized)
        .filter((item) => item.locale === 'JP')
        .filter((item) => {
          if (targetApparelId && String(item.apparelId) === String(targetApparelId)) return true;
          const price = Number(item.minPrice || 0);
          const listingCount = item.listingCount;
          return price > 0 || listingCount == null || Number(listingCount) > 0;
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));
      const directItem = targetApparelId
        ? result.find((item) => String(item.apparelId) === String(targetApparelId))
        : null;
      setCandidates(directItem ? [] : result);
      setSelected(directItem || (result.length === 1 ? result[0] : null));
      setCandidatePanelCollapsed(Boolean(directItem || result.length === 1));
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
    (async () => {
      const detail = await fetchMarketPrice({ code: selected.code, apparelId: selected.apparelId });
      const approvedLink = await findApprovedCardMarketLinkByApparelId(selected.apparelId).catch(() => null);
      const psaDetail = approvedLink?.cardId ? await fetchPsa10MarketPrice(approvedLink.cardId).catch(() => null) : null;
      return mergePsa10MarketDetail(detail, psaDetail);
    })()
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

  function selectMarketCandidate(item) {
    setSelected(item);
    setCandidatePanelCollapsed(true);
    window.setTimeout(() => {
      marketDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  const selectedLatest = marketDetail?.latestByCondition?.[condition];
  const chartPoints = marketDetail?.series?.[condition]?.[range] || [];
  const recentSales = marketDetail?.recentSalesByCondition?.[condition] || [];
  const recentSalesVisible = condition === 'psa10'
    ? recentSales
    : recentSales.filter((sale) => {
      const timestamp = Number(sale?.timestamp || 0);
      return timestamp && Date.now() - timestamp <= RECENT_SALES_VISIBLE_MS;
    });
  const currentPrice = selectedLatest?.price ? formatYenWon(selectedLatest.price) : selected?.minPriceFormat || '가격 정보 없음';
  const latestSourceUrl = selectedLatest?.sourceUrl || '';
  const psaSourceUrl = condition === 'psa10' && latestSourceUrl && !/snkrdunk\.com/i.test(latestSourceUrl)
    ? latestSourceUrl
    : recentSales.find((sale) => sale?.sourceUrl && !/snkrdunk\.com/i.test(sale.sourceUrl))?.sourceUrl || '';
  const currentPriceLabel = condition === 'psa10' ? t('psa10IntegratedPrice') : t('snkrLowestPrice');
  const showMarketHome = !code.trim() && !selected && !candidates.length;

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
        price: selectedLatest.price,
        priceCurrency: 'JPY',
        availability: 'https://schema.org/InStock',
        url: selected.sourceUrl
      } : undefined
    });
  }, [selected, selectedLatest]);

  return (
    <main className="renew-subpage">
      <RenewSeoSummary page="prices" titleAs="h1" placement="page" />
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

        {showMarketHome ? (
          <>
            <div className="renew-market-home-tabs">
              <button type="button" className={homeTab === 'box' ? 'is-active' : ''} onClick={() => setHomeTab('box')}>{t('marketHomeBoxTab')}</button>
              <button type="button" className={homeTab === 'card' ? 'is-active' : ''} onClick={() => setHomeTab('card')}>{t('marketHomeCardTab')}</button>
            </div>
            {homeTab === 'box' ? <RenewBoxMarket uiLang={uiLang} /> : <RenewCardMarket uiLang={uiLang} />}
          </>
        ) : null}

        {candidates.length > 1 && selected && candidatePanelCollapsed ? (
          <div className="renew-market-candidate-summary">
            <div>
              <small>{t('selectedVariant')}</small>
              <strong>{selected.code} · {getMarketShortName(selected)}</strong>
              <span>{getMarketMetaLine(selected)}</span>
            </div>
            <button type="button" onClick={() => setCandidatePanelCollapsed(false)}>{t('reselectVariant')}</button>
          </div>
        ) : null}

        {candidates.length > 1 && !candidatePanelCollapsed ? (
          <div className="renew-market-candidates">
            <b>{t('variantSelect')}</b>
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
                            <b>{item.minPrice ? (item.minPriceFormat || formatYen(item.minPrice)) : t('checkPrice')}</b>
                            <small className="renew-market-candidate-id">#{item.apparelId}</small>
                          </div>
                        </div>
                      </button>
                    ))}
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="renew-market-detail" ref={marketDetailRef}>
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
                <a href={selected?.sourceUrl} target="_blank" rel="noreferrer"><span className="renew-action-full">{t('sourceMarket')}</span><span className="renew-action-compact">{t('sourceMarketShort')}</span></a>
                {psaSourceUrl ? (
                  <a href={psaSourceUrl} target="_blank" rel="noreferrer"><span className="renew-action-full">{t('sourcePsa')}</span><span className="renew-action-compact">{t('sourcePsaShort')}</span></a>
                ) : (
                  <button type="button" disabled><span className="renew-action-full">{t('sourcePsa')}</span><span className="renew-action-compact">{t('sourcePsaShort')}</span></button>
                )}
                <button type="button" onClick={() => addValuation('a')}><span className="renew-action-full">{t('addAGrade')}</span><span className="renew-action-compact">{t('addAGradeShort')}</span></button>
                <button type="button" onClick={() => addValuation('psa10')}><span className="renew-action-full">{t('addPsa10')}</span><span className="renew-action-compact">{t('addPsa10Short')}</span></button>
              </div>
            </div>

            <div className="renew-market-chart">
              <div className="renew-market-controls">
                <div className="renew-chip-group">
                  {(marketDetail?.conditions || [{ key: 'a', label: t('aGrade') }, { key: 'psa10', label: 'PSA10' }]).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={condition === item.key ? 'is-active' : ''}
                      onClick={() => {
                        setCondition(item.key);
                        if (item.key === 'psa10') setRange('all');
                      }}
                    >
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
              <RenewMarketChart points={chartPoints} uiLang={uiLang} range={range} />
              <div className="renew-market-recent">
                <h3>{t('recentSales')}</h3>
                {recentSalesVisible.slice(0, 8).map((sale, index) => (
                  <div key={`${sale.date}-${sale.price}-${index}`} className="renew-market-sale">
                    <span>{getMarketSaleSourceLabel(sale, condition.toUpperCase())}</span>
                    <small>{formatMarketSaleDate(sale)}</small>
                    <strong>{formatYenWon(sale.price)}</strong>
                  </div>
                ))}
                {!recentSalesVisible.length ? <div className="renew-empty">{t('noRecentSales')}</div> : null}
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

function RenewShops({ uiLang }) {
  const t = (key) => getUiText(uiLang, key);
  const [type, setType] = useState('');
  const [sido, setSido] = useState('전체');
  const [gungu, setGungu] = useState('전체');
  const [draftQuery, setDraftQuery] = useState('');
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
      <RenewSeoSummary page="shops" titleAs="h1" placement="page" />
      <section className="renew-panel renew-shops">
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
        <div className="renew-shop-grid">
          {shops.map((shop) => {
            const links = getShopMapLinks(shop);
            return (
              <article key={`${shop.name}-${shop.address}`}>
                <b>{shop.name}</b>
                <p>{shop.address}</p>
                <small>{shop.sido} {shop.gungu} · {shop.sourceLabel || shop.sourceType}</small>
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
  const [deckComingSoonOpen, setDeckComingSoonOpen] = useState(false);
  const [newsComingSoonOpen, setNewsComingSoonOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

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

  function openMobileNews() {
    navigatePage('news');
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
      ) : activePage === 'news' ? (
        <RenewNews uiLang={uiLang} />
      ) : activePage === 'shops' ? (
        <RenewShops uiLang={uiLang} />
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
