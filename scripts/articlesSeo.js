import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES_PATH, ARTICLES_SEO, articlePath, buildArticlesHubEditorial, getArticleSeoContent, getKstDateKeyFor, getPublishedArticleMetas } from '../lib/articles.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const articlesDir = path.join(rootDir, 'src', 'data', 'articles');

export function readArticles() {
  if (!fs.existsSync(articlesDir)) return [];
  return fs.readdirSync(articlesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(articlesDir, name), 'utf8')));
}

// ARTICLES_TODAY (YYYY-MM-DD) lets a build preview a later day; otherwise today's KST date decides what is live.
export function getArticleEntries({ today = process.env.ARTICLES_TODAY || getKstDateKeyFor() } = {}) {
  const articles = readArticles();
  const published = getPublishedArticleMetas(articles.map((article) => article.meta), today);
  if (!published.length) return [];
  const bySlug = new Map(articles.map((article) => [article.meta.slug, article]));
  const hubEditorial = buildArticlesHubEditorial(published);
  const hub = {
    pathname: ARTICLES_PATH,
    seo: {
      ...ARTICLES_SEO,
      schemaType: 'CollectionPage',
      editor: 'Card Pone 데이터 편집',
      reviewedAt: hubEditorial.reviewedAt,
      heading: hubEditorial.heading,
      paragraphs: hubEditorial.paragraphs,
      sections: hubEditorial.sections,
      links: ['/guide', '/market-report', '/prices']
    }
  };
  // Other pages resolve their own link labels; links to articles carry theirs, since the server has no article titles.
  const labelBySlug = new Map(published.map((meta) => [meta.slug, meta.label || meta.title]));
  const pages = published.map((meta) => {
    const article = bySlug.get(meta.slug);
    const related = meta.related || [];
    const articleLinks = related
      .map((href) => ({ href, label: labelBySlug.get(href.slice(ARTICLES_PATH.length + 1)) }))
      .filter((link) => link.href.startsWith(`${ARTICLES_PATH}/`) && link.label);
    const content = getArticleSeoContent(article);
    return {
      pathname: articlePath(meta.slug),
      publishAt: meta.publishAt,
      seo: {
        title: meta.title,
        description: meta.description,
        keywords: meta.keywords,
        schemaType: 'Article',
        editor: 'Card Pone 데이터 편집',
        reviewedAt: article.editorial.reviewedAt || meta.publishAt,
        ...content,
        sections: [...content.sections, { heading: '함께 볼 글', links: [{ href: ARTICLES_PATH, label: '원피스카드 읽을거리 전체' }, ...articleLinks] }],
        links: ['/guide', ...related.filter((href) => !href.startsWith(`${ARTICLES_PATH}/`))]
      }
    };
  });
  return [hub, ...pages];
}
