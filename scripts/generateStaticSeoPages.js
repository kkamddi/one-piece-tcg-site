import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySeo, getPageSeo } from '../functions/_middleware.js';
import { getSeriesGuideEntries } from './seriesGuideSeo.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const sourceHtmlPath = path.join(distDir, 'index.html');
const notFoundHtmlPath = path.join(distDir, '404.html');
const sitemapPaths = [
  path.join(rootDir, 'public', 'sitemap.xml'),
  path.join(rootDir, 'public', 'sitemap-jp.xml')
];
const requiredPaths = [
  '/',
  '/cards',
  '/prices',
  '/lab',
  '/lab/centering',
  '/lab/pack-simulator',
  '/lab/decks',
  '/lab/decks/builder',
  '/guides/deck-builder',
  '/tools/profit-calculator',
  '/tools/portfolio-calculator',
  '/calendar',
  '/news',
  '/shops',
  '/jp',
  '/jp/cards',
  '/jp/prices',
  '/jp/lab',
  '/jp/lab/centering',
  '/jp/lab/pack-simulator',
  '/jp/tools/profit-calculator',
  '/jp/tools/portfolio-calculator',
  '/jp/calendar',
  '/jp/news',
  '/jp/shops'
];

function getSitemapPaths(xml) {
  return [...xml.matchAll(/<loc>https:\/\/www\.optcgkorea\.com([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');
}

function getOutputPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`Unsafe SEO route: ${pathname}`);
  }
  if (!segments.length) return sourceHtmlPath;
  const fileName = `${segments.pop()}.html`;
  return path.join(distDir, ...segments, fileName);
}

function createNotFoundHtml() {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, follow" />
    <meta name="description" content="요청한 페이지를 찾을 수 없습니다." />
    <title>페이지를 찾을 수 없습니다 | Card Pone</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f7f7f6; color: #17191d; font-family: Arial, "Noto Sans KR", sans-serif; }
      main { width: min(100%, 560px); padding: 40px; border: 1px solid #dedede; background: #fff; text-align: center; }
      strong { display: block; margin-bottom: 12px; color: #d64d36; font-size: 14px; }
      h1 { margin: 0 0 12px; font-size: clamp(28px, 7vw, 42px); }
      p { margin: 0 0 28px; color: #626772; line-height: 1.7; }
      nav { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
      a { padding: 11px 16px; border: 1px solid #d8d8d8; color: inherit; font-weight: 700; text-decoration: none; }
      a:first-child { border-color: #17191d; background: #17191d; color: #fff; }
    </style>
  </head>
  <body>
    <main>
      <strong>404</strong>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소가 변경되었거나 존재하지 않는 페이지입니다.</p>
      <nav aria-label="주요 메뉴">
        <a href="/">홈</a>
        <a href="/cards">도감</a>
        <a href="/prices">시세</a>
        <a href="/news">정보</a>
      </nav>
    </main>
  </body>
</html>`;
}

if (!fs.existsSync(sourceHtmlPath)) {
  throw new Error('Vite output is missing. Run this script after the production build.');
}

const sourceHtml = fs.readFileSync(sourceHtmlPath, 'utf8');
const routePaths = new Set(requiredPaths);
const seriesGuideEntries = [
  ...getSeriesGuideEntries(),
  ...getSeriesGuideEntries({ japanese: true })
];
const seriesGuideSeo = new Map(seriesGuideEntries.map((entry) => [entry.pathname, entry.seo]));
for (const entry of seriesGuideEntries) {
  const match = entry.pathname.match(/^(\/jp)?\/guides\/series\/([^/]+)$/);
  if (!match) continue;
  const prefix = match[1] || '';
  for (const slug of entry.catalogSlugs || [match[2]]) {
    routePaths.add(`${prefix}/cards/${slug}`);
    routePaths.add(`${prefix}/cards/series/${slug}`);
  }
}
for (const sitemapPath of sitemapPaths) {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  for (const pathname of getSitemapPaths(xml)) routePaths.add(pathname);
}

let generated = 0;
for (const pathname of routePaths) {
  const seo = seriesGuideSeo.get(pathname) || getPageSeo(pathname);
  if (!seo) continue;
  const outputPath = getOutputPath(pathname);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, applySeo(sourceHtml, pathname, seo), 'utf8');
  generated += 1;
}

fs.writeFileSync(notFoundHtmlPath, createNotFoundHtml(), 'utf8');

console.log(`[seo] Static route HTML: ${generated} pages`);
