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
  '/lab': {
    title: '원피스카드 실험실 - 센터링·카드깡·포트폴리오 계산 | Card Pone',
    description: '원피스카드 센터링 측정기, 카드깡 시뮬레이터와 포트폴리오 수익률 계산기를 이용할 수 있습니다.',
    keywords: '원피스카드 실험실, 원피스카드 센터링, 원피스카드 카드깡, 카드 수익률 계산기',
    schemaType: 'CollectionPage'
  },
  '/lab/centering': {
    title: '원피스카드 센터링 측정기 | Card Pone',
    description: '카메라 촬영이나 사진으로 원피스카드 앞면의 좌우·상하 인쇄 비율을 기기 안에서 분석하고 센터링 참고 구간을 확인할 수 있습니다.',
    keywords: '원피스카드 센터링, 카드 센터링 측정기, PSA 센터링, 원피스카드 감정',
    schemaType: 'WebApplication'
  },
  '/lab/pack-simulator': {
    title: '원피스카드 카드깡 시뮬레이터 | Card Pone',
    description: '원피스카드 시리즈와 1팩·1박스·1카톤을 선택해 가상 개봉 결과와 획득 카드의 참고 시세를 확인할 수 있습니다.',
    keywords: '원피스카드 카드깡, 원피스카드 시뮬레이터, 원피스카드 팩 개봉, 원피스카드 박스 개봉',
    schemaType: 'WebApplication'
  },
  '/guides/centering': {
    title: '원피스카드 센터링 측정기 사용 가이드 | Card Pone',
    description: '원피스카드 촬영 준비, 카드 외곽과 내부 인쇄 경계 조정, 센터링 결과 해석 방법을 안내합니다.',
    keywords: '원피스카드 센터링 측정 방법, 카드 센터링 비율, 센터링 측정 가이드',
    schemaType: 'FAQPage'
  },
  '/guides/pack-simulator': {
    title: '원피스카드 카드깡 시뮬레이터 사용 가이드 | Card Pone',
    description: '가상 카드깡의 시리즈와 개봉 단위 선택, 팩·박스·카톤 결과와 확률의 의미를 안내합니다.',
    keywords: '원피스카드 카드깡 시뮬레이터 사용법, 원피스카드 봉입률, 가상 카드 개봉',
    schemaType: 'FAQPage'
  },
  '/tools/portfolio-calculator': {
    title: '원피스카드 포트폴리오 수익률 계산기 | Card Pone',
    description: '원피스카드를 검색하고 매입가 또는 매입일 시세를 입력해 현재 평가금액, 평가손익과 수익률을 계산하세요.',
    keywords: '원피스카드 포트폴리오, 카드 수익률 계산기, 원피스카드 평가손익, 카드 매입가 계산',
    schemaType: 'WebApplication'
  },
  '/guides/portfolio-calculator': {
    title: '포트폴리오 수익률 계산기 사용 가이드 | Card Pone',
    description: '카드 검색, 매입가 직접 입력, 매입일 시세 추정과 포트폴리오 저장 방법을 안내합니다.',
    keywords: '카드 포트폴리오 사용법, 카드 수익률 계산 방법, 원피스카드 매입가, 카드 평가손익',
    schemaType: 'FAQPage'
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
    title: 'Card Pone 서비스 안내 | 원피스카드 도감·시세·컬렉션 관리',
    description: 'Card Pone에서 제공하는 원피스카드 도감, 시세, 컬렉션과 실험실 기능 및 문의 채널을 안내합니다.',
    keywords: 'Card Pone 서비스 안내, 원피스카드 도감, 원피스카드 시세, 원피스카드 컬렉션'
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
  '/lab': {
    title: 'ワンピースカード ラボ - センタリング・開封・収益率計算 | Card Pone',
    description: 'センタリング測定、パック開封シミュレーター、ポートフォリオ収益率計算を利用できます。',
    keywords: 'ワンピースカード ラボ,カード センタリング,パック開封 シミュレーター,カード 収益率 計算',
    schemaType: 'CollectionPage'
  },
  '/lab/centering': {
    title: 'ワンピースカード センタリング測定 | Card Pone',
    description: '撮影したカードの外枠と印刷境界を調整し、表面の左右・上下のセンタリング比率を端末内で確認できます。',
    keywords: 'ワンピースカード センタリング,カード センタリング測定,PSA センタリング',
    schemaType: 'WebApplication'
  },
  '/lab/pack-simulator': {
    title: 'ワンピースカード 開封シミュレーター | Card Pone',
    description: 'シリーズと1パック・1ボックス・1カートンを選び、仮想開封結果とカードの参考価格を確認できます。',
    keywords: 'ワンピースカード 開封シミュレーター,ワンピカード パック開封,ボックス開封',
    schemaType: 'WebApplication'
  },
  '/guides/centering': {
    title: 'ワンピースカード センタリング測定ガイド | Card Pone',
    description: '撮影準備、カード外枠と印刷境界の調整、センタリング結果の見方を案内します。',
    keywords: 'カード センタリング 測定方法,センタリング 比率,ワンピースカード ガイド',
    schemaType: 'FAQPage'
  },
  '/guides/pack-simulator': {
    title: 'ワンピースカード 開封シミュレーターガイド | Card Pone',
    description: 'シリーズと開封単位の選択、パック・ボックス・カートンの結果と確率の見方を案内します。',
    keywords: 'ワンピースカード 開封シミュレーター 使い方,封入率,仮想開封',
    schemaType: 'FAQPage'
  },
  '/tools/profit-calculator': {
    title: 'カード損益計算機 | Card Pone',
    description: 'カードの仕入れ値、販売予定価格、手数料、送料から、予想損益、収益率、損益分岐販売価格を計算できます。',
    keywords: 'カード 損益計算,カード 利益計算,トレーディングカード 手数料,損益分岐価格',
    schemaType: 'WebApplication'
  },
  '/guides/profit-calculator': {
    title: 'カード損益計算機の使い方 | Card Pone',
    description: 'カード取引の損益計算、手数料・送料の反映、損益分岐販売価格の確認方法を解説します。',
    keywords: 'カード 損益計算 方法,カード 利益率 計算,損益分岐価格,トレーディングカード ガイド',
    schemaType: 'FAQPage'
  },
  '/tools/portfolio-calculator': {
    title: 'ワンピースカード ポートフォリオ収益率計算 | Card Pone',
    description: 'カードを検索し、購入価格または購入日の参考価格から現在評価額、評価損益、収益率を計算できます。',
    keywords: 'ワンピースカード ポートフォリオ,カード 収益率 計算,カード 評価損益,カード 購入価格',
    schemaType: 'WebApplication'
  },
  '/guides/portfolio-calculator': {
    title: 'ポートフォリオ収益率計算ガイド | Card Pone',
    description: 'カード検索、購入価格の入力、購入日の参考価格推定、ポートフォリオ保存方法を案内します。',
    keywords: 'カード ポートフォリオ 使い方,カード 収益率 計算方法,ワンピースカード 購入価格',
    schemaType: 'FAQPage'
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
  '/lab': {
    title: '원피스카드 실험실 - 센터링·카드깡·포트폴리오 계산 | 카드포네',
    description: '원피스카드 센터링 측정기, 카드깡 시뮬레이터와 포트폴리오 수익률 계산기를 이용할 수 있습니다.',
    keywords: '원피스카드 실험실, 원피스카드 센터링, 원피스카드 카드깡, 카드 수익률 계산기',
    schemaType: 'CollectionPage'
  },
  '/lab/centering': {
    title: '원피스카드 센터링 측정기 | 카드포네',
    description: '카드 외곽과 내부 인쇄 경계를 조정해 원피스카드 앞면의 좌우·상하 센터링 비율을 기기 안에서 확인할 수 있습니다.',
    keywords: '원피스카드 센터링, 카드 센터링 측정기, PSA 센터링, 원피스카드 감정',
    schemaType: 'WebApplication'
  },
  '/lab/pack-simulator': {
    title: '원피스카드 카드깡 시뮬레이터 | 카드포네',
    description: '원피스카드 시리즈와 1팩·1박스·1카톤을 선택해 가상 개봉 결과와 획득 카드의 참고 시세를 확인할 수 있습니다.',
    keywords: '원피스카드 카드깡, 원피스카드 시뮬레이터, 원피스카드 팩 개봉, 원피스카드 박스 개봉',
    schemaType: 'WebApplication'
  },
  '/lab/decks': {
    title: '원피스카드 덱 빌더 - 리더별 덱 구성 | 카드포네',
    description: '원피스카드 리더와 사용 환경을 선택하고 색상에 맞는 카드로 50장 덱을 구성하며 카드 매수와 덱 규칙을 확인할 수 있습니다.',
    keywords: '원피스카드 덱 빌더, 원피스카드 덱 구성, 원피스카드 리더, 원피스카드 덱 레시피',
    schemaType: 'WebApplication'
  },
  '/lab/decks/builder': {
    title: '원피스카드 덱 편집기 - 50장 덱 구성 | 카드포네',
    description: '리더 색상에 맞는 원피스카드를 검색하고 카드별 투입 매수와 50장 덱 규칙을 확인하며 덱을 편집할 수 있습니다.',
    keywords: '원피스카드 덱 편집기, 원피스카드 50장 덱, 원피스카드 카드 매수, 원피스카드 리더 색상',
    schemaType: 'WebApplication'
  },
  '/guides/deck-builder': {
    title: '원피스카드 덱 빌더 사용 가이드 | 카드포네',
    description: '리더와 카드 환경 선택, 검증된 덱 불러오기, 카드 추가와 원피스카드 덱 규칙 확인 방법을 안내합니다.',
    keywords: '원피스카드 덱 빌더 사용법, 원피스카드 덱 규칙, 원피스카드 리더 색상, 원피스카드 덱 구성',
    schemaType: 'FAQPage'
  },
  '/guides/centering': {
    title: '원피스카드 센터링 측정기 사용 가이드 | 카드포네',
    description: '원피스카드 촬영 준비, 카드 외곽과 내부 인쇄 경계 조정, 센터링 결과 해석 방법을 안내합니다.',
    keywords: '원피스카드 센터링 측정 방법, 카드 센터링 비율, 센터링 측정 가이드',
    schemaType: 'FAQPage'
  },
  '/guides/pack-simulator': {
    title: '원피스카드 카드깡 시뮬레이터 사용 가이드 | 카드포네',
    description: '가상 카드깡의 시리즈와 개봉 단위 선택, 팩·박스·카톤 결과와 확률의 의미를 안내합니다.',
    keywords: '원피스카드 카드깡 시뮬레이터 사용법, 원피스카드 봉입률, 가상 카드 개봉',
    schemaType: 'FAQPage'
  },
  '/tools/profit-calculator': {
    title: '카드 손익 계산기 | 카드포네',
    description: '카드 매입가, 판매 예정가, 수수료와 배송비를 입력해 예상 손익, 수익률, 손익분기 판매가를 계산하세요.',
    keywords: '원피스카드 손익 계산기, 카드 수익률 계산기, 카드 판매 수수료, 카드 손익분기 가격',
    schemaType: 'WebApplication'
  },
  '/guides/profit-calculator': {
    title: '카드 손익 계산기 사용 가이드 | 카드포네',
    description: '카드 거래 손익 계산 기준, 수수료와 배송비 반영 방법, 손익분기 판매가 확인 방법을 안내합니다.',
    keywords: '카드 손익 계산 방법, 카드 수익률 계산, 카드 손익분기 판매가, 원피스카드 거래 가이드',
    schemaType: 'FAQPage'
  },
  '/tools/portfolio-calculator': {
    title: '원피스카드 포트폴리오 수익률 계산기 | 카드포네',
    description: '원피스카드를 검색하고 매입가 또는 매입일 시세를 입력해 현재 평가금액, 평가손익과 수익률을 계산하세요.',
    keywords: '원피스카드 포트폴리오, 카드 수익률 계산기, 원피스카드 평가손익, 카드 매입가 계산',
    schemaType: 'WebApplication'
  },
  '/guides/portfolio-calculator': {
    title: '포트폴리오 수익률 계산기 사용 가이드 | 카드포네',
    description: '카드 검색, 매입가 직접 입력, 매입일 시세 추정과 포트폴리오 저장 방법을 안내합니다.',
    keywords: '카드 포트폴리오 사용법, 카드 수익률 계산 방법, 원피스카드 매입가, 카드 평가손익',
    schemaType: 'FAQPage'
  },
  '/shops/official': {
    title: '원피스카드 공인점포·취급점포 찾기 | 카드포네',
    description: '원피스 카드게임 공식 공인점포와 취급점포를 지역별로 검색하고 지도와 거리 정보를 확인할 수 있습니다.',
    keywords: '원피스카드 공인점포, 원피스카드 취급점포, 원피스카드 공식 매장',
    schemaType: 'CollectionPage'
  },
  '/shops/partners': {
    title: '카드포네 제휴 카드샵 안내 | 카드포네',
    description: '카드포네 제휴 카드샵의 주소, 영업시간, 지도, 스토어와 공개 채널 정보를 확인할 수 있습니다.',
    keywords: '카드포네 제휴 카드샵, 원피스카드 매장, 원피스카드 구매처',
    schemaType: 'CollectionPage'
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
  { name: '정보', url: `${SITE_ORIGIN}/news`, description: '공식공지, 사전예약, 가이드와 Q&A' },
  { name: '실험실', url: `${SITE_ORIGIN}/lab`, description: '센터링 측정기와 카드깡 시뮬레이터' },
  { name: '구매처', url: `${SITE_ORIGIN}/shops`, description: '지역별 공인점포와 취급점포 검색' },
  { name: '가이드/Q&A', url: `${SITE_ORIGIN}/guide`, description: '원피스카드 입문 및 수집 가이드' }
];

const JAPANESE_SITE_NAVIGATION_ITEMS = [
  { name: 'カード図鑑', url: `${SITE_ORIGIN}/jp/cards`, description: '日本版ONE PIECE CARD GAMEのカードをシリーズやカード番号から検索' },
  { name: '相場', url: `${SITE_ORIGIN}/jp/prices`, description: 'Single・PSA10の相場、ボックス価格、価格チャート' },
  { name: '公式情報', url: `${SITE_ORIGIN}/jp/news`, description: '新商品と公式告知の最新情報' },
  { name: 'ラボ', url: `${SITE_ORIGIN}/jp/lab`, description: 'センタリング測定と開封シミュレーター' },
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
    links: ['/prices/cards', '/prices/boxes', '/prices/index/manga', '/guide/card-price']
  },
  '/community': {
    heading: '원피스카드 커뮤니티',
    paragraphs: [
      '질문, 정보, 자유 이야기와 가입인사를 통해 원피스카드 수집 경험을 회원들과 나눌 수 있습니다.',
      '출석과 게시글 좋아요로 적립한 포인트는 회원 등급에 반영되며 이벤트 혜택은 확정된 내용만 별도 공지합니다.'
    ],
    links: ['/cards', '/prices', '/guide', '/news']
  },
  '/lab': {
    heading: '원피스카드 실험실',
    paragraphs: [
      '센터링 측정기, 카드깡 시뮬레이터와 포트폴리오 수익률 계산기처럼 카드 수집 과정에서 직접 사용할 수 있는 공개 도구를 모았습니다.',
      '각 도구는 별도 페이지에서 실행되며 사용 기준과 결과 해석 방법은 연결된 공개 가이드에서 확인할 수 있습니다.'
    ],
    links: ['/lab/centering', '/lab/pack-simulator', '/tools/portfolio-calculator', '/guides/portfolio-calculator']
  },
  '/lab/centering': {
    heading: '원피스카드 센터링 측정기',
    paragraphs: [
      '카드를 촬영 가이드에 맞추면 앞면의 좌우와 상하 인쇄 비율을 기기 안에서 분석하고 측정 신뢰도를 함께 표시합니다.',
      '센터링만 확인하는 참고 도구이며 표면, 모서리, 인쇄 결함과 감정사의 판단은 포함하지 않습니다.'
    ],
    links: ['/guides/centering', '/lab', '/cards', '/data-policy']
  },
  '/lab/pack-simulator': {
    heading: '원피스카드 카드깡 시뮬레이터',
    paragraphs: [
      '원피스카드 시리즈와 1팩, 1박스, 1카톤 중 개봉 단위를 선택해 가상 개봉 결과를 확인할 수 있습니다.',
      '도감에 연결된 카드 이미지와 번호, 등급, 확인 가능한 참고 시세를 보여주며 실제 상품의 봉입 결과를 보장하지 않습니다.'
    ],
    links: ['/guides/pack-simulator', '/lab', '/cards', '/prices']
  },
  '/lab/decks': {
    heading: '원피스카드 덱 빌더',
    paragraphs: [
      '리더와 한국판·일본판·영문판 환경을 선택하고 리더 색상에 맞는 카드를 검색해 50장 덱을 구성할 수 있습니다.',
      '리더 1장, 메인 덱 50장, 동일 카드번호 최대 매수, 리더 색상과 카드 색상 일치 여부를 화면에서 확인할 수 있습니다.'
    ],
    links: ['/lab/decks/builder', '/guides/deck-builder', '/cards', '/lab']
  },
  '/lab/decks/builder': {
    heading: '원피스카드 덱 편집기',
    paragraphs: [
      '리더를 먼저 선택하면 사용할 수 있는 색상의 카드가 필터링되며 카드별 투입 매수를 조정해 덱을 구성할 수 있습니다.',
      '완성한 덱은 50장 구성, 동일 카드번호 매수, 리더 색상과 금지·제한 카드 기준으로 검사할 수 있습니다.'
    ],
    links: ['/lab/decks', '/guides/deck-builder', '/cards', '/lab']
  },
  '/guides/deck-builder': {
    heading: '원피스카드 덱 빌더 사용 가이드',
    paragraphs: [
      '사용할 카드 환경과 리더를 선택한 뒤 리더 색상에 맞는 카드를 검색해 덱에 추가하는 순서를 안내합니다.',
      '리더 1장과 메인 덱 50장, 동일 카드번호 투입 매수, 색상 일치와 금지·제한 카드 검사 결과를 확인할 수 있습니다.'
    ],
    links: ['/lab/decks', '/lab/decks/builder', '/cards', '/lab']
  },
  '/guides/centering': {
    heading: '센터링 측정기 사용 가이드',
    paragraphs: [
      '슬리브와 탑로더를 제거하고 카드 네 모서리가 모두 보이도록 촬영한 뒤, 실제 카드 외곽과 내부 인쇄 경계를 순서대로 맞춥니다.',
      '결과는 앞면 센터링 비율만 다루는 참고값이며 표면, 모서리, 엣지, 인쇄 결함을 포함한 최종 감정 등급이 아닙니다.'
    ],
    links: ['/lab/centering', '/lab', '/data-policy', '/cards']
  },
  '/guides/pack-simulator': {
    heading: '카드깡 시뮬레이터 사용 가이드',
    paragraphs: [
      '카드 언어와 부스터 시리즈, 팩·박스·카톤 개봉 단위를 선택하면 설정된 카톤 봉입 규칙을 바탕으로 가상 결과를 생성합니다.',
      '개봉 결과와 가격은 참고용이며 실제 상품의 구성이나 구매 결과를 예측하거나 보장하지 않습니다.'
    ],
    links: ['/lab/pack-simulator', '/lab', '/cards', '/prices']
  },
  '/tools/profit-calculator': {
    heading: '카드 손익 계산기',
    paragraphs: [
      '매입 단가와 판매 예정 단가, 수수료, 배송비를 입력하면 카드 거래의 예상 손익과 수익률, 손익분기 판매가를 계산할 수 있습니다.',
      '입력한 값은 현재 브라우저에서만 계산하며 저장되지 않습니다. 실제 거래 전에는 이용처의 수수료와 배송 조건을 다시 확인하세요.'
    ],
    links: ['/guides/profit-calculator', '/prices', '/cards', '/guide/card-price']
  },
  '/guides/profit-calculator': {
    heading: '카드 손익 계산 가이드',
    paragraphs: [
      '예상 정산금은 판매 예정가와 수량에서 판매 수수료와 판매 배송비를 뺀 금액입니다. 예상 손익은 예상 정산금에서 매입 금액과 매입 부대비용을 뺀 값입니다.',
      '손익분기 판매가는 수수료와 배송비까지 반영했을 때 손익이 0원이 되는 카드 1장당 판매 가격입니다. 실제 거래 결과는 거래처 정책과 배송 조건에 따라 달라질 수 있습니다.'
    ],
    links: ['/tools/profit-calculator', '/prices', '/guide/card-price', '/faq']
  },
  '/tools/portfolio-calculator': {
    heading: '원피스카드 포트폴리오 수익률 계산기',
    paragraphs: [
      '카드를 검색하고 매입가와 수량을 입력하면 현재 참고 시세와 비교한 평가금액, 평가손익과 수익률을 계산할 수 있습니다.',
      '로그인하지 않아도 계산할 수 있으며, 로그인 사용자는 계산한 매입 정보를 기존 포트폴리오에 저장할 수 있습니다.'
    ],
    links: ['/guides/portfolio-calculator', '/lab', '/prices', '/cards']
  },
  '/guides/portfolio-calculator': {
    heading: '포트폴리오 수익률 계산 가이드',
    paragraphs: [
      '카드를 선택한 뒤 매입가를 직접 입력하거나 매입일 이전의 유효한 참고 시세를 이용해 매입 단가를 추정할 수 있습니다.',
      '평가손익은 현재 참고 시세와 매입 원가의 차이이며 실제 판매 수수료, 배송비와 환율 변동은 포함하지 않습니다.'
    ],
    links: ['/tools/portfolio-calculator', '/lab', '/prices', '/data-policy']
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
    heading: '서비스 안내',
    paragraphs: [
      'Card Pone은 원피스카드 도감, 시세, 컬렉션, 일정과 실험실 도구를 제공하는 비공식 서비스입니다.',
      '카드 정보와 시세는 수집과 비교를 돕기 위한 참고 자료이며, 오류와 서비스 문의는 사이트의 안내된 이메일로 접수합니다.'
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

const SERVER_PAGE_DETAILS = {
  '/': [
    {
      heading: '주요 기능',
      items: [
        '한글판과 일본판 카드를 카드명, 카드번호, 시리즈와 레어도로 검색할 수 있습니다.',
        'Single과 PSA10의 최근 거래 기록과 기간별 가격 흐름을 같은 화면에서 비교할 수 있습니다.',
        '센터링 측정, 가상 개봉, 덱 구성과 손익 계산 도구는 로그인 없이 먼저 사용할 수 있습니다.',
        '국내 공인점포와 취급점포는 지역과 매장명으로 찾을 수 있습니다.'
      ]
    },
    {
      heading: '데이터를 확인할 때',
      paragraphs: [
        '카드 가격은 카드 상태, 거래 시점, 환율과 거래량에 따라 달라집니다. 단일 가격만 보지 않고 최근 거래일과 기간별 기록을 함께 확인하는 것이 좋습니다.',
        '보유 카드, 위시리스트와 포트폴리오 저장은 로그인 사용자에게 제공하며 도감 검색, 시세 열람과 실험실 도구는 비로그인 상태에서도 이용할 수 있습니다.'
      ]
    }
  ],
  '/cards': [
    {
      heading: '도감 검색 방법',
      items: [
        'OP05-119, ST21-014처럼 카드번호를 알고 있다면 번호 검색이 가장 정확합니다.',
        '카드명 검색은 같은 캐릭터의 다른 카드와 패러렐 버전을 함께 비교할 때 사용합니다.',
        'OP는 정규 부스터, EB는 엑스트라 부스터, ST는 스타터덱, PR은 프로모 계열로 구분합니다.',
        '한글판과 일본판은 별도 데이터로 관리하므로 먼저 언어판을 선택해야 합니다.'
      ]
    },
    {
      heading: '카드 상세에서 확인할 수 있는 정보',
      paragraphs: [
        '카드 이미지, 카드번호, 레어도, 수록 상품과 효과를 확인하고 연결된 시세 상품이 있으면 최근 가격 화면으로 이동할 수 있습니다.',
        '로그인 사용자는 보유중과 위시리스트를 저장하고 시세 알림 조건을 등록할 수 있습니다.'
      ]
    }
  ],
  '/prices': [
    {
      heading: '가격을 구분하는 기준',
      items: [
        'Single은 SNKRDUNK의 A등급 거래를 Card Pone에서 표시하는 이름입니다.',
        'PSA10은 PSA 10으로 분류된 거래만 별도로 표시합니다.',
        '최근 시세와 거래 기록이 없는 기간에는 임의의 거래를 만들지 않고 데이터가 없음을 표시합니다.',
        '여러 장 묶음이나 비정상적으로 큰 가격 편차는 일반적인 단일 카드 거래와 분리해 검토합니다.'
      ]
    },
    {
      heading: '차트 읽는 방법',
      paragraphs: [
        '7일, 1개월과 1년 버튼은 같은 거래 데이터를 조회 기간만 바꿔 보여줍니다. 거래가 없는 날은 새로운 거래로 계산하지 않습니다.',
        'Market Index는 PSA10 거래가 있는 구성 카드의 개별 지수를 동일 비중으로 평균한 참고 지표이며 실제 매입가나 판매가를 보장하지 않습니다.'
      ]
    }
  ],
  '/lab': [
    {
      heading: '실험실 도구',
      items: [
        '센터링 측정기: 촬영한 카드의 앞면 좌우·상하 인쇄 비율을 기기 안에서 계산합니다.',
        '카드깡 시뮬레이터: 시리즈와 팩·박스·카톤 단위를 선택해 가상 개봉을 진행합니다.',
        '덱 빌더: 리더 색상과 카드 투입 규칙을 확인하며 50장 덱을 구성합니다.',
        '포트폴리오 계산기: 매입가와 현재 참고 시세를 비교해 평가손익과 수익률을 계산합니다.'
      ]
    },
    {
      heading: '결과 사용 범위',
      paragraphs: [
        '실험실 결과는 수집과 덱 구성을 돕는 참고값입니다. 감정 등급, 실제 상품 봉입 결과, 대회 적합성과 실제 거래 수익을 보장하지 않습니다.'
      ]
    }
  ],
  '/lab/centering': [
    {
      heading: '측정 순서',
      items: [
        '슬리브와 탑로더를 제거하고 카드 네 모서리가 모두 보이게 촬영합니다.',
        '카드 외곽 네 점을 실제 둥근 모서리의 끝에 맞춰 원근을 보정합니다.',
        '보정된 카드에서 내부 인쇄 테두리의 좌우·상하 경계를 직접 확인합니다.',
        '결과 화면에서 비율과 측정 신뢰도, 추가 보정이 필요한 방향을 확인합니다.'
      ]
    },
    {
      heading: '측정에 포함되지 않는 항목',
      paragraphs: [
        '표면 흠집, 화이트닝, 모서리 마모, 인쇄 결함과 카드 진위는 분석하지 않습니다. 표시 점수는 센터링 참고값이며 감정 회사의 최종 등급이 아닙니다.'
      ]
    }
  ],
  '/lab/pack-simulator': [
    {
      heading: '개봉 단위',
      items: [
        '1팩은 가상 카톤에서 박스와 팩을 차례로 선택한 결과를 보여줍니다.',
        '1박스는 한 박스에 배정된 팩을 순서대로 열고 주요 획득 카드를 정리합니다.',
        '1카톤은 설정된 봉입 규칙에 따라 전체 박스 결과와 주요 히트를 요약합니다.'
      ]
    },
    {
      heading: '확률과 가격 안내',
      paragraphs: [
        '시리즈별 규칙이 확인된 경우 해당 설정을 사용하고, 확인되지 않은 항목은 시뮬레이션용 규칙을 적용합니다. 망가 카드와 특수 팩은 실제 구매 결과를 예측하지 않습니다.',
        '결과 카드의 가격은 도감에 연결된 참고 시세가 있을 때만 표시하며 가격이 없다고 카드가 존재하지 않는 것은 아닙니다.'
      ]
    }
  ],
  '/lab/decks': [
    {
      heading: '덱 구성 순서',
      items: [
        '먼저 사용할 언어판 환경과 리더 카드 1장을 선택합니다.',
        '리더 색상에 맞게 필터링된 카드에서 메인 덱 50장을 구성합니다.',
        '같은 카드번호의 최대 투입 매수와 금지·제한 카드 경고를 확인합니다.',
        '저장한 덱은 다시 불러와 카드 매수를 수정하거나 다른 버전으로 비교할 수 있습니다.'
      ]
    }
  ],
  '/guide/card-catalog': [
    {
      heading: '카드를 정확하게 찾는 순서',
      items: [
        '카드 하단의 카드번호를 확인하고 하이픈을 포함해 검색합니다.',
        '같은 번호의 카드가 여러 장이면 이미지, 수록 상품과 패러렐 여부를 비교합니다.',
        '카드번호를 모르면 캐릭터명으로 검색한 뒤 언어판과 시리즈 필터로 범위를 줄입니다.',
        '프로모 카드는 정규 부스터와 별도로 PR 또는 프로모 계열에서 확인합니다.'
      ]
    },
    {
      heading: '보유 카드 관리',
      paragraphs: [
        '로그인 후 카드 상세에서 보유중 또는 위시리스트를 선택할 수 있습니다. 같은 카드번호라도 이미지와 언어판이 다르면 별도 카드로 저장됩니다.'
      ]
    }
  ],
  '/guide/card-price': [
    {
      heading: '시세를 비교하는 순서',
      items: [
        '카드번호와 이미지를 확인해 같은 버전의 상품인지 먼저 확인합니다.',
        'Single과 PSA10을 섞지 않고 원하는 상태의 거래만 선택합니다.',
        '최근 거래일과 거래 건수를 확인한 뒤 7일·1개월·1년 흐름을 비교합니다.',
        '거래가 드문 카드는 마지막 거래가 오래됐을 수 있으므로 현재 판매 희망가와 동일하게 보지 않습니다.'
      ]
    },
    {
      heading: '원화 환산과 참고 범위',
      paragraphs: [
        '원화 표시는 수집 시점의 환율을 적용한 참고값입니다. 실제 결제 금액에는 환율 변동, 플랫폼 수수료, 배송비와 관세가 추가될 수 있습니다.'
      ]
    }
  ],
  '/guide/card-storage': [
    {
      heading: '보관 단계',
      items: [
        '카드를 만지기 전에 손의 수분과 먼지를 제거하고 카드에 맞는 소프트 슬리브를 사용합니다.',
        '가치가 높은 카드는 슬리브 후 탑로더나 카드세이버에 넣어 휨과 눌림을 줄입니다.',
        '바인더는 링이 카드에 닿지 않고 옆으로 넣는 포켓 구조인지 확인합니다.',
        '직사광선, 높은 습도와 급격한 온도 변화를 피하고 세워서 보관합니다.'
      ]
    }
  ],
  '/guide/shops': [
    {
      heading: '구매처 확인 순서',
      items: [
        '공식 홈페이지에서 공인점포와 취급점포 여부를 먼저 확인합니다.',
        '구매처 페이지에서 지역과 시군구를 선택하고 내 주변순으로 방문 가능한 매장을 찾습니다.',
        '영업시간, 휴무일과 상품 재고는 방문 전에 매장 지도 또는 공식 채널에서 다시 확인합니다.',
        '제휴 카드샵 표시는 Card Pone에 상세 정보 제공에 동의한 매장을 구분하기 위한 항목입니다.'
      ]
    }
  ],
  '/news': [
    {
      heading: '정보를 정리하는 기준',
      paragraphs: [
        '상품 발매와 이벤트 일정은 한글판과 일본판 공식 출처를 구분하고 원문 링크와 게시일을 함께 표시합니다. Card Pone에서 내용을 임의로 확정하지 않으며 변경 사항은 원문을 우선합니다.',
        '가이드 문서는 도감, 시세와 구매처를 실제로 사용하는 순서에 맞춰 작성하고 외부 구매 링크가 포함된 경우 해당 성격을 표시합니다.'
      ]
    }
  ],
  '/calendar': [
    {
      heading: '일정 표시 기준',
      items: [
        '상품은 공식 또는 연결된 상품 페이지의 발매일을 기준으로 표시합니다.',
        '공식 공지와 이벤트는 공지 게시일과 실제 개최일을 구분합니다.',
        '일본판 일정의 제목은 핵심 내용을 한국어로 요약하되 원문 링크를 함께 제공합니다.',
        '일정은 변경될 수 있으므로 참가나 구매 전 공식 원문을 다시 확인해야 합니다.'
      ]
    }
  ],
  '/shops': [
    {
      heading: '매장 검색 방법',
      items: [
        '전체 매장, 공인점포, 취급점포와 제휴 카드샵 유형을 선택할 수 있습니다.',
        '지역과 시군구를 선택하거나 위치 권한을 허용해 내 주변순으로 정렬할 수 있습니다.',
        '매장 상세에서 주소, 영업시간과 네이버지도·카카오맵 등 공개된 이동 경로를 확인합니다.'
      ]
    },
    {
      heading: '방문 전 확인',
      paragraphs: [
        'Card Pone은 실시간 재고를 보장하지 않습니다. 행사 일정, 재고, 구매 제한과 영업시간은 방문 전에 해당 매장에 직접 확인해야 합니다.'
      ]
    }
  ],
  '/cards/jp': [
    {
      heading: '일본판 도감 범위',
      items: [
        '일본에서 발매된 OP, EB, ST, 프로모 카드 데이터를 일본판으로 구분해 제공합니다.',
        '동일 카드번호라도 일러스트, 프로모 배포처와 수록 상품이 다르면 별도 카드로 확인합니다.',
        '카드 상세에서 연결된 SNKRDUNK 상품이 있는 경우에만 Single과 PSA10 참고 시세를 표시합니다.',
        '가격이 없는 카드는 카드 데이터 누락이 아니라 연결된 유효 거래 데이터가 없는 상태일 수 있습니다.'
      ]
    }
  ],
  '/cards/kr': [
    {
      heading: '한글판 도감 범위',
      items: [
        '국내 정식 발매된 OP, EB, ST와 프로모 카드의 카드번호, 이미지, 레어도와 수록 상품을 정리합니다.',
        '한글판과 일본판은 발매 순서와 수록 구성이 다르므로 언어판을 섞지 않고 별도 데이터로 관리합니다.',
        '시리즈 필터로 정규 부스터, 엑스트라 부스터, 스타터덱과 프로모 계열을 나눠 확인할 수 있습니다.',
        '카드 상세의 효과와 수록 정보는 공개된 공식 카드 정보를 기준으로 정리합니다.'
      ]
    }
  ],
  '/prices/cards': [
    {
      heading: '카드 시세 목록 기준',
      items: [
        '카드번호 또는 카드명으로 연결된 시세 상품을 검색하고 Single과 PSA10 상태를 따로 확인합니다.',
        '인기순은 수집된 상품 순위 정보를 사용하며 가격 높은순은 현재 표시 가능한 참고 가격을 기준으로 정렬합니다.',
        '최근 거래 기록이 없는 상태에는 임의 가격이나 거래일을 만들지 않고 가격 확인 상태로 남깁니다.',
        '상세 화면에서 기간별 차트와 실제로 저장된 최근 거래일을 함께 확인할 수 있습니다.'
      ]
    }
  ],
  '/prices/boxes': [
    {
      heading: '박스와 상품 시세',
      items: [
        '부스터 박스, 스타터덱, 프로모 팩과 카드 컬렉션 상품을 개별 카드 시세와 분리해 제공합니다.',
        '최신순은 확인된 상품 발매일을 우선 사용하며 날짜가 확인되지 않은 상품은 뒤에 배치합니다.',
        '표시 가격은 미개봉 상품의 공개 시장 참고가이며 카드 낱장 가격의 합계와 같지 않습니다.',
        '상품명과 이미지를 확인한 뒤 원문 보기에서 동일 상품인지 다시 대조할 수 있습니다.'
      ]
    }
  ],
  '/prices/index/manga': [
    {
      heading: '망가 카드 지수의 범위',
      paragraphs: [
        '망가 인덱스는 망가 카드로 분류된 구성 종목 중 유효한 PSA10 거래 기록이 있는 카드의 개별 지수를 동일 비중으로 종합한 참고 지수입니다.'
      ],
      items: [
        '각 카드는 초기 유효 거래 구간의 중앙값을 100으로 두고 이후 유효 거래 가격의 변화를 계산합니다.',
        '거래가 없는 날짜에는 가격을 새로 만들지 않고 마지막 유효값을 유지합니다.',
        '구성 카드와 개별 변동률은 구성 정보에서 직접 확인할 수 있습니다.'
      ]
    }
  ],
  '/prices/index/luffy': [
    {
      heading: '루피 카드 지수의 범위',
      paragraphs: [
        '루피 인덱스는 루피 테마 구성 종목 중 유효한 PSA10 거래 기록이 있는 카드의 개별 지수를 동일 비중으로 종합한 참고 지수입니다.'
      ],
      items: [
        '카드별 출시 시점이 달라도 각 카드의 초기 유효 거래 구간을 개별 기준점 100으로 사용합니다.',
        '여러 장 묶음이나 비정상 가격으로 판단된 거래는 개별 지수 계산 후보에서 제외합니다.',
        '1D와 기간별 변화는 지수 계산 기준을 바꾸지 않고 조회 구간만 달리 표시합니다.'
      ]
    }
  ],
  '/news/official': [
    {
      heading: '공식 정보 확인 기준',
      items: [
        '한글판과 일본판의 공식 공지를 언어판별로 구분하고 게시일과 원문 링크를 함께 제공합니다.',
        '신상품 발매, 프로모 배포, 규칙과 이벤트처럼 카드 수집과 이용에 직접 필요한 항목을 우선 정리합니다.',
        '일본어 공지는 핵심 내용을 한국어로 요약하되 날짜와 세부 조건은 공식 원문을 최종 기준으로 합니다.',
        '예약 판매나 제휴 상품 정보는 공식 공지와 섞지 않고 별도 유형으로 구분합니다.'
      ]
    }
  ],
  '/shops/official': [
    {
      heading: '공식 매장 정보',
      items: [
        '공식 홈페이지에 공개된 공인점포와 취급점포를 지역과 매장명으로 검색할 수 있습니다.',
        '내 주변순은 위치 권한을 허용한 경우 현재 위치와 저장된 매장 좌표 사이의 거리를 계산합니다.',
        '매장 재고, 대회 일정과 당일 영업 여부는 제공하지 않으므로 방문 전에 매장에 확인해야 합니다.',
        '지도 링크와 공식 검색 결과를 함께 확인해 같은 이름의 다른 매장과 혼동하지 않도록 합니다.'
      ]
    }
  ],
  '/shops/partners': [
    {
      heading: '제휴 카드샵 정보',
      items: [
        'Card Pone에 상세 정보 제공을 동의한 카드샵의 주소, 영업시간과 공개 채널을 모아 보여줍니다.',
        '상세 보기에서 네이버지도, 카카오맵, 스토어와 인스타그램 등 매장이 제공한 외부 링크를 확인합니다.',
        '제휴 표시는 재고나 상품 가격을 보증한다는 뜻이 아니며 방문과 구매 전 매장에 직접 확인해야 합니다.'
      ]
    }
  ],
  '/lab/decks/builder': [
    {
      heading: '덱 작성과 규칙 확인',
      items: [
        '먼저 리더 카드 1장을 선택하면 리더 색상에 맞는 카드만 후보 목록에 표시됩니다.',
        '메인 덱 50장, 동일 카드번호 투입 제한과 리더 색상 일치 여부를 작성 중에 확인합니다.',
        '추천 덱이나 저장된 덱을 불러온 뒤 카드별 투입 매수를 바꾸고 별도 덱으로 저장할 수 있습니다.',
        '환경과 금지·제한 카드가 변경될 수 있으므로 실제 대회 참가 전 최신 공식 규칙을 확인해야 합니다.'
      ]
    }
  ],
  '/tools/profit-calculator': [
    {
      heading: '손익 계산 항목',
      items: [
        '매입 단가와 수량, 예상 판매가, 판매 수수료, 배송비와 추가 비용을 각각 입력합니다.',
        '예상 정산액, 전체 원가, 평가손익, 수익률과 손익분기 판매가를 같은 입력값으로 계산합니다.',
        '계산값은 현재 브라우저에서만 처리되며 실제 플랫폼의 수수료 정책과 세금은 별도로 확인해야 합니다.'
      ]
    }
  ],
  '/tools/portfolio-calculator': [
    {
      heading: '포트폴리오 계산 범위',
      items: [
        '카드를 검색해 Single 또는 PSA10을 선택하고 구매 단가와 수량을 입력합니다.',
        '현재 확인 가능한 참고 시세와 입력한 원가를 비교해 평가금액, 평가손익과 수익률을 계산합니다.',
        '비로그인 상태에서도 계산할 수 있고 로그인한 사용자는 매입 기록을 자신의 포트폴리오에 저장할 수 있습니다.',
        '판매 수수료, 배송비와 환율 변동은 평가손익에 자동 포함되지 않습니다.'
      ]
    }
  ],
  '/terms': [
    {
      heading: '서비스 이용 범위',
      items: [
        '도감, 시세, 계산 도구와 구매처 정보는 카드 수집을 돕기 위한 참고 정보로 제공합니다.',
        '시세와 계산 결과는 실제 거래가, 감정 등급, 수익 또는 상품 재고를 보장하지 않습니다.',
        '계정 기능을 이용할 때 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위는 제한될 수 있습니다.',
        '서비스의 구체적인 이용 조건과 책임 범위는 이용약관 본문을 최종 기준으로 합니다.'
      ]
    }
  ],
  '/guide': [
    {
      heading: '가이드 구성',
      items: [
        '도감 검색, 카드 시세 확인, 보관 방법과 구매처 찾기를 실제 이용 순서에 맞춰 설명합니다.',
        '처음 수집하는 사용자는 카드번호 확인과 언어판 구분부터 읽고 필요한 주제로 이동할 수 있습니다.',
        '가격과 매장 정보는 변할 수 있으므로 가이드와 함께 최신 거래일과 공식 원문을 확인해야 합니다.'
      ]
    }
  ],
  '/faq': [
    {
      heading: '질문 분류',
      items: [
        '도감 검색과 카드번호, Single·PSA10 시세, 포트폴리오와 알림 기능의 자주 묻는 내용을 구분합니다.',
        '로그인이 필요한 저장 기능과 로그인 없이 사용할 수 있는 공개 도구의 차이를 안내합니다.',
        '답변에서 해결되지 않는 데이터 오류는 원문 링크와 카드번호를 함께 확인해 운영 문의로 전달할 수 있습니다.'
      ]
    }
  ],
  '/privacy': [
    {
      heading: '개인정보 처리 범위',
      items: [
        '로그인과 계정 기능 제공에 필요한 식별 정보와 사용자가 직접 저장한 서비스 데이터를 처리합니다.',
        '포트폴리오, 보유 카드, 위시리스트와 알림 설정은 로그인한 계정에 연결해 저장합니다.',
        '촬영한 센터링 이미지는 측정을 위해 기기 안에서 처리하며 서버에 저장하거나 전송하지 않습니다.',
        '보관 기간, 이용 목적과 삭제 요청 절차는 개인정보처리방침 본문에서 확인할 수 있습니다.'
      ]
    },
    {
      heading: '광고 쿠키와 이용자 선택',
      paragraphs: [
        'Google과 광고 파트너는 이전 방문 기록을 바탕으로 광고를 제공하기 위해 쿠키를 사용할 수 있습니다. 이용자는 Google 광고 설정에서 맞춤 광고를 관리할 수 있습니다.',
        'Google 광고가 동의 대상 지역에서 제공되는 경우 Google 인증 동의 관리 도구를 적용합니다.'
      ]
    }
  ],
  '/about': [
    {
      heading: '운영 목적',
      paragraphs: [
        'Card Pone은 국내 원피스카드 수집가가 언어판별 카드 정보, 공개 시장의 참고 시세, 발매 일정과 구매처를 여러 사이트에서 반복해서 찾는 불편을 줄이기 위해 운영합니다.',
        'BANDAI 및 공식 유통사와 제휴된 서비스가 아니며 카드와 상품의 권리는 각 권리자에게 있습니다.'
      ]
    },
    {
      heading: '오류와 문의',
      paragraphs: [
        '카드 이미지, 카드번호, 상품 매핑, 가격 기록이나 매장 정보의 오류는 운영자가 원문과 수집 기록을 대조한 뒤 수정합니다. 문의 주소는 사이트 하단의 서비스 안내에서 확인할 수 있습니다.'
      ]
    },
    {
      heading: '편집 독립성',
      paragraphs: [
        '광고 또는 제휴 여부는 도감 수록, 시세 표시, 구매처 검색 결과와 데이터 정정 기준에 영향을 주지 않습니다.',
        '외부 공지는 원문 링크와 날짜를 함께 표시하고, Card Pone의 검색과 비교 도구에 필요한 형태로 정리합니다.'
      ]
    }
  ],
  '/data-policy': [
    {
      heading: '수집 데이터의 구분',
      items: [
        '카드 기본 정보와 이미지는 언어판과 수록 상품을 구분해 관리합니다.',
        '시세는 Single과 PSA10을 분리하고 거래일, 가격과 데이터 출처를 함께 저장합니다.',
        '거래가 없는 날짜는 임의 가격을 생성하지 않으며 마지막 거래 기록과 구분합니다.',
        '매장과 공식 일정은 공개된 원문을 기준으로 갱신하고 원문 변경 가능성을 안내합니다.'
      ]
    },
    {
      heading: '갱신과 오류 처리',
      items: [
        '외부 플랫폼 데이터는 출처를 구분하고 공식 공지와 일정은 확인 가능한 원문으로 연결합니다.',
        '수집 작업이 실패하거나 거래 기록을 확인할 수 없는 경우 임의의 가격이나 거래일을 만들지 않습니다.',
        '오류가 확인되면 원문과 수집 기록을 다시 대조하고 수정 전까지 표시를 보류할 수 있습니다.'
      ]
    }
  ]
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
  '/lab': {
    heading: 'ワンピースカード ラボ',
    paragraphs: [
      'センタリング測定、開封シミュレーター、ポートフォリオ収益率計算など、カード収集に直接使える公開ツールをまとめています。',
      '各ツールは独立したページで利用でき、測定基準と結果の見方は公開ガイドで確認できます。'
    ],
    links: ['/jp/lab/centering', '/jp/lab/pack-simulator', '/jp/tools/portfolio-calculator', '/jp/guides/portfolio-calculator']
  },
  '/lab/centering': {
    heading: 'ワンピースカード センタリング測定',
    paragraphs: [
      '撮影ガイドにカードを合わせ、表面の左右と上下の印刷比率を端末内で分析し、測定信頼度を表示します。',
      'センタリングのみの参考ツールであり、表面、角、印刷欠陥、鑑定士の判断は含みません。'
    ],
    links: ['/jp/guides/centering', '/jp/lab', '/jp/cards', '/jp']
  },
  '/lab/pack-simulator': {
    heading: 'ワンピースカード 開封シミュレーター',
    paragraphs: [
      'シリーズと1パック、1ボックス、1カートンを選び、仮想開封結果を確認できます。',
      'カード図鑑の画像、番号、レアリティ、確認できる参考価格を表示しますが、実際の商品の封入結果を保証しません。'
    ],
    links: ['/jp/guides/pack-simulator', '/jp/lab', '/jp/cards', '/jp/prices']
  },
  '/guides/centering': {
    heading: 'センタリング測定ガイド',
    paragraphs: [
      'スリーブとローダーを外し、カードの四隅がすべて見えるように撮影してから、実際の外枠と印刷境界を順番に合わせます。',
      '結果は表面センタリングのみの参考値で、表面、角、エッジ、印刷欠陥を含む最終鑑定グレードではありません。'
    ],
    links: ['/jp/lab/centering', '/jp/lab', '/jp/cards', '/jp']
  },
  '/guides/pack-simulator': {
    heading: '開封シミュレーターガイド',
    paragraphs: [
      'カード言語、ブースターシリーズ、パック・ボックス・カートンの開封単位を選ぶと、設定されたカートン封入ルールから仮想結果を生成します。',
      '開封結果と価格は参考情報であり、実際の商品の内容や購入結果を予測・保証するものではありません。'
    ],
    links: ['/jp/lab/pack-simulator', '/jp/lab', '/jp/cards', '/jp/prices']
  },
  '/tools/profit-calculator': {
    heading: 'カード損益計算機',
    paragraphs: [
      '仕入れ値、販売予定価格、手数料、送料を入力すると、カード取引の予想損益、収益率、損益分岐販売価格を計算できます。',
      '入力値は現在のブラウザ内でのみ計算され、保存されません。実際の取引前には販売先の手数料と配送条件を確認してください。'
    ],
    links: ['/jp/guides/profit-calculator', '/jp/prices', '/jp/cards', '/jp']
  },
  '/guides/profit-calculator': {
    heading: 'カード損益計算機の使い方',
    paragraphs: [
      '予想受取額は、販売予定価格と数量から販売手数料と送料を差し引いた金額です。予想損益は、予想受取額から仕入れ金額と付帯費用を差し引いて求めます。',
      '損益分岐販売価格は、手数料と送料を反映したうえで損益が0円になるカード1枚あたりの販売価格です。実際の取引結果は、販売先の規約や配送条件によって変わることがあります。'
    ],
    links: ['/jp/tools/profit-calculator', '/jp/prices', '/jp/news', '/jp']
  },
  '/tools/portfolio-calculator': {
    heading: 'ワンピースカード ポートフォリオ収益率計算',
    paragraphs: [
      'カードを検索して購入価格と数量を入力すると、現在の参考価格と比較した評価額、評価損益、収益率を計算できます。',
      'ログインせずに計算でき、ログイン後は購入情報を既存のポートフォリオへ保存できます。'
    ],
    links: ['/jp/guides/portfolio-calculator', '/jp/lab', '/jp/prices', '/jp/cards']
  },
  '/guides/portfolio-calculator': {
    heading: 'ポートフォリオ収益率計算ガイド',
    paragraphs: [
      'カードを選び、購入価格を直接入力するか、購入日以前の有効な参考価格から購入単価を推定できます。',
      '評価損益は現在の参考価格と購入原価の差であり、販売手数料、送料、為替変動は含みません。'
    ],
    links: ['/jp/tools/portfolio-calculator', '/jp/lab', '/jp/prices', '/jp']
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

const JAPANESE_SERVER_PAGE_DETAILS = {
  '/tools/profit-calculator': [
    {
      heading: '計算する項目',
      items: [
        '仕入れ価格、数量、販売予定価格、販売手数料、送料、追加費用を入力します。',
        '受取見込額、総原価、予想損益、収益率、損益分岐価格を同じ条件から計算します。',
        '計算はブラウザ内で行われます。実際の販売前に利用するサービスの手数料と配送条件を確認してください。'
      ]
    }
  ],
  '/tools/portfolio-calculator': [
    {
      heading: '評価損益の範囲',
      items: [
        'カードを検索し、SingleまたはPSA10、購入単価、数量を入力します。',
        '確認できる現在の参考相場と取得原価を比較し、評価額、評価損益、収益率を表示します。',
        'ログイン前でも計算でき、ログイン後は購入記録をポートフォリオに保存できます。',
        '販売手数料、送料、税金、為替変動は評価損益に自動反映されません。'
      ]
    }
  ],
  '/': [
    {
      heading: '主な機能',
      items: [
        '日本版カードをカード名、カード番号、シリーズ、レアリティから検索できます。',
        'SingleとPSA10を分けて、最近の取引記録と期間別の価格推移を確認できます。',
        'センタリング測定、開封シミュレーター、デッキ作成、損益計算をログイン前に試せます。',
        '公式情報、発売予定、ショップ情報をカード図鑑とあわせて確認できます。'
      ]
    },
    {
      heading: '価格情報について',
      paragraphs: [
        '表示価格はカードの状態、取引日、取引件数、為替によって変わります。単一の価格だけでなく、最新取引日と期間別の記録をあわせて確認してください。'
      ]
    }
  ],
  '/cards': [
    {
      heading: 'カードの探し方',
      items: [
        'カード番号が分かる場合は、OP05-119やST21-014のように番号で検索します。',
        '同じキャラクターの別カードやパラレルを比較する場合はカード名検索を使います。',
        'OP、EB、ST、プロモを選び、シリーズとレアリティで候補を絞り込みます。',
        '同じカード番号でも画像や収録商品が異なるカードは別の項目として確認します。'
      ]
    }
  ],
  '/prices': [
    {
      heading: '相場の見方',
      items: [
        'SingleとPSA10は混ぜず、確認したい状態を選択します。',
        '最近の取引日と件数を確認してから、7日・1か月・1年の推移を比較します。',
        '取引がない日は新しい取引として生成せず、データがないことを表示します。',
        '複数枚販売や通常から大きく外れた価格は、単品取引と分けて確認します。'
      ]
    }
  ],
  '/lab': [
    {
      heading: '利用できるツール',
      items: [
        'センタリング測定では、表面の左右・上下の印刷比率を端末内で計算します。',
        '開封シミュレーターでは、シリーズとパック・ボックス・カートンを選んで仮想開封できます。',
        'デッキビルダーでは、リーダーの色と投入枚数ルールを確認しながら50枚のデッキを作成します。',
        'ポートフォリオ計算では、購入価格と参考相場から評価損益を確認できます。'
      ]
    }
  ],
  '/lab/centering': [
    {
      heading: '測定手順',
      items: [
        'スリーブとローダーを外し、カードの四隅が見えるように撮影します。',
        '外枠の四点を実際の角に合わせて遠近を補正します。',
        '補正後の画像で内側の印刷境界を上下左右に合わせます。',
        '比率と信頼度を確認し、必要な場合は境界を再調整します。'
      ]
    },
    {
      heading: '測定対象外',
      paragraphs: [
        '表面の傷、白欠け、角の摩耗、印刷不良、真贋は判定しません。表示結果はセンタリングのみの参考値です。'
      ]
    }
  ],
  '/lab/pack-simulator': [
    {
      heading: '開封単位',
      items: [
        '1パックは仮想カートンからボックスとパックを選んだ結果を表示します。',
        '1ボックスは割り当てられたパックを順番に開封し、主なカードをまとめます。',
        '1カートンは設定された封入ルールを使い、ボックス別の主な結果を表示します。'
      ]
    }
  ],
  '/calendar': [
    {
      heading: '日程の基準',
      items: [
        '商品は公式またはリンク先の商品ページに記載された発売日を使用します。',
        '公式告知の掲載日とイベントの開催日は分けて表示します。',
        '予定は変更される場合があるため、参加や購入前に公式原文を確認してください。'
      ]
    }
  ],
  '/news': [
    {
      heading: '情報源',
      paragraphs: [
        '商品、イベント、公式告知は日本版と韓国版の情報源を分け、原文リンクと日付を表示します。内容が変更された場合は公式原文を優先します。'
      ]
    }
  ],
  '/shops': [
    {
      heading: 'ショップ検索',
      items: [
        '地域または店舗名から公式ショップと公認店を検索できます。',
        '店舗詳細で住所、営業時間、地図と公式ページへのリンクを確認できます。',
        '在庫と営業時間は保証されないため、訪問前に店舗へ確認してください。'
      ]
    }
  ]
};

function createServerPageContent(pathname, seo) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const isJapanese = isJapanesePath(normalized);
  const contentMap = isJapanese ? JAPANESE_SERVER_PAGE_CONTENT : SERVER_PAGE_CONTENT;
  const contentKey = isJapanese ? getJapaneseBasePath(normalized) : normalized;
  const content = contentMap[contentKey] || {
    heading: seo.title.split('|')[0].trim(),
    paragraphs: [seo.description],
    links: isJapanese ? ['/jp/cards', '/jp/prices', '/jp/lab', '/jp/news', '/jp/shops'] : ['/cards', '/prices', '/lab', '/guide', '/shops']
  };
  const detailMap = isJapanese ? JAPANESE_SERVER_PAGE_DETAILS : SERVER_PAGE_DETAILS;
  const details = content.sections || detailMap[contentKey] || [];
  const links = content.links
    .map((path) => {
      const item = SITE_NAVIGATION_ITEMS.find((entry) => new URL(entry.url).pathname === path);
      const label = item?.name || getPageSeo(path)?.title?.split('|')[0]?.trim() || path;
      return `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  const paragraphs = content.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const detailSections = details.map((section) => {
    const sectionParagraphs = (section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
    const items = (section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `<section>
        <h2>${escapeHtml(section.heading)}</h2>
        ${sectionParagraphs}
        ${items ? `<ul>${items}</ul>` : ''}
      </section>`;
  }).join('');

  return `<main class="server-page-content">
      <h1>${escapeHtml(content.heading)}</h1>
      ${paragraphs}
      ${detailSections}
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

export function getPageSeo(pathname) {
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

  if (normalized === '/guides/centering' || normalized === '/jp/guides/centering') {
    const isJapaneseCenteringGuide = normalized.startsWith('/jp/');
    pageNode.mainEntity = isJapaneseCenteringGuide ? [
      {
        '@type': 'Question',
        name: '写真が少し傾いていても測定できますか？',
        acceptedAnswer: { '@type': 'Answer', text: '四隅がすべて見え、外枠を正確に指定できれば補正後に測定できます。強い傾きは信頼度を下げます。' }
      },
      {
        '@type': 'Question',
        name: '結果は鑑定の最終グレードですか？',
        acceptedAnswer: { '@type': 'Answer', text: 'いいえ。センタリングのみの参考値で、表面、角、エッジ、印刷状態は含みません。' }
      }
    ] : [
      {
        '@type': 'Question',
        name: '사진이 조금 기울어져도 측정할 수 있나요?',
        acceptedAnswer: { '@type': 'Answer', text: '네 모서리가 모두 보이고 카드 외곽을 정확히 맞출 수 있으면 원근 보정 후 측정할 수 있습니다. 기울기가 과도하면 신뢰도가 낮아질 수 있습니다.' }
      },
      {
        '@type': 'Question',
        name: '표시된 점수가 실제 감정 등급인가요?',
        acceptedAnswer: { '@type': 'Answer', text: '아닙니다. 센터링만 평가한 참고값이며 표면, 모서리, 엣지, 인쇄 상태를 포함한 최종 감정 등급이 아닙니다.' }
      }
    ];
  } else if (normalized === '/guides/pack-simulator' || normalized === '/jp/guides/pack-simulator') {
    const isJapaneseSimulatorGuide = normalized.startsWith('/jp/');
    pageNode.mainEntity = isJapaneseSimulatorGuide ? [
      {
        '@type': 'Question',
        name: '実際の商品の封入結果を保証しますか？',
        acceptedAnswer: { '@type': 'Answer', text: 'いいえ。設定された封入ルールによる仮想開封であり、実際の商品の内容を保証しません。' }
      },
      {
        '@type': 'Question',
        name: '同じシリーズを再度開封すると同じ結果ですか？',
        acceptedAnswer: { '@type': 'Answer', text: 'いいえ。開封ごとに新しい仮想カートンとランダム選択を使用します。' }
      }
    ] : [
      {
        '@type': 'Question',
        name: '실제 상품의 봉입 결과를 보장하나요?',
        acceptedAnswer: { '@type': 'Answer', text: '아닙니다. 제공된 봉입 규칙을 바탕으로 만든 가상 개봉이며 실제 상품의 구성과 결과를 보장하지 않습니다.' }
      },
      {
        '@type': 'Question',
        name: '같은 시리즈를 다시 열면 결과가 같나요?',
        acceptedAnswer: { '@type': 'Answer', text: '아닙니다. 개봉할 때마다 새로운 가상 카톤과 무작위 선택을 사용하므로 결과가 달라집니다.' }
      }
    ];
  } else if (normalized === '/guides/profit-calculator' || normalized === '/jp/guides/profit-calculator') {
    const isJapaneseProfitGuide = normalized.startsWith('/jp/');
    pageNode.mainEntity = isJapaneseProfitGuide ? [
      {
        '@type': 'Question',
        name: '損益はどのように計算されますか？',
        acceptedAnswer: { '@type': 'Answer', text: '予想受取額から仕入れ金額と付帯費用を差し引いて計算します。予想受取額には販売手数料と送料を反映します。' }
      },
      {
        '@type': 'Question',
        name: '損益分岐販売価格とは何ですか？',
        acceptedAnswer: { '@type': 'Answer', text: '手数料と送料を反映したうえで、損益が0円になるカード1枚あたりの販売価格です。' }
      }
    ] : [
      {
        '@type': 'Question',
        name: '손익은 어떻게 계산하나요?',
        acceptedAnswer: { '@type': 'Answer', text: '예상 정산금에서 매입 금액과 매입 부대비용을 뺀 값으로 계산합니다. 예상 정산금에는 판매 수수료와 배송비를 반영합니다.' }
      },
      {
        '@type': 'Question',
        name: '손익분기 판매가는 무엇인가요?',
        acceptedAnswer: { '@type': 'Answer', text: '수수료와 배송비까지 반영했을 때 손익이 0원이 되는 카드 1장당 판매 가격입니다.' }
      }
    ];
  } else if (normalized === '/guides/portfolio-calculator' || normalized === '/jp/guides/portfolio-calculator') {
    const isJapanesePortfolioGuide = normalized.startsWith('/jp/');
    pageNode.mainEntity = isJapanesePortfolioGuide ? [
      {
        '@type': 'Question',
        name: '表示価格は実際の売却価格を保証しますか？',
        acceptedAnswer: { '@type': 'Answer', text: 'いいえ。カードの状態や取引時期によって異なる参考値です。' }
      },
      {
        '@type': 'Question',
        name: 'ログインなしで計算できますか？',
        acceptedAnswer: { '@type': 'Answer', text: 'はい。計算は公開機能で、ポートフォリオへの保存時のみログインが必要です。' }
      },
      {
        '@type': 'Question',
        name: '日付の推定値はどのように選びますか？',
        acceptedAnswer: { '@type': 'Answer', text: '選択日を含む過去7日以内で最も近い有効な相場を使用します。' }
      }
    ] : [
      {
        '@type': 'Question',
        name: '표시 가격이 실제 판매 보장 가격인가요?',
        acceptedAnswer: { '@type': 'Answer', text: '아닙니다. 최근 거래와 현재 시세를 정리한 참고값이며 카드 상태와 거래 시점에 따라 달라질 수 있습니다.' }
      },
      {
        '@type': 'Question',
        name: '로그인하지 않아도 계산할 수 있나요?',
        acceptedAnswer: { '@type': 'Answer', text: '네. 검색과 계산은 공개 기능입니다. 계산 결과를 포트폴리오에 저장할 때만 로그인이 필요합니다.' }
      },
      {
        '@type': 'Question',
        name: '날짜 추정값은 어떻게 고르나요?',
        acceptedAnswer: { '@type': 'Answer', text: '선택한 날짜를 포함해 이전 7일 안에서 가장 가까운 유효 시세 기록을 사용합니다.' }
      }
    ];
  } else if (schemaType === 'FAQPage') {
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

const THIN_REGION_PATHS = new Set([
  '/shops/busan', '/shops/chungbuk', '/shops/chungnam', '/shops/daegu', '/shops/daejeon',
  '/shops/gangwon', '/shops/gwangju', '/shops/gyeongbuk', '/shops/gyeonggi', '/shops/gyeongnam',
  '/shops/incheon', '/shops/jeju', '/shops/jeonbuk', '/shops/jeonnam', '/shops/sejong',
  '/shops/seoul', '/shops/ulsan'
]);

const DUPLICATE_GUIDE_PATHS = new Set([
  '/guides/deck-builder',
  '/guides/centering',
  '/guides/pack-simulator',
  '/guides/profit-calculator',
  '/guides/portfolio-calculator'
]);

function getRobotsDirective(pathname, seo) {
  if (seo.robots) return seo.robots;
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const basePath = isJapanesePath(normalized) ? getJapaneseBasePath(normalized) : normalized;
  const directSeriesSlug = basePath.startsWith('/cards/') ? basePath.slice('/cards/'.length) : '';
  const isGeneratedSeries = basePath.startsWith('/cards/series/')
    || (isJapanesePath(normalized) && directSeriesSlug && !directSeriesSlug.includes('/'));
  const isGeneratedMarketDetail = /^\/prices\/(?:card|product|box)\//.test(basePath);
  const isAffiliateListing = ['/news/preorder', '/news/oripa', '/news/supplies'].includes(basePath);
  if (isGeneratedSeries || isGeneratedMarketDetail || THIN_REGION_PATHS.has(basePath)
    || isAffiliateListing || DUPLICATE_GUIDE_PATHS.has(basePath)) {
    return 'noindex,follow';
  }
  return 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
}

export function applySeo(html, pathname, seo) {
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
  const robots = getRobotsDirective(pathname, seo);

  let nextHtml = html
    .replace(/<html\b[^>]*\blang="[^"]*"/i, `<html lang="${isJapanese ? 'ja' : 'ko'}"`)
    .replace(/<title>.*?<\/title>/is, `<title>${title}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);

  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="keywords" content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${keywords}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="robots" content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${robots}" />`);
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
