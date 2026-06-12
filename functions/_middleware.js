const SITE_ORIGIN = 'https://www.optcgkorea.com';

const PAGE_SEO = {
  '/': {
    title: 'OPTCG Korea - 원피스 카드 도감, 시세, 컬렉션 관리',
    description: 'OPTCG Korea는 원피스 카드게임 유저를 위한 비공식 카드 도감, 시세, 컬렉션 관리 서비스입니다.',
    keywords: '원피스카드, 원피스 카드게임, 원피스카드 도감, 원피스카드 시세, OPTCG, OPTCG Korea'
  },
  '/cards': {
    title: '원피스 카드 도감 - 한글판 일본판 카드 검색 | OPTCG Korea',
    description: '한글판과 일본판 원피스 카드게임 카드를 OP, EB, ST, 프로모 시리즈별로 검색하고 보유 카드와 위시리스트를 관리할 수 있습니다.',
    keywords: '원피스카드 도감, 원피스 카드 검색, OP16, OP15, 일본판 원피스카드, 한글판 원피스카드'
  },
  '/prices': {
    title: '원피스 카드 시세 - 카드별 시세 그래프와 박스 가격 | OPTCG Korea',
    description: '원피스 카드별 시세, 박스 가격, PSA10 통합 시세, 최근 거래 기록과 가격 그래프를 확인할 수 있습니다.',
    keywords: '원피스카드 시세, 원피스 카드 가격, 원피스카드 박스 시세, PSA10 시세, SNKRDUNK 원피스카드'
  },
  '/news': {
    title: '원피스 카드 공지사항 및 업데이트 | OPTCG Korea',
    description: 'OPTCG Korea의 카드 데이터 업데이트, 시세 기능 개선, 원피스 카드게임 관련 공지사항을 확인할 수 있습니다.',
    keywords: 'OPTCG Korea 공지사항, 원피스카드 업데이트, 원피스카드 뉴스'
  },
  '/shops': {
    title: '원피스 카드 구매처 - 지역별 공인점포 취급점포 | OPTCG Korea',
    description: '원피스 카드게임 오프라인 구매처를 지역별로 검색하고 공인점포와 취급점포 정보를 확인할 수 있습니다.',
    keywords: '원피스카드 구매처, 원피스 카드 공인점포, 원피스카드 매장, 원피스카드 취급점포'
  },
  '/terms': {
    title: '이용약관 | OPTCG Korea',
    description: 'OPTCG Korea 서비스 이용 조건과 시세 정보, 컬렉션 관리 기능의 이용 기준을 안내합니다.',
    keywords: 'OPTCG Korea 이용약관, 원피스카드 서비스 약관'
  },
  '/privacy': {
    title: '개인정보처리방침 | OPTCG Korea',
    description: 'OPTCG Korea의 개인정보 수집, 이용, 보관, 삭제 및 문의 방법을 안내합니다.',
    keywords: 'OPTCG Korea 개인정보처리방침, 원피스카드 개인정보'
  }
};

function getPageSeo(pathname) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return PAGE_SEO[normalized] || null;
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
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: seo.title,
    description: seo.description,
    inLanguage: 'ko-KR',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'OPTCG Korea',
      url: `${SITE_ORIGIN}/`
    },
    about: seo.keywords
  });
}

function applySeo(html, pathname, seo) {
  const canonicalUrl = `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const keywords = escapeHtml(seo.keywords);
  const url = escapeHtml(canonicalUrl);
  const image = `${SITE_ORIGIN}/og-preview.jpg`;

  let nextHtml = html
    .replace(/<title>.*?<\/title>/is, `<title>${title}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);

  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="keywords" content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${keywords}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="robots" content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${seo.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${url}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:locale" content="[^"]*"\s*\/?>/i, '<meta property="og:locale" content="ko_KR" />');
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${image}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${description}" />`);
  nextHtml = replaceOrInsertMeta(nextHtml, /<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${image}" />`);

  const pageJsonLd = `<script type="application/ld+json" id="optcg-server-page-jsonld">${createJsonLd(pathname, seo)}</script>`;
  if (nextHtml.includes('id="optcg-server-page-jsonld"')) {
    nextHtml = nextHtml.replace(/<script type="application\/ld\+json" id="optcg-server-page-jsonld">.*?<\/script>/is, pageJsonLd);
  } else {
    nextHtml = nextHtml.replace('</head>', `    ${pageJsonLd}\n  </head>`);
  }
  return nextHtml;
}

function shouldSkip(pathname) {
  if (pathname.startsWith('/api/')) return true;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/rss.xml' || pathname === '/ads.txt') return true;
  return /\.[a-z0-9]{2,8}$/i.test(pathname);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
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
