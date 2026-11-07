// Shared by the /guide/articles pages, their pre-rendered HTML and the daily publish workflow.
// Each article is one src/data/articles/<slug>.json file with { meta, editorial, faq }. An article goes live
// on its meta.publishAt date (KST) at the time of its slot (meta.order 1-3), or at meta.publishTime when set: the
// site filters by time on load, and the publish workflow redeploys after each slot so the pre-rendered HTML and the
// sitemap pick it up.
export const ARTICLES_PATH = '/guide/articles';

export const ARTICLE_CATEGORIES = {
  deck: '덱·입문',
  set: '신상품·시리즈',
  price: '시세 분석',
  collect: '수집·관리'
};

export const articlePath = (slug) => `${ARTICLES_PATH}/${slug}`;

export function getArticleSlug(pathname = '') {
  const match = String(pathname).match(/^\/guide\/articles\/([a-z0-9-]+)\/?$/);
  return match ? match[1] : '';
}

// KST times the three daily articles go live, by meta.order. Keep in sync with articles-daily-publish.yml.
export const ARTICLE_SLOT_TIMES = { 1: '07:00', 2: '12:00', 3: '18:00' };

export function getKstDateKeyFor(value = Date.now()) {
  return new Date(Number(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// YYYY-MM-DDTHH:MM in KST.
export function getKstMinuteKeyFor(value = Date.now()) {
  return new Date(Number(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export const getArticlePublishKey = (meta) => `${meta.publishAt}T${meta.publishTime || ARTICLE_SLOT_TIMES[meta.order] || '00:00'}`;

// Newest first. nowKey is a KST minute key; a bare date means the end of that day.
export function getPublishedArticleMetas(metas = [], nowKey = getKstMinuteKeyFor()) {
  const limit = nowKey.length === 10 ? `${nowKey}T23:59` : nowKey;
  return metas
    .filter((meta) => meta?.slug && meta.publishAt && getArticlePublishKey(meta) <= limit)
    .sort((a, b) => getArticlePublishKey(b).localeCompare(getArticlePublishKey(a)) || (a.order || 0) - (b.order || 0));
}

export const ARTICLES_SEO = {
  title: '원피스카드 읽을거리 - 덱·신상품·시세 분석 글 모음 | Card Pone',
  description: '원피스카드 스타트 덱, 신상품, 시리즈별 고가 카드, 등급 카드처럼 Card Pone 도감과 SNKRDUNK 거래 데이터로 정리한 글을 날짜순으로 모았습니다.',
  keywords: '원피스카드 정보, 원피스카드 블로그, 원피스카드 시세 분석, 원피스카드 덱 추천, 원피스카드 신상품'
};

// The hub lists every published article by category, newest first.
export function buildArticlesHubEditorial(publishedMetas = []) {
  const [latest] = publishedMetas;
  const sections = Object.entries(ARTICLE_CATEGORIES)
    .map(([category, label]) => ({
      heading: label,
      links: publishedMetas
        .filter((meta) => meta.category === category)
        .map((meta) => ({ href: articlePath(meta.slug), label: `${meta.publishAt.slice(5).replace('-', '.')} ${meta.label || meta.title}` }))
    }))
    .filter((section) => section.links.length);
  return {
    heading: '원피스카드 읽을거리',
    reviewedAt: latest?.publishAt || '',
    paragraphs: [
      'Card Pone 도감과 SNKRDUNK 실제 거래 기록을 바탕으로 덱, 신상품, 시세, 수집에 관한 글을 매일 정리합니다.',
      latest ? `가장 최근 글은 ${latest.publishAt.replaceAll('-', '.')}에 올라온 「${latest.label || latest.title}」입니다.` : '아직 올라온 글이 없습니다.'
    ],
    summary: [],
    sections,
    checklist: []
  };
}

// Pre-rendered body for one article: the same blocks the page shows, plus its checklist.
export function getArticleSeoContent(article) {
  const { editorial } = article;
  return {
    heading: editorial.heading,
    paragraphs: editorial.paragraphs,
    sections: [
      ...(editorial.summary?.length ? [{ heading: '핵심 숫자', stats: editorial.summary }] : []),
      ...editorial.sections,
      ...(editorial.checklist?.length ? [{ heading: '체크리스트', items: editorial.checklist }] : [])
    ]
  };
}
