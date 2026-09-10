export const SEARCH_PAGES = [
  { title: '수집 방향 가이드', href: '/guide/collection/start', keywords: ['입문', '초보', '수집 추천', '뭐 모으지', '뭐 모아야', '무엇을 모아야', '수집 방향'], description: '수집 목표와 카드 버전, 구매 전 확인할 기준' },
  { title: '망가 카드 컬렉션', href: '/guide/collection/manga', keywords: ['망가', '만화카드', '만화 카드', '망가레어', '코믹 패러렐', 'manga'], description: '시리즈별 망가 카드 이미지와 카드번호' },
  { title: '챔피언십 카드 컬렉션', href: '/guide/collection/championship', keywords: ['챔피언십', '챔피언쉽', '대회 카드', 'championship'], description: '일본판·한국판 챔피언십 카드 목록' },
  { title: '플래그십 카드 컬렉션', href: '/guide/collection/flagship', keywords: ['플래그십', '플래그쉽', 'flagship'], description: '연도별 플래그십 카드 목록' },
  { title: '프로모 카드 컬렉션', href: '/guide/collection/promo', keywords: ['프로모', '부록', '응모', '점프', 'promo'], description: '배포 방식과 출처별 프로모 카드 목록' },
  { title: '카드 시세 가이드', href: '/guide/card-price', keywords: ['시세', '가격', 'PSA10', 'Single', '감정', '거래'], description: '카드 버전과 상태를 구분해 시세 비교하기' },
  { title: '카드 보관 가이드', href: '/guide/card-storage', keywords: ['보관', '슬리브', '바인더', '보호', '탑로더'], description: '카드 보관과 보호 용품 확인' },
  { title: '구매처 가이드', href: '/guide/shops', keywords: ['구매처', '매장', '파는 곳', '공인점', '카드샵'], description: '공인점포·취급점포와 지역별 매장 찾기' },
  { title: '박스 선택 가이드', href: '/guide/box-recommendation', keywords: ['박스', '팩 추천', '박스 추천', '개봉', '봉입'], description: '박스 수집과 개봉 목표에 따른 비교 기준' },
  { title: '센터링 실험실', href: '/lab/centering', keywords: ['센터링', '센타링', 'centering', '테두리'], description: '카드 이미지의 테두리 비율 확인' },
  { title: '팩 개봉 시뮬레이터', href: '/lab/pack-simulator', keywords: ['팩', '개봉', '시뮬레이터', '실험실'], description: '팩 개봉 시뮬레이션' },
  { title: '덱 빌더', href: '/lab/decks/builder', keywords: ['덱', '덱빌더', '리더', 'deck'], description: '카드를 골라 덱 구성하기' },
  { title: '포트폴리오 계산기', href: '/tools/portfolio-calculator', keywords: ['포트폴리오', '계산기', '보유 카드'], description: '카드 수집 포트폴리오 계산' },
  { title: '정보 · 공식 소식', href: '/news', keywords: ['소식', '정보', '공지', '뉴스', '이벤트'], description: '사이트 가이드와 공식 소식' },
  { title: '발매 일정', href: '/calendar', keywords: ['발매', '출시', '일정', '캘린더'], description: '카드 상품 발매 일정 확인' },
  { title: '도감 사용 가이드', href: '/guide/card-catalog', keywords: ['도감', '검색', '카드번호', '일련번호'], description: '카드 검색과 수집 목록 사용 방법' }
].map(item => ({ ...item, type: 'guides', id: item.href }));

export const normalizeSiteSearch = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\u2010-\u2015\u2212._・·-]+/g, '').trim();

export function parseSiteQuery(value) {
  const query = String(value || '').normalize('NFKC').trim().slice(0, 100);
  const compact = normalizeSiteSearch(query);
  const code = compact.match(/^(op|eb|st|prb)(\d{2})(\d{3})$/i);
  const promo = compact.match(/^p(\d{3})$/i);
  const series = compact.match(/^(op|eb|st|prb)k?(\d{1,2})$/i);
  const aliases = { '히로인즈': 'EB03', '히로인': 'EB03', 'heroines': 'EB03' };
  const cleaned = query.replace(/(.+?)\s*(시세|가격|카드|검색)$/u, '$1').trim();
  const cardQuery = code ? `${code[1].toUpperCase()}${code[2]}-${code[3]}` : promo ? `P-${promo[1]}` : series ? `${series[1].toUpperCase()}${series[2].padStart(2, '0')}` : aliases[compact] || cleaned;
  return { query, cardQuery, exactCode: !!(code || promo), seriesCode: series ? cardQuery : aliases[compact] === 'EB03' ? 'EB03' : '' };
}

function relevance(query, values) {
  const q = normalizeSiteSearch(query);
  if (!q) return 0;
  const fields = values.filter(Boolean).map(normalizeSiteSearch);
  if (fields.includes(q)) return 100;
  if (fields.some(text => text.startsWith(q))) return 70;
  if (fields.some(text => text.includes(q))) return 50;
  const tokens = String(query).trim().split(/\s+/).map(normalizeSiteSearch).filter(Boolean);
  return tokens.length > 1 && tokens.every(token => fields.some(text => text.includes(token))) ? 30 : 0;
}

export function searchSiteContent(query, series = [], documents = []) {
  const parsed = parseSiteQuery(query);
  if (!parsed.query) return [];
  const pages = new Map(SEARCH_PAGES.map(item => [item.href, { ...item, keywords: [...item.keywords] }]));
  for (const item of documents) {
    const existing = pages.get(item.href);
    if (existing) existing.keywords.push(item.title, ...(item.keywords || []));
    else pages.set(item.href, { ...item, type: 'guides', id: item.href, keywords: item.keywords || [] });
  }
  const intent = parsed.query.replace(/원피스\s*카드(?:게임)?/g, '').trim();
  const entries = [...pages.values(), ...series.filter(item => ['KR', 'JP'].includes(item.locale)).map(item => ({
    id: item.id, type: 'series', title: `${item.baseSeriesId || item.id} 시리즈 가이드 · ${item.koName || item.enName}`,
    description: item.queryLabel || item.kindKo, locale: item.locale,
    href: `/guides/series/${normalizeSiteSearch(item.id)}`,
    catalogHref: `/cards/series/${normalizeSiteSearch(item.id)}`,
    keywords: [item.baseSeriesId, item.officialSeriesKeyword, item.koName, item.enName, item.kindKo, item.queryLabel]
  }))];
  return entries.map(item => ({ ...item, score: Math.max(relevance(parsed.query, [item.title, ...item.keywords]), relevance(intent, [item.title, ...item.keywords]), parsed.seriesCode ? relevance(parsed.seriesCode, item.keywords) : 0) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ko'));
}

export function rankSiteCards(cards, query) {
  const target = parseSiteQuery(query).cardQuery;
  const unique = [...new Map(cards.filter(card => card?.id).map(card => [card.id, card])).values()];
  return unique.sort((a, b) => relevance(target, [b.cardNo, b.baseCardNo, b.name, b.nameKo]) - relevance(target, [a.cardNo, a.baseCardNo, a.name, a.nameKo]) || String(a.cardNo).localeCompare(String(b.cardNo)));
}

export function createSiteSearchLoader({ searchCards, fetchShops, now = Date.now }) {
  const cache = new Map(), pending = new Map();
  return async query => {
    const { cardQuery, exactCode } = parseSiteQuery(query);
    if (!cardQuery || cardQuery.length < 2) return { cards: [], shops: [], errors: [] };
    const key = normalizeSiteSearch(cardQuery);
    if (cache.get(key)?.expires > now()) return cache.get(key).data;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const shopQuery = cardQuery.replace(/(.+?)\s*(카드\s*샵|카드\s*매장|구매처|매장|파는\s*곳)$/u, '$1').trim();
      const results = await Promise.allSettled([
        searchCards(cardQuery, 'KR'), searchCards(cardQuery, 'JP'),
        exactCode ? Promise.resolve([]) : fetchShops({ q: shopQuery })
      ]);
      const data = { cards: rankSiteCards(results.slice(0, 2).flatMap(r => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []), cardQuery),
        shops: results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [],
        errors: results.flatMap((r, i) => r.status === 'rejected' ? [i < 2 ? 'cards' : 'shops'] : []) };
      if (!data.errors.length) {
        if (cache.size >= 20) cache.delete(cache.keys().next().value);
        cache.set(key, { data, expires: now() + 5 * 60 * 1000 });
      }
      return data;
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  };
}
