const SITE_ORIGIN = 'https://www.optcgkorea.com';
const MARKET_PREVIEW_COOKIE = 'optcg_market_preview_v4';
const LEGACY_REDIRECTS = {
  '/deck': '/news',
  '/deck-simulator': '/news',
  '/collection': '/',
  '/guide/buying': '/guide/shops',
  '/guide/catalog': '/guide/card-catalog',
  '/guide/collecting': '/guide',
  '/guide/grading': '/guide/card-price',
  '/guide/market-price': '/guide/card-price',
  '/guide/portfolio': '/guide',
  '/guide/storage': '/guide/card-storage',
  '/faq/booster-box': '/faq',
  '/faq/market-price': '/faq',
  '/faq/parallel': '/faq',
  '/faq/rarity': '/faq',
  '/faq/start': '/faq',
  '/faq/storage': '/faq',
  '/prices/collector-index': '/prices/index/manga',
  '/prices/manga-index': '/prices/index/manga',
  '/prices/waifu-index': '/prices/index/manga',
  '/prices/premium-art-index': '/prices/index/manga',
  '/prices/index/premium-art': '/prices/index/manga',
  '/prices/sp-index': '/prices/index/manga',
  '/prices/index/sp': '/prices/index/manga',
  '/prices/index/heroines': '/prices/index/manga',
  '/prices/luffy-index': '/prices/index/luffy'
};

const PAGE_SEO = {
  '/': {
    title: 'Card Pone - 원피스 카드 도감, 시세, 컬렉션 관리',
    description: 'Card Pone는 원피스 카드게임 유저를 위한 비공식 카드 도감, 시세, 컬렉션 관리 서비스입니다.',
    keywords: '원피스카드, 원피스 카드게임, 원피스카드 도감, 원피스카드 시세, OPTCG, Card Pone'
  },
  '/cards': {
    title: '원피스 카드 도감 - 한글판 일본판 카드 검색 | Card Pone',
    description: '한글판과 일본판 원피스 카드게임 카드를 OP, EB, ST, 프로모 시리즈별로 검색하고 보유 카드와 위시리스트를 관리할 수 있습니다.',
    keywords: '원피스카드 도감, 원피스 카드 검색, OP16, OP15, 일본판 원피스카드, 한글판 원피스카드'
  },
  '/prices': {
    title: '원피스 카드 시세 - 카드별 시세 그래프와 박스 가격 | Card Pone',
    description: '원피스 카드별 시세, 박스 가격, PSA10 통합 시세, 최근 거래 기록과 가격 그래프를 확인할 수 있습니다.',
    keywords: '원피스카드 시세, 원피스 카드 가격, 원피스카드 박스 시세, PSA10 시세, SNKRDUNK 원피스카드'
  },
  '/market': {
    title: '원피스 카드 거래 - 유저 교환과 판매 게시판 | Card Pone',
    description: 'Card Pone 거래 페이지는 유저 간 원피스 카드 판매, 교환, 구매 글을 카페 인증 기반으로 운영하기 위한 공간입니다.',
    keywords: '원피스카드 거래, 원피스 카드 교환, 원피스카드 판매, 원피스카드 마켓'
  },
  '/community': {
    title: '원피스카드 커뮤니티 - 질문·정보·자유 | Card Pone',
    description: '원피스카드 질문과 정보, 자유 이야기와 가입인사를 나누고 출석 포인트와 회원 등급을 확인할 수 있습니다.',
    keywords: '원피스카드 커뮤니티, 원피스카드 질문, 원피스카드 정보, 원피스카드 가입인사, 카드 수집 커뮤니티',
    schemaType: 'CollectionPage'
  },
  '/news': {
    title: '원피스 카드 공지사항 및 업데이트 | Card Pone',
    description: 'Card Pone의 카드 데이터 업데이트, 시세 기능 개선, 원피스 카드게임 관련 공지사항을 확인할 수 있습니다.',
    keywords: 'Card Pone 공지사항, 원피스카드 업데이트, 원피스카드 뉴스'
  },
  '/shops': {
    title: '원피스 카드 구매처 - 지역별 공인점포 취급점포 | Card Pone',
    description: '원피스 카드게임 오프라인 구매처를 지역별로 검색하고 공인점포와 취급점포 정보를 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스 카드 공인점포, 원피스카드 매장, 원피스카드 취급점포'
  },
  '/about': {
    title: 'Card Pone 소개 | 원피스카드 도감·시세·컬렉션 관리',
    description: 'Card Pone의 운영 목적, 제공 기능, 비공식 팬 서비스 고지와 문의 채널을 안내합니다.',
    keywords: 'Card Pone 소개, 원피스카드 도감, 원피스카드 시세, 원피스카드 컬렉션'
  },
  '/data-policy': {
    title: '데이터 운영 정책 | Card Pone',
    description: 'Card Pone의 카드 도감, 시세, 지수, 구매처 데이터 수집 기준과 한계를 안내합니다.',
    keywords: 'Card Pone 데이터 정책, 원피스카드 시세 데이터, 원피스카드 도감 데이터'
  },
  '/terms': {
    title: '이용약관 | Card Pone',
    description: 'Card Pone 서비스 이용 조건과 시세 정보, 컬렉션 관리 기능의 이용 기준을 안내합니다.',
    keywords: 'Card Pone 이용약관, 원피스카드 서비스 약관'
  },
  '/privacy': {
    title: '개인정보처리방침 | Card Pone',
    description: 'Card Pone의 개인정보 수집, 이용, 보관, 삭제 및 문의 방법을 안내합니다.',
    keywords: 'Card Pone 개인정보처리방침, 원피스카드 개인정보'
  }
};

const JAPANESE_ROUTE_PREFIX = '/jp';
const JAPANESE_SEO = {
  '/': {
    title: 'ワンピースカードゲームのカード図鑑・相場 | Card Pone',
    description: 'ONE PIECE CARD GAMEの日本版カードを中心に、カード図鑑、SNKRDUNK基準の相場、価格チャート、コレクション管理を確認できる非公式サービスです。',
    keywords: 'ワンピースカードゲーム,ワンピカード,ワンピースカード 相場,ワンピカード 相場,ワンピースカード 図鑑,SNKRDUNK,Card Pone',
    schemaType: 'WebPage'
  },
  '/cards': {
    title: 'ワンピースカードゲーム カード図鑑 | Card Pone',
    description: 'ONE PIECE CARD GAMEの日本版カードをOP、EB、ST、プロモシリーズごとに検索し、カード名や番号から確認できます。',
    keywords: 'ワンピースカードゲーム カードリスト,ワンピカード 図鑑,ワンピースカード 検索,OPカード,Card Pone',
    schemaType: 'CollectionPage'
  },
  '/prices': {
    title: 'ワンピースカードゲーム 相場・価格チャート | Card Pone',
    description: 'SNKRDUNK基準でONE PIECE CARD GAMEのSingle・PSA10の価格、最近の取引記録、7日・1か月・1年チャートを確認できます。',
    keywords: 'ワンピースカードゲーム 相場,ワンピカード 相場,ワンピースカード 価格,SNKRDUNK,PSA10,Card Pone',
    schemaType: 'CollectionPage'
  },
  '/community': {
    title: 'ワンピースカードゲーム コミュニティ | Card Pone',
    description: 'ONE PIECE CARD GAMEの質問、情報、自己紹介、コレクションの話を共有できるコミュニティです。',
    keywords: 'ワンピースカードゲーム コミュニティ,ワンピカード 質問,ワンピカード 情報,ワンピカード 自己紹介,ワンピカード コレクション',
    schemaType: 'CollectionPage'
  },
  '/calendar': {
    title: 'ワンピースカードゲーム 発売日・イベントカレンダー | Card Pone',
    description: 'ONE PIECE CARD GAMEの新商品、パック、ボックス、プロモカードの発売日と公式イベント情報を月別に確認できます。',
    keywords: 'ワンピースカードゲーム 発売日,ワンピカード 発売日,ワンピカード カレンダー,ワンピースカード イベント',
    schemaType: 'CollectionPage'
  },
  '/news': {
    title: 'ワンピースカードゲーム 公式情報・新商品情報 | Card Pone',
    description: 'ONE PIECE CARD GAMEの公式情報、新商品、予約情報、コレクションガイドをまとめて確認できます。',
    keywords: 'ワンピースカードゲーム 情報,ワンピカード 新商品,ワンピースカード 公式,ワンピカード 予約',
    schemaType: 'CollectionPage'
  },
  '/shops': {
    title: 'ワンピースカードゲーム 公式ショップ・公認店 | Card Pone',
    description: '日本全国のONE PIECE CARD GAME公式ショップを地域や店舗名から検索し、住所、営業時間、Googleマップ、公認店検索を確認できます。',
    keywords: 'ワンピースカードゲーム 公式ショップ,ワンピカード 公認店,ワンピカード 店舗,ONE PIECEカードゲーム ショップ',
    schemaType: 'CollectionPage'
  }
};

function isJapanesePath(pathname) {
  return pathname === JAPANESE_ROUTE_PREFIX || pathname.startsWith(`${JAPANESE_ROUTE_PREFIX}/`);
}

function getJapaneseBasePath(pathname) {
  if (pathname === JAPANESE_ROUTE_PREFIX) return '/';
  return pathname.slice(JAPANESE_ROUTE_PREFIX.length) || '/';
}

function getJapaneseSeo(pathname) {
  const basePath = getJapaneseBasePath(pathname);
  if (JAPANESE_SEO[basePath]) return JAPANESE_SEO[basePath];
  const directSeriesSlug = basePath.startsWith('/cards/') ? basePath.slice('/cards/'.length) : '';
  if (basePath.startsWith('/cards/series/') || (directSeriesSlug && !directSeriesSlug.includes('/') && !['jp', 'kr'].includes(directSeriesSlug.toLowerCase()))) {
    const series = basePath.split('/').pop()?.toUpperCase() || 'SERIES';
    return {
      title: `${series} ワンピースカードゲーム カードリスト | Card Pone`,
      description: `${series}シリーズのONE PIECE CARD GAMEカードをカード番号、レアリティ、カード名から確認できます。`,
      keywords: `${series},ワンピースカードゲーム,ワンピカード,カードリスト`,
      schemaType: 'CollectionPage'
    };
  }
  if (basePath.startsWith('/prices/product/')) {
    const id = basePath.slice('/prices/product/'.length);
    return {
      title: `SNKRDUNK 商品 #${id} 相場 | Card Pone`,
      description: `SNKRDUNK商品 #${id} のONE PIECE CARD GAME価格チャートと最近の取引記録を確認できます。`,
      keywords: `SNKRDUNK ${id},ワンピースカードゲーム 相場,ワンピカード 価格`,
      schemaType: 'WebPage'
    };
  }
  if (basePath.startsWith('/prices/card/')) {
    const code = basePath.slice('/prices/card/'.length).toUpperCase();
    return {
      title: `${code} ワンピースカードゲーム 相場 | Card Pone`,
      description: `${code}のONE PIECE CARD GAME相場候補と価格を確認できます。`,
      keywords: `${code},ワンピースカードゲーム 相場,ワンピカード 価格`,
      schemaType: 'WebPage'
    };
  }
  if (basePath.startsWith('/prices/box/')) {
    const code = basePath.slice('/prices/box/'.length).toUpperCase();
    return {
      title: `${code} ボックス相場 | Card Pone`,
      description: `ONE PIECE CARD GAME ${code}のボックス価格とSNKRDUNK商品情報を確認できます。`,
      keywords: `${code},ワンピースカードゲーム ボックス 相場,ワンピカード ボックス`,
      schemaType: 'WebPage'
    };
  }
  return JAPANESE_SEO['/'];
}

const ROUTE_SEO = {
  '/cards/jp': {
    title: '일본판 원피스카드 도감 | Card Pone',
    description: '일본판 원피스 카드게임 카드 목록을 OP, EB, ST, 프로모 시리즈별로 검색하고 확인할 수 있습니다.',
    keywords: '일본판 원피스카드, 원피스카드 일본판 도감, OP 카드 리스트'
  },
  '/cards/kr': {
    title: '한글판 원피스카드 도감 | Card Pone',
    description: '한글판 원피스 카드게임 카드 목록을 시리즈별로 검색하고 보유 카드와 위시리스트를 관리할 수 있습니다.',
    keywords: '한글판 원피스카드, 원피스카드 한글판 도감, 원피스카드 검색'
  },
  '/prices/cards': {
    title: '원피스카드 싱글 카드 시세 | Card Pone',
    description: 'SNKRDUNK 기준 원피스카드 싱글 카드 가격과 주요 카드 시세를 확인할 수 있습니다.',
    keywords: '원피스카드 싱글 시세, 원피스카드 가격, SNKRDUNK 원피스카드'
  },
  '/prices/boxes': {
    title: '원피스카드 박스 시세 | Card Pone',
    description: '원피스 카드게임 부스터 박스와 팩 가격을 최신순, 가격 높은순, 가격 낮은순으로 확인할 수 있습니다.',
    keywords: '원피스카드 박스 시세, 원피스카드 박스 가격, 부스터 박스'
  },
  '/prices/index': {
    title: 'OPTCG Market Index | Card Pone',
    description: 'Card Pone가 추적하는 원피스카드 대표 지수와 하위 섹터 지수를 확인할 수 있습니다.',
    keywords: 'OPTCG Index, 원피스카드 지수, 원피스카드 투자 지표'
  },
  '/prices/index/manga': {
    title: 'OPTCG Manga Index | Card Pone',
    description: '원피스카드 망가 카드 중심의 Manga Index 가격 흐름을 확인할 수 있습니다.',
    keywords: '원피스카드 망가 시세, Manga Index, 망가 카드 가격'
  },
  '/prices/index/premium-art': {
    title: 'OPTCG Premium Art Index | Card Pone',
    description: '수배서, 금배경, 은배경 등 프리미엄 아트 카드 중심의 지수를 확인할 수 있습니다.',
    keywords: '원피스카드 수배서, 프리미엄 아트, 금배경 은배경'
  },
  '/prices/index/heroines': {
    title: 'OPTCG Heroines Index | Card Pone',
    description: '원피스카드 여성 캐릭터 카드의 가격 흐름을 지수로 확인할 수 있습니다.',
    keywords: '원피스카드 여캐, 히로인즈 인덱스, OPTCG Heroines Index'
  },
  '/prices/index/luffy': {
    title: 'OPTCG Luffy Index | Card Pone',
    description: '몽키 D. 루피 주요 카드 가격 흐름을 Luffy Index로 확인할 수 있습니다.',
    keywords: '루피 카드 시세, Monkey D Luffy 카드, OPTCG Luffy Index'
  },
  '/news/official': {
    title: '원피스카드 공식 공지 모음 | Card Pone',
    description: '한글판과 일본판 원피스 카드게임 공식 공지를 한곳에서 확인할 수 있습니다.',
    keywords: '원피스카드 공식공지, 원피스카드 뉴스, 원피스카드 업데이트'
  },
  '/news/preorder': {
    title: '원피스카드 사전예약 정보 | Card Pone',
    description: '원피스 카드게임 사전예약, 아마존 응모, 예약구매 바로가기 정보를 정리합니다.',
    keywords: '원피스카드 사전예약, OP17 예약, 아마존 원피스카드'
  },
  '/news/oripa': {
    title: '온라인 오리파 정보 | Card Pone',
    description: '온라인 오리파 플랫폼 바로가기와 이용 전 확인해야 할 주의사항을 정리합니다.',
    keywords: '온라인 오리파, 원피스카드 오리파, 미스터리팩'
  },
  '/news/supplies': {
    title: '원피스카드 보관용품 | Card Pone',
    description: '슬리브, 탑로더, 바인더, 자석케이스 등 카드 보관용품 정보를 확인할 수 있습니다.',
    keywords: '카드 슬리브, 탑로더, 카드 바인더, 카드 보관함'
  },
  '/guide': {
    title: '원피스카드 입문 가이드 | Card Pone',
    description: '원피스카드 수집, 시세 확인, 보관, 구매 방향성을 처음 이용자도 이해하기 쉽게 정리합니다.',
    keywords: '원피스카드 입문, 원피스카드 수집 가이드, 원피스카드 보관'
  },
  '/faq': {
    title: '원피스카드 Q&A | Card Pone',
    description: '원피스카드 레어도, 패러렐, 박스 봉입률, 시세 확인에 대한 자주 묻는 질문을 정리합니다.',
    keywords: '원피스카드 Q&A, 원피스카드 FAQ, 원피스카드 레어도'
  },
  '/shops/official': {
    title: '원피스카드 공인점포 | Card Pone',
    description: '원피스 카드게임 공인점포와 취급점포를 지역별로 확인할 수 있습니다.',
    keywords: '원피스카드 공인점포, 원피스카드 매장, 원피스카드 구매처'
  }
};

const SEO_FIXES = {
  '/': {
    title: 'Card Pone - 원피스카드 도감, 시세, 컬렉션 관리',
    description: 'Card Pone는 원피스 카드게임 유저를 위한 비공식 카드 도감, 시세, 지수, 구매처, 컬렉션 관리 서비스입니다.',
    keywords: '원피스카드, 원피스 카드게임, 원피스카드 도감, 원피스카드 시세, 원피스카드 구매처, Card Pone',
    schemaType: 'WebPage'
  },
  '/cards': {
    title: '원피스카드 도감 - 한글판 일본판 카드 검색 | Card Pone',
    description: '한글판과 일본판 원피스카드를 OP, EB, ST, PR 시리즈별로 검색하고 일련번호, 카드명, 레어도, 보유 카드와 위시리스트를 확인할 수 있습니다.',
    keywords: '원피스카드 도감, 원피스카드 검색, 일본판 원피스카드, 한글판 원피스카드, OP16, OP13',
    schemaType: 'CollectionPage'
  },
  '/prices': {
    title: '원피스카드 시세 - 카드 가격, 박스 가격, 가격 지수 | Card Pone',
    description: '원피스카드 싱글 카드 시세, 박스 가격, PSA10 통합 시세, 최근 거래 기록, 가격 그래프와 OPTCG Index를 확인할 수 있습니다.',
    keywords: '원피스카드 시세, 원피스카드 가격, 원피스카드 박스 시세, PSA10 시세, SNKRDUNK 원피스카드',
    schemaType: 'CollectionPage'
  },
  '/prices/cards': {
    title: '원피스카드 싱글 카드 시세 | Card Pone',
    description: 'SNKRDUNK 기준 원피스카드 싱글 카드 가격과 주요 카드 시세 후보를 확인할 수 있습니다.',
    keywords: '원피스카드 싱글 시세, 원피스카드 가격, SNKRDUNK 원피스카드',
    schemaType: 'CollectionPage'
  },
  '/prices/boxes': {
    title: '원피스카드 박스 시세 | Card Pone',
    description: '원피스 카드게임 부스터 박스와 팩 가격을 최신순, 가격 높은순, 가격 낮은순으로 확인할 수 있습니다.',
    keywords: '원피스카드 박스 시세, 원피스카드 박스 가격, 원피스카드 부스터 박스',
    schemaType: 'CollectionPage'
  },
  '/prices/index': {
    title: 'OPTCG Market Index - 원피스카드 가격 지수 | Card Pone',
    description: 'Card Pone가 추적하는 Manga, Luffy 원피스카드 가격 지수를 확인할 수 있습니다.',
    keywords: 'OPTCG Index, 원피스카드 지수, 원피스카드 투자 지표, 망가카드 시세',
    schemaType: 'WebPage'
  },
  '/prices/index/manga': {
    title: 'OPTCG Manga Index - 원피스카드 망가 지수 | Card Pone',
    description: '원피스카드 망가 카드 중심의 Manga Index 가격 흐름과 구성 종목을 확인할 수 있습니다.',
    keywords: '원피스카드 망가, Manga Index, 망가 카드 가격, 원피스카드 지수',
    schemaType: 'WebPage'
  },
  '/prices/index/premium-art': {
    title: 'OPTCG Premium Art Index - 원피스카드 프리미엄 아트 지수 | Card Pone',
    description: '수배서, 금배경, 은배경 등 프리미엄 아트 카드 중심의 가격 지수를 확인할 수 있습니다.',
    keywords: '원피스카드 수배서, 프리미엄 아트, 금배경, 은배경, OPTCG Premium Art Index',
    schemaType: 'WebPage'
  },
  '/prices/index/heroines': {
    title: 'OPTCG Heroines Index - 원피스카드 히로인즈 지수 | Card Pone',
    description: '원피스카드 여성 캐릭터 카드 가격 흐름과 구성 종목을 지수로 확인할 수 있습니다.',
    keywords: '원피스카드 여캐, 히로인즈 인덱스, OPTCG Heroines Index',
    schemaType: 'WebPage'
  },
  '/prices/index/luffy': {
    title: 'OPTCG Luffy Index - 루피 카드 가격 지수 | Card Pone',
    description: '몽키 D. 루피 주요 카드 가격 흐름과 대표 루피 카드 시세를 Luffy Index로 확인할 수 있습니다.',
    keywords: '루피 카드 시세, Monkey D Luffy 카드, OPTCG Luffy Index, 원피스카드 루피',
    schemaType: 'WebPage'
  },
  '/news': {
    title: '원피스카드 정보 - 공식공지, 사전예약, 가이드 | Card Pone',
    description: '원피스카드 공식 소식, 업데이트 공지, 이용 가이드, 사전예약, 온라인 오리파, 카드 보관용품 정보를 확인할 수 있습니다.',
    keywords: '원피스카드 공지, 원피스카드 뉴스, 원피스카드 가이드, 원피스카드 사전예약',
    schemaType: 'CollectionPage'
  },
  '/news/official': {
    title: '원피스카드 공식 공지 모음 | Card Pone',
    description: '한글판과 일본판 원피스 카드게임 공식 공지를 한곳에서 확인할 수 있습니다.',
    keywords: '원피스카드 공식공지, 원피스카드 뉴스, 원피스카드 업데이트',
    schemaType: 'CollectionPage'
  },
  '/news/preorder': {
    title: '원피스카드 사전예약 정보 | Card Pone',
    description: '원피스 카드게임 사전예약, 아마존 응모, 예약구매 바로가기 정보를 정리합니다.',
    keywords: '원피스카드 사전예약, OP17 예약, 아마존 원피스카드',
    schemaType: 'CollectionPage'
  },
  '/news/supplies': {
    title: '원피스카드 보관용품 | Card Pone',
    description: '슬리브, 탑로더, 카드 세이버, 자석케이스, 바인더 등 원피스카드 보관용품 정보를 확인할 수 있습니다.',
    keywords: '원피스카드 보관용품, 카드 슬리브, 탑로더, 카드 바인더, 자석케이스',
    schemaType: 'CollectionPage'
  },
  '/guide': {
    title: '원피스카드 입문 가이드 | Card Pone',
    description: '원피스카드 수집, 시세 확인, 보관, 구매 방향성을 처음 이용자도 이해하기 쉽게 정리합니다.',
    keywords: '원피스카드 입문, 원피스카드 수집 가이드, 원피스카드 보관, 원피스카드 구매',
    schemaType: 'Article'
  },
  '/guide/card-storage': {
    title: '원피스카드 보관 방법 - 슬리브, 탑로더, 바인더 | Card Pone',
    description: '원피스카드 보관 방법을 슬리브, 탑로더, 카드 세이버, 자석케이스, 바인더 기준으로 정리했습니다.',
    keywords: '원피스카드 보관 방법, 카드 보관, 카드 슬리브, 탑로더, 바인더',
    schemaType: 'Article'
  },
  '/guide/shops': {
    title: '원피스카드 파는 곳 - 공인점포와 취급점포 찾기 | Card Pone',
    description: '원피스카드 파는 곳을 공식 홈페이지 기준 공인점포와 취급점포로 정리하고 지역별 검색과 내 주변순 정렬 방법을 안내합니다.',
    keywords: '원피스카드 파는 곳, 원피스카드 구매처, 원피스카드 매장, 원피스카드 공인점포',
    schemaType: 'Article'
  },
  '/guide/card-price': {
    title: '원피스카드 시세 보는 법 | Card Pone',
    description: '원피스카드 시세를 일련번호, 카드 버전, A등급, PSA10, 최근 거래 기록과 기간별 그래프로 확인하는 방법을 정리했습니다.',
    keywords: '원피스카드 시세 보는 법, 원피스카드 가격 확인, PSA10 시세, 원피스카드 그래프',
    schemaType: 'Article'
  },
  '/guide/card-catalog': {
    title: '원피스카드 도감 사용법 - 일련번호와 카드명 검색 | Card Pone',
    description: '원피스카드 도감에서 한글판과 일본판 카드, OP/EB/ST/PR 시리즈, 일련번호와 카드명 검색을 사용하는 방법을 정리했습니다.',
    keywords: '원피스카드 도감 사용법, 원피스카드 일련번호, 원피스카드 검색',
    schemaType: 'Article'
  },
  '/faq': {
    title: '원피스카드 Q&A | Card Pone',
    description: '원피스카드 레어도, 패러렐, 박스 봉입률, 시세 확인, 보관 방법에 대한 자주 묻는 질문을 정리합니다.',
    keywords: '원피스카드 Q&A, 원피스카드 FAQ, 원피스카드 레어도, 원피스카드 봉입률',
    schemaType: 'FAQPage'
  },
  '/shops': {
    title: '원피스카드 구매처 - 지역별 공인점포와 취급점포 | Card Pone',
    description: '원피스 카드게임 오프라인 구매처를 지역별로 검색하고 공인점포와 취급점포, 네이버지도와 카카오맵 바로가기를 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스카드 공인점포, 원피스카드 매장, 원피스카드 취급점포',
    schemaType: 'CollectionPage'
  }
};

const SEO_PRIMARY = {
  '/': {
    title: '카드포네 Card Pone - 원피스카드 도감·시세·구매처',
    description: '카드포네는 원피스카드 한글판·일본판 도감, 카드별 시세 그래프, 박스 가격, 카드 인덱스, 구매처와 수집 가이드를 제공하는 카드 정보 서비스입니다.',
    keywords: '카드포네, 카드 포네, Card Pone, 원피스카드, 원피스카드 도감, 원피스카드 시세, 원피스카드 구매처, 원피스카드 지수',
    schemaType: 'WebPage'
  },
  '/cards': {
    title: '원피스카드 도감 - 한글판·일본판 카드 검색 | 카드포네',
    description: '원피스카드 한글판과 일본판 카드를 OP, EB, ST, PR 시리즈별로 검색하고 일련번호, 카드명, 보유 카드와 위시리스트를 확인할 수 있습니다.',
    keywords: '원피스카드 도감, 원피스카드 검색, 일본판 원피스카드, 한글판 원피스카드, 카드포네',
    schemaType: 'CollectionPage'
  },
  '/prices': {
    title: '원피스카드 시세 - 카드 가격·박스 가격·인덱스 | 카드포네',
    description: '원피스카드 싱글 카드 시세, 박스 가격, 최근 거래 기록, 가격 그래프와 OPTCG Market Index를 확인할 수 있습니다.',
    keywords: '원피스카드 시세, 원피스카드 가격, 원피스카드 박스 시세, 카드포네 시세, SNKRDUNK 원피스카드',
    schemaType: 'CollectionPage'
  },
  '/prices/cards': {
    title: '원피스카드 싱글 카드 시세 | 카드포네',
    description: '원피스카드 싱글 카드 가격을 카드명, 일련번호, 상품명 기준으로 검색하고 시세 그래프와 최근 거래 기록을 확인할 수 있습니다.',
    keywords: '원피스카드 싱글 시세, 원피스카드 가격 검색, 카드포네 카드 시세',
    schemaType: 'CollectionPage'
  },
  '/prices/boxes': {
    title: '원피스카드 박스 시세 | 카드포네',
    description: '원피스카드 부스터 박스와 팩 상품 가격을 최신순, 가격 높은순, 가격 낮은순으로 확인할 수 있습니다.',
    keywords: '원피스카드 박스 시세, 원피스카드 박스 가격, 부스터 박스 가격',
    schemaType: 'CollectionPage'
  },
  '/prices/index': {
    title: 'OPTCG Market Index - 원피스카드 가격 지수 | 카드포네',
    description: 'Manga, Luffy 카드의 가격 흐름을 동일 비중 섹터 지수로 확인할 수 있습니다.',
    keywords: 'OPTCG Index, 원피스카드 지수, 원피스카드 가격 지표, 카드포네 인덱스',
    schemaType: 'WebPage'
  },
  '/news': {
    title: '원피스카드 정보 - 공식공지·사전예약·가이드 | 카드포네',
    description: '원피스카드 공식 공지, 사전예약 정보, 온라인 오리파, 카드 보관용품, 수집 가이드와 Q&A를 확인할 수 있습니다.',
    keywords: '원피스카드 정보, 원피스카드 공지, 원피스카드 사전예약, 카드포네 뉴스',
    schemaType: 'CollectionPage'
  },
  '/calendar': {
    title: '원피스카드 캘린더 - 발매일·이벤트·공식 공지 | 카드포네',
    description: '원피스카드 한글판과 일본판 상품 발매일, 이벤트 공지와 공식 상품 소식을 월별 일정으로 확인할 수 있습니다.',
    keywords: '원피스카드 캘린더, 원피스카드 발매일, 원피스카드 이벤트, 원피스카드 일정',
    schemaType: 'CollectionPage'
  },
  '/shops': {
    title: '원피스카드 구매처 - 지역별 공인점포·취급점포 | 카드포네',
    description: '원피스카드 오프라인 구매처를 지역, 시군구, 매장 유형으로 검색하고 가까운 매장과 지도 바로가기를 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스카드 매장, 원피스카드 공인점포, 원피스카드 취급점포',
    schemaType: 'CollectionPage'
  },
  '/guide': {
    title: '원피스카드 입문 가이드 | 카드포네',
    description: '원피스카드 수집 방향, 카드 보관 방법, 구매처 이용 방법, 도감과 시세 활용 방법을 입문자도 이해하기 쉽게 정리합니다.',
    keywords: '원피스카드 가이드, 원피스카드 입문, 원피스카드 수집, 원피스카드 보관 방법',
    schemaType: 'Article'
  },
  '/faq': {
    title: '원피스카드 Q&A | 카드포네',
    description: '원피스카드 언어판, 봉입률, 박스 구매, 시세 확인, 보관 방법에 대한 자주 묻는 질문을 정리합니다.',
    keywords: '원피스카드 Q&A, 원피스카드 FAQ, 원피스카드 질문, 카드포네',
    schemaType: 'FAQPage'
  }
};

const SITE_NAVIGATION_ITEMS = [
  { name: '도감', url: `${SITE_ORIGIN}/cards`, description: '한글판·일본판 원피스카드 도감 검색' },
  { name: '시세', url: `${SITE_ORIGIN}/prices`, description: '카드 시세, 박스 가격, 카드 인덱스' },
  { name: '커뮤니티', url: `${SITE_ORIGIN}/community`, description: '질문, 정보, 가입인사와 카드 수집 이야기' },
  { name: '일정', url: `${SITE_ORIGIN}/calendar`, description: '상품 발매일과 공식 이벤트 공지 캘린더' },
  { name: '정보', url: `${SITE_ORIGIN}/news`, description: '공식공지, 사전예약, 가이드와 Q&A' },
  { name: '구매처', url: `${SITE_ORIGIN}/shops`, description: '지역별 공인점포와 취급점포 검색' },
  { name: '가이드/Q&A', url: `${SITE_ORIGIN}/guide`, description: '원피스카드 입문 및 수집 가이드' }
];

const JAPANESE_SITE_NAVIGATION_ITEMS = [
  { name: 'カード図鑑', url: `${SITE_ORIGIN}/jp/cards`, description: '日本版ONE PIECE CARD GAMEのカードをシリーズやカード番号から検索' },
  { name: '相場', url: `${SITE_ORIGIN}/jp/prices`, description: 'Single・PSA10の相場、ボックス価格、価格チャート' },
  { name: 'コミュニティ', url: `${SITE_ORIGIN}/jp/community`, description: '質問、情報、自己紹介、カード収集の話題' },
  { name: 'スケジュール', url: `${SITE_ORIGIN}/jp/calendar`, description: '新商品、プロモカード、公式イベントの日程' },
  { name: '公式情報', url: `${SITE_ORIGIN}/jp/news`, description: '新商品と公式告知の最新情報' },
  { name: 'ショップ', url: `${SITE_ORIGIN}/jp/shops`, description: '公式ショップと公認店の検索' }
];

const SERVER_PAGE_CONTENT = {
  '/': {
    heading: '원피스카드 도감과 시세를 한곳에서',
    paragraphs: [
      'Card Pone은 한글판과 일본판 원피스카드를 검색하고, 보유 카드와 위시리스트를 관리하며, 카드별 시세 흐름을 확인할 수 있는 수집 도구입니다.',
      '카드 시세는 공개 시장 데이터를 정리해 조건별 최근 거래와 기간별 흐름으로 제공하며, Market Index는 PSA10 거래 데이터가 있는 구성 종목의 개별 지수를 동일 비중 평균해 보여줍니다.'
    ],
    links: ['/cards', '/prices', '/guide', '/shops']
  },
  '/cards': {
    heading: '원피스카드 도감',
    paragraphs: [
      '한글판과 일본판 카드를 카드명, 일련번호, OP·EB·ST·PR 시리즈로 검색할 수 있습니다.',
      '로그인하면 보유중과 위시리스트 상태를 저장하고, 카드 상세에서 연결된 시세와 가격 알림을 이용할 수 있습니다.'
    ],
    links: ['/cards/jp', '/cards/kr', '/prices', '/guide/card-catalog']
  },
  '/prices': {
    heading: '원피스카드 시세와 Market Index',
    paragraphs: [
      '카드 일련번호나 이름으로 SNKRDUNK에 매핑된 상품을 찾고 Single과 PSA10의 최근 시세, 거래 기록, 7일·1개월·1년 가격 흐름을 확인할 수 있습니다.',
      'Market Index는 거래 데이터가 있는 PSA10 구성 종목의 일별 중앙값을 사용합니다. 이상 거래를 분리한 뒤 카드별 지수를 동일 비중 평균해 Manga, Luffy 섹터 흐름을 비교합니다.'
    ],
    links: ['/prices/cards', '/prices/boxes', '/prices/index', '/guide/card-price']
  },
  '/community': {
    heading: '원피스카드 커뮤니티',
    paragraphs: [
      '질문, 정보, 자유 이야기와 가입인사를 통해 원피스카드 수집 경험을 회원들과 나눌 수 있습니다.',
      '출석과 게시글 좋아요로 적립한 포인트는 회원 등급에 반영되며 이벤트 혜택은 확정된 내용만 별도 공지합니다.'
    ],
    links: ['/cards', '/prices', '/guide', '/news']
  },
  '/news': {
    heading: '원피스카드 정보',
    paragraphs: [
      '공식 공지, 사전예약, 카드 보관용품과 수집 가이드를 주제별로 확인할 수 있습니다.',
      '외부 공지는 원문으로 연결하고 Card Pone의 도감, 시세, 구매처 기능을 함께 활용할 수 있도록 정리합니다.'
    ],
    links: ['/news/official', '/news/preorder', '/guide', '/faq']
  },
  '/calendar': {
    heading: '원피스카드 발매와 이벤트 캘린더',
    paragraphs: [
      '한글판과 일본판 상품 발매일, 공식 이벤트 공지와 상품 공지를 월별로 확인할 수 있습니다.',
      '공식 공지는 게시일을 기준으로 표시하며 상품 발매일은 연결된 상품 출처 기준으로 구분해 제공합니다.'
    ],
    links: ['/news/official', '/prices/boxes', '/cards', '/shops']
  },
  '/shops': {
    heading: '원피스카드 구매처',
    paragraphs: [
      '국내 원피스카드 공인점포와 취급점포를 지역, 시군구, 매장명으로 검색할 수 있습니다.',
      '매장 정보는 공식 안내와 공개된 매장 정보를 기준으로 정리하며 방문 전 영업시간과 재고를 해당 매장에 다시 확인하는 것을 권장합니다.'
    ],
    links: ['/shops/official', '/guide/shops', '/cards', '/prices']
  },
  '/guide': {
    heading: '원피스카드 입문과 수집 가이드',
    paragraphs: [
      '카드 도감 검색, 시세 확인, 카드 보관, 구매처 탐색처럼 수집을 시작할 때 필요한 절차를 주제별로 정리합니다.',
      '카드 상태와 언어판, 최근 거래 기록을 구분해 확인하는 방법과 Card Pone의 각 도구를 사용하는 기준을 안내합니다.'
    ],
    links: ['/guide/card-catalog', '/guide/card-price', '/guide/card-storage', '/guide/shops']
  },
  '/faq': {
    heading: '원피스카드 자주 묻는 질문',
    paragraphs: [
      '언어판 구분, 카드 검색, 시세 데이터, 보관 방법과 구매처에 관한 자주 묻는 질문을 확인할 수 있습니다.',
      '시세는 실제 거래 시점과 카드 상태에 따라 달라질 수 있으므로 단일 가격보다 최근 거래와 기간별 흐름을 함께 확인해야 합니다.'
    ],
    links: ['/guide', '/cards', '/prices', '/shops']
  },
  '/about': {
    heading: 'Card Pone 서비스 소개',
    paragraphs: [
      'Card Pone은 원피스카드 도감, 시세, 포트폴리오, 일정과 커뮤니티를 제공하는 비공식 팬 서비스입니다.',
      '공식 판매처나 권리자가 아니며 카드 정보와 시장 데이터는 수집과 비교를 돕는 참고 자료로 제공합니다.'
    ],
    links: ['/data-policy', '/terms', '/privacy', '/cards']
  },
  '/data-policy': {
    heading: '카드 및 시세 데이터 운영 정책',
    paragraphs: [
      '카드 정보는 공식 공개 자료를 기준으로 정리하고 시세는 연결된 공개 시장의 거래 데이터를 조건별로 구분해 표시합니다.',
      '데이터 수집 시점, 카드 상태, 환율과 거래량에 따라 실제 거래 가격과 차이가 날 수 있으며 오류 제보는 운영자가 확인 후 반영합니다.'
    ],
    links: ['/prices', '/guide/card-price', '/about', '/privacy']
  }
};

const JAPANESE_SERVER_PAGE_CONTENT = {
  '/': {
    heading: 'ワンピースカードゲームのカード図鑑と相場をひとつに',
    paragraphs: [
      'Card Poneは、ONE PIECE CARD GAMEの日本版カードを検索し、コレクション管理とカードごとの価格推移を確認できる非公式サービスです。',
      '相場は公開市場データを整理して表示します。カードの状態や取引時点により実際の価格と差が出る場合があります。'
    ],
    links: ['/jp/cards', '/jp/prices', '/jp/calendar', '/jp/news', '/jp/shops']
  },
  '/cards': {
    heading: 'ワンピースカードゲーム カード図鑑',
    paragraphs: [
      '日本版ONE PIECE CARD GAMEのカードを、カード名、カード番号、OP・EB・ST・プロモシリーズから検索できます。',
      'ログイン後は所持カードとウィッシュリストを保存し、カード詳細から相場と価格アラートを確認できます。'
    ],
    links: ['/jp', '/jp/prices', '/jp/calendar', '/jp/news']
  },
  '/prices': {
    heading: 'ワンピースカードゲーム 相場と価格チャート',
    paragraphs: [
      'カード番号または名前からSNKRDUNKにマッピングされた商品を検索し、SingleとPSA10の最近の相場、取引記録、価格チャートを確認できます。',
      '価格情報は参考情報です。取引時の状態、複数枚販売、為替の変動によって実際の売買価格と異なる場合があります。'
    ],
    links: ['/jp/cards', '/jp/calendar', '/jp/news', '/jp']
  },
  '/community': {
    heading: 'ワンピースカードゲーム コミュニティ',
    paragraphs: [
      '質問、情報、自己紹介、自由な話題を通して、ONE PIECE CARD GAMEの収集体験を共有できます。',
      '出席と投稿へのいいねで獲得したポイントは会員ランクに反映され、イベント特典は確定後に別途案内します。'
    ],
    links: ['/jp/cards', '/jp/prices', '/jp/news', '/jp']
  },
  '/calendar': {
    heading: 'ワンピースカードゲーム 発売日とイベントカレンダー',
    paragraphs: [
      '新商品、パック、ボックス、プロモカードの発売日と公式イベント情報を月別に確認できます。',
      '公式告知は掲載日、商品はリンク先の発売日を基準としており、予定は変更される場合があります。'
    ],
    links: ['/jp/news', '/jp/cards', '/jp/prices', '/jp']
  },
  '/news': {
    heading: 'ワンピースカードゲーム 公式情報',
    paragraphs: [
      'ONE PIECE CARD GAMEの公式情報、新商品、予約情報、コレクションガイドをまとめて確認できます。',
      '外部の公式情報は原文へのリンクを使用し、カード図鑑と相場機能もあわせて利用できます。'
    ],
    links: ['/jp/calendar', '/jp/cards', '/jp/prices', '/jp/shops', '/jp']
  },
  '/shops': {
    heading: 'ONE PIECEカードゲーム 公式ショップ・公認店',
    paragraphs: [
      '日本全国のONE PIECE CARD GAME公式ショップを都道府県や店舗名から検索し、住所と営業時間を確認できます。',
      '店舗ごとのGoogleマップ、公式ショップ情報、公認店検索、公式イベント一覧へ移動できます。'
    ],
    links: ['/jp/cards', '/jp/prices', '/jp/calendar', '/jp/news', '/jp']
  }
};

function createServerPageContent(pathname, seo) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const isJapanese = isJapanesePath(normalized);
  const contentMap = isJapanese ? JAPANESE_SERVER_PAGE_CONTENT : SERVER_PAGE_CONTENT;
  const contentKey = isJapanese ? getJapaneseBasePath(normalized) : normalized;
  const content = contentMap[contentKey] || {
    heading: seo.title.split('|')[0].trim(),
    paragraphs: [seo.description],
    links: isJapanese ? ['/jp/cards', '/jp/prices', '/jp/community', '/jp/news', '/jp/shops'] : ['/cards', '/prices', '/community', '/guide', '/shops']
  };
  const links = content.links
    .map((path) => {
      const item = SITE_NAVIGATION_ITEMS.find((entry) => new URL(entry.url).pathname === path);
      const label = item?.name || getPageSeo(path)?.title?.split('|')[0]?.trim() || path;
      return `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  const paragraphs = content.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');

  return `<main class="server-page-content">
      <h1>${escapeHtml(content.heading)}</h1>
      ${paragraphs}
      <nav aria-label="${isJapanese ? '関連ページ' : '관련 페이지'}"><ul>${links}</ul></nav>
    </main>`;
}

function getFixedPageSeo(normalized) {
  const indexAliases = {
    '/prices/collector-index': '/prices/index',
    '/prices/manga-index': '/prices/index/manga',
    '/prices/waifu-index': '/prices/index/manga',
    '/prices/premium-art-index': '/prices/index/manga',
    '/prices/sp-index': '/prices/index/manga',
    '/prices/luffy-index': '/prices/index/luffy'
  };
  const aliasTarget = indexAliases[normalized];
  if (aliasTarget && SEO_PRIMARY[aliasTarget]) return SEO_PRIMARY[aliasTarget];
  if (SEO_PRIMARY[normalized]) return SEO_PRIMARY[normalized];
  if (aliasTarget && SEO_FIXES[aliasTarget]) return SEO_FIXES[aliasTarget];
  if (SEO_FIXES[normalized]) return SEO_FIXES[normalized];
  if (normalized.startsWith('/cards/series/')) {
    const series = normalized.split('/').pop()?.toUpperCase() || 'SERIES';
    return {
      title: `${series} 원피스카드 리스트 | Card Pone`,
      description: `${series} 시리즈의 원피스 카드게임 카드 목록, 일련번호, 레어도, 보유 카드 정보를 확인할 수 있습니다.`,
      keywords: `${series} 원피스카드, ${series} 카드 리스트, 원피스카드 도감`,
      schemaType: 'CollectionPage'
    };
  }
  if (normalized.startsWith('/shops/')) {
    const region = decodeURIComponent(normalized.split('/').pop() || '').replace(/-/g, ' ');
    return {
      title: `${region} 원피스카드 구매처 | Card Pone`,
      description: `${region} 지역의 원피스 카드게임 공인점포와 취급점포 정보를 확인할 수 있습니다.`,
      keywords: `${region} 원피스카드 매장, ${region} 원피스카드 구매처, 원피스카드 공인점포`,
      schemaType: 'CollectionPage'
    };
  }
  if (normalized.startsWith('/prices/product/')) {
    const id = normalized.slice('/prices/product/'.length);
    return {
      title: `SNKRDUNK 상품 #${id} 원피스카드 시세 | Card Pone`,
      description: `SNKRDUNK 상품 #${id}의 원피스카드 시세, 가격 그래프, 최근 거래 기록을 확인할 수 있습니다.`,
      keywords: `SNKRDUNK ${id}, 원피스카드 시세, 원피스카드 가격`,
      schemaType: 'WebPage'
    };
  }
  if (normalized.startsWith('/prices/card/')) {
    const code = normalized.slice('/prices/card/'.length).toUpperCase();
    return {
      title: `${code} 원피스카드 시세 | Card Pone`,
      description: `${code} 일련번호의 원피스카드 시세 후보, 카드 버전, 가격 정보를 확인할 수 있습니다.`,
      keywords: `${code} 원피스카드 시세, ${code} 카드 가격, 원피스카드 일련번호`,
      schemaType: 'WebPage'
    };
  }
  if (normalized.startsWith('/prices/box/')) {
    const code = normalized.slice('/prices/box/'.length).toUpperCase();
    return {
      title: `${code} 원피스카드 박스 시세 | Card Pone`,
      description: `원피스 카드게임 ${code} 부스터 박스 가격과 SNKRDUNK 상품 정보를 확인할 수 있습니다.`,
      keywords: `${code} 박스 시세, 원피스카드 박스 가격, 원피스카드 부스터 박스`,
      schemaType: 'WebPage'
    };
  }
  if (normalized.startsWith('/guide/')) {
    const topic = decodeURIComponent(normalized.slice('/guide/'.length)).replace(/-/g, ' ');
    return {
      title: `원피스카드 가이드 - ${topic} | Card Pone`,
      description: `원피스카드 수집가를 위한 ${topic} 가이드입니다.`,
      keywords: `원피스카드 가이드, ${topic}, Card Pone`,
      schemaType: 'Article'
    };
  }
  if (normalized.startsWith('/faq/')) {
    const topic = decodeURIComponent(normalized.slice('/faq/'.length)).replace(/-/g, ' ');
    return {
      title: `원피스카드 Q&A - ${topic} | Card Pone`,
      description: `원피스카드 ${topic} 관련 자주 묻는 질문과 답변을 확인할 수 있습니다.`,
      keywords: `원피스카드 Q&A, ${topic}, Card Pone`,
      schemaType: 'FAQPage'
    };
  }
  return null;
}

function getPageSeo(pathname) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  if (isJapanesePath(normalized)) return getJapaneseSeo(normalized);
  const fixedSeo = getFixedPageSeo(normalized);
  if (fixedSeo) return fixedSeo;
  if (ROUTE_SEO[normalized]) return ROUTE_SEO[normalized];
  if (PAGE_SEO[normalized]) return PAGE_SEO[normalized];
  if (normalized.startsWith('/cards/series/')) {
    const series = normalized.split('/').pop()?.toUpperCase() || 'SERIES';
    return {
      title: `${series} 원피스카드 리스트 | Card Pone`,
      description: `${series} 시리즈의 원피스 카드게임 카드 목록과 보유 카드 정보를 확인할 수 있습니다.`,
      keywords: `${series} 원피스카드, ${series} 카드 리스트, 원피스카드 도감`
    };
  }
  if (normalized.startsWith('/shops/')) {
    const region = decodeURIComponent(normalized.split('/').pop() || '').replace(/-/g, ' ');
    return {
      title: `${region} 원피스카드 구매처 | Card Pone`,
      description: `${region} 지역의 원피스 카드게임 공인점포와 취급점포 정보를 확인할 수 있습니다.`,
      keywords: `${region} 원피스카드 매장, ${region} 원피스카드 구매처`
    };
  }
  if (normalized.startsWith('/prices/product/')) {
    const id = normalized.slice('/prices/product/'.length);
    return {
      title: `SNKRDUNK 상품 #${id} 시세 | Card Pone`,
      description: `SNKRDUNK 상품 #${id}의 원피스카드 시세, 가격 그래프, 최근 거래 기록을 확인할 수 있습니다.`,
      keywords: `SNKRDUNK ${id}, 원피스카드 시세, 원피스카드 가격`
    };
  }
  if (normalized.startsWith('/prices/card/')) {
    const code = normalized.slice('/prices/card/'.length).toUpperCase();
    return {
      title: `${code} 원피스카드 시세 | Card Pone`,
      description: `${code} 일련번호의 원피스카드 시세 후보와 가격 정보를 확인할 수 있습니다.`,
      keywords: `${code} 원피스카드 시세, ${code} 카드 가격`
    };
  }
  if (normalized.startsWith('/prices/box/')) {
    const code = normalized.slice('/prices/box/'.length).toUpperCase();
    return {
      title: `${code} 박스 시세 | Card Pone`,
      description: `원피스 카드게임 ${code} 부스터 박스 가격과 SNKRDUNK 상품 정보를 확인할 수 있습니다.`,
      keywords: `${code} 박스 시세, 원피스카드 박스 가격`
    };
  }
  if (normalized.startsWith('/guide/')) {
    const topic = decodeURIComponent(normalized.slice('/guide/'.length)).replace(/-/g, ' ');
    return {
      title: `원피스카드 가이드 - ${topic} | Card Pone`,
      description: `원피스카드 수집가를 위한 ${topic} 가이드입니다.`,
      keywords: `원피스카드 가이드, ${topic}, Card Pone`
    };
  }
  if (normalized.startsWith('/faq/')) {
    const topic = decodeURIComponent(normalized.slice('/faq/'.length)).replace(/-/g, ' ');
    return {
      title: `원피스카드 Q&A - ${topic} | Card Pone`,
      description: `원피스카드 ${topic} 관련 자주 묻는 질문과 답변을 확인할 수 있습니다.`,
      keywords: `원피스카드 Q&A, ${topic}, Card Pone`
    };
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceOrInsertMeta(html, selectorPattern, replacement) {
  if (selectorPattern.test(html)) return html.replace(selectorPattern, replacement);
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function createJsonLd(pathname, seo) {
  const url = `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const isJapanese = isJapanesePath(normalized);
  const schemaType = seo.schemaType || 'WebPage';
  const pageNode = {
    '@type': schemaType,
    '@id': `${url}#webpage`,
    url,
    name: seo.title,
    description: seo.description,
    inLanguage: isJapanese ? 'ja-JP' : 'ko-KR',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'Card Pone',
      alternateName: ['카드포네', '카드 포네', '원피스카드 도감', '원피스카드 시세'],
      url: `${SITE_ORIGIN}/`
    },
    about: seo.keywords
  };

  if (schemaType === 'Article') {
    pageNode.headline = seo.title;
    pageNode.author = { '@type': 'Organization', name: 'Card Pone' };
    pageNode.publisher = { '@id': `${SITE_ORIGIN}/#organization` };
  }

  if (schemaType === 'Product') {
    pageNode.brand = { '@type': 'Brand', name: 'ONE PIECE Card Game' };
    pageNode.category = 'Trading Card';
  }

  if (schemaType === 'Dataset') {
    pageNode.creator = { '@type': 'Organization', name: 'Card Pone' };
    pageNode.measurementTechnique = 'Market price index based on collected public market data';
  }

  if (schemaType === 'FAQPage') {
    pageNode.mainEntity = [
      {
        '@type': 'Question',
        name: '원피스카드 시세는 어떻게 확인하나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Card Pone의 시세 탭에서 일련번호나 카드명을 검색하면 카드 버전별 시세 후보, 가격 그래프, 최근 거래 기록을 확인할 수 있습니다.'
        }
      },
      {
        '@type': 'Question',
        name: '원피스카드 도감에서는 무엇을 검색할 수 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '한글판과 일본판 원피스카드를 OP, EB, ST, PR 시리즈와 일련번호, 카드명 기준으로 검색할 수 있습니다.'
        }
      },
      {
        '@type': 'Question',
        name: '원피스카드 구매처는 어디에서 확인하나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '구매처 탭에서 지역별 공인점포와 취급점포를 검색하고 네이버지도 또는 카카오맵으로 이동할 수 있습니다.'
        }
      }
    ];
  }

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      pageNode,
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'Card Pone',
        alternateName: ['카드포네', '카드 포네'],
        url: `${SITE_ORIGIN}/`
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: 'Card Pone',
        alternateName: isJapanese ? ['カードポネ', 'ワンピースカードゲーム 図鑑', 'ワンピースカードゲーム 相場'] : ['카드포네', '카드 포네', '원피스카드 도감', '원피스카드 시세'],
        url: `${SITE_ORIGIN}/`,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_ORIGIN}/prices?code={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      ...(isJapanese ? JAPANESE_SITE_NAVIGATION_ITEMS : SITE_NAVIGATION_ITEMS).map((item, index) => ({
        '@type': 'SiteNavigationElement',
        '@id': `${item.url}#navigation`,
        position: index + 1,
        name: item.name,
        description: item.description,
        url: item.url
      })),
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Card Pone', item: `${SITE_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: seo.title, item: url }
        ]
      }
    ]
  });
}

function applySeo(html, pathname, seo) {
  const canonicalUrl = `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const isJapanese = isJapanesePath(normalized);
  const basePath = isJapanese ? getJapaneseBasePath(normalized) : normalized;
  const defaultUrl = `${SITE_ORIGIN}${basePath === '/' ? '/' : basePath}`;
  const japaneseUrl = `${SITE_ORIGIN}${JAPANESE_ROUTE_PREFIX}${basePath === '/' ? '' : basePath}`;
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const keywords = escapeHtml(seo.keywords);
  const url = escapeHtml(canonicalUrl);
  const image = `${SITE_ORIGIN}/og-card-pone.jpg`;

  let nextHtml = html
    .replace(/<html\b[^>]*\blang="[^"]*"/i, `<html lang="${isJapanese ? 'ja' : 'ko'}"`)
    .replace(/<title>.*?<\/title>/is, `<title>${title}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);

  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="keywords" content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${keywords}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="robots" content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${seo.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${url}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:locale" content="[^"]*"\s*\/?>/i, `<meta property="og:locale" content="${isJapanese ? 'ja_JP' : 'ko_KR'}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${image}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${image}" />`);
  const hreflangLinks = [
    `<link rel="alternate" hreflang="ko" href="${escapeHtml(defaultUrl)}" data-card-pone-hreflang="true" />`,
    `<link rel="alternate" hreflang="ja" href="${escapeHtml(japaneseUrl)}" data-card-pone-hreflang="true" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(defaultUrl)}" data-card-pone-hreflang="true" />`
  ].join('\n    ');
  nextHtml = nextHtml.replace(/\s*<link rel="alternate" hreflang="(?:ko|ja|x-default)"[^>]*data-card-pone-hreflang="true"\s*\/>/gi, '');
  nextHtml = nextHtml.replace('</head>', `    ${hreflangLinks}\n  </head>`);

  const pageJsonLd = `<script type="application/ld+json" id="optcg-server-page-jsonld">${createJsonLd(pathname, seo)}</script>`;
  if (nextHtml.includes('id="optcg-server-page-jsonld"')) {
    nextHtml = nextHtml.replace(/<script type="application\/ld\+json" id="optcg-server-page-jsonld">.*?<\/script>/is, pageJsonLd);
  } else {
    nextHtml = nextHtml.replace('</head>', `    ${pageJsonLd}\n  </head>`);
  }
  const serverContent = createServerPageContent(pathname, seo);
  nextHtml = nextHtml.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">${serverContent}</div>`
  );
  return nextHtml;
}

function shouldSkip(pathname) {
  if (pathname.startsWith('/api/')) return true;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/rss.xml' || pathname === '/ads.txt') return true;
  return /\.[a-z0-9]{2,8}$/i.test(pathname);
}

function hasMarketPreviewAccess(request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map((part) => part.trim()).includes(`${MARKET_PREVIEW_COOKIE}=1`);
}

function renderMarketPasswordPage(errorMessage = '') {
  const errorHtml = errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : '';
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>거래 탭 테스트 접근 | Card Pone</title>
    <style>
      :root { color-scheme: light; font-family: Pretendard, SUIT, -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #f7f7f5; color: #17191d; }
      main { width: min(420px, calc(100vw - 32px)); padding: 28px; border: 1px solid #e5e1dc; border-radius: 24px; background: #fff; box-shadow: 0 18px 45px rgba(17, 24, 39, .08); }
      h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.04em; }
      p { margin: 0 0 18px; color: #6b7280; line-height: 1.55; font-size: 14px; }
      label { display: grid; gap: 8px; font-weight: 800; font-size: 13px; }
      input { height: 46px; border: 1px solid #d8d8d8; border-radius: 14px; padding: 0 14px; font: inherit; font-size: 16px; }
      button { width: 100%; height: 46px; margin-top: 12px; border: 0; border-radius: 14px; background: #17191d; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
      .error { margin: 0 0 12px; color: #c23b22; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <h1>거래 탭 테스트 접근</h1>
      <p>현재 거래 기능은 검수용으로 제한 공개 중입니다.</p>
      ${errorHtml}
      <form method="post" action="/market">
        <label>
          비밀번호
          <input name="password" type="password" autocomplete="current-password" autofocus />
        </label>
        <button type="submit">입장</button>
      </form>
    </main>
  </body>
</html>`;
}

async function handleMarketPreviewGate(request, env) {
  if (hasMarketPreviewAccess(request)) return null;
  if (request.method === 'POST') {
    const formData = await request.formData().catch(() => null);
    const password = String(formData?.get('password') || '');
    const expectedPassword = String(env?.MARKET_PREVIEW_PASSWORD || '');
    if (expectedPassword && password === expectedPassword) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/market',
          'Set-Cookie': `${MARKET_PREVIEW_COOKIE}=1; Path=/market; Max-Age=10; HttpOnly; Secure; SameSite=Lax`
        }
      });
    }
    return new Response(renderMarketPasswordPage('비밀번호가 올바르지 않습니다.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  return new Response(renderMarketPasswordPage(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const legacyTarget = LEGACY_REDIRECTS[url.pathname.replace(/\/$/, '')];
  if (legacyTarget) {
    const redirectUrl = new URL(legacyTarget, SITE_ORIGIN);
    return Response.redirect(redirectUrl.toString(), 301);
  }

  if (shouldSkip(url.pathname)) return context.next();

  const seo = getPageSeo(url.pathname);
  if (!seo) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

  const html = await response.text();
  return new Response(applySeo(html, url.pathname, seo), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
