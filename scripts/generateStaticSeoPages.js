import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySeo, getPageSeo } from '../functions/_middleware.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const sourceHtmlPath = path.join(distDir, 'index.html');
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

if (!fs.existsSync(sourceHtmlPath)) {
  throw new Error('Vite output is missing. Run this script after the production build.');
}

const sourceHtml = fs.readFileSync(sourceHtmlPath, 'utf8');
const routePaths = new Set(requiredPaths);
for (const sitemapPath of sitemapPaths) {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  for (const pathname of getSitemapPaths(xml)) routePaths.add(pathname);
}

let generated = 0;
for (const pathname of routePaths) {
  const seo = getPageSeo(pathname);
  if (!seo) continue;
  const outputPath = getOutputPath(pathname);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, applySeo(sourceHtml, pathname, seo), 'utf8');
  generated += 1;
}

console.log(`[seo] Static route HTML: ${generated} pages`);
