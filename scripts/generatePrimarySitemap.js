import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSeriesGuideEntries, seriesGuideSourcePaths } from './seriesGuideSeo.js';
import { getBoxRecommendationEntries, boxRecommendationSourcePaths } from './boxRecommendationSeo.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(rootDir, 'public', 'sitemap.xml');
const siteOrigin = 'https://www.optcgkorea.com';

const sourcePaths = [
  path.join(rootDir, 'src', 'RenewApp.jsx'),
  path.join(rootDir, 'functions', '_middleware.js'),
  ...seriesGuideSourcePaths,
  ...boxRecommendationSourcePaths.map((sourceUrl) => fileURLToPath(sourceUrl))
];

const lastmod = new Date(Math.max(...sourcePaths.map((sourcePath) => fs.statSync(sourcePath).mtimeMs)))
  .toISOString()
  .slice(0, 10);

const paths = [
  '/',
  '/about',
  '/data-policy',
  '/terms',
  '/privacy',
  '/cards',
  '/cards/jp',
  '/cards/kr',
  '/prices',
  '/prices/cards',
  '/prices/boxes',
  '/prices/index/manga',
  '/prices/index/luffy',
  '/news',
  '/news/official',
  '/calendar',
  '/guide',
  '/faq',
  '/guide/card-storage',
  '/guide/shops',
  '/guide/card-price',
  '/guide/card-catalog',
  '/guide/box-recommendation',
  '/guide/box-recommendation/high-price',
  '/guide/box-recommendation/stable',
  '/guide/box-recommendation/more-hits',
  '/shops',
  '/shops/official',
  '/shops/partners',
  '/lab',
  '/lab/centering',
  '/lab/pack-simulator',
  '/lab/decks',
  '/lab/decks/builder',
  '/tools/profit-calculator',
  '/tools/portfolio-calculator'
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const seriesGuidePaths = getSeriesGuideEntries().map((entry) => entry.pathname);
const boxRecommendationPaths = getBoxRecommendationEntries().map((entry) => entry.pathname);
const entries = [...paths, ...seriesGuidePaths, ...boxRecommendationPaths].map((urlPath) => {
  const priority = urlPath === '/' ? '1.0' : urlPath.split('/').filter(Boolean).length === 1 ? '0.9' : '0.8';
  return [
    '  <url>',
    `    <loc>${escapeXml(`${siteOrigin}${urlPath}`)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    `    <priority>${priority}</priority>`,
    '  </url>'
  ].join('\n');
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries,
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync(outputPath, xml, 'utf8');
console.log(`[seo] Primary sitemap: ${entries.length} high-value URLs`);
