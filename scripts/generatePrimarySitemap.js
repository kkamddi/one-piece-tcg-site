import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSeriesGuideEntries, seriesGuideSourcePaths } from './seriesGuideSeo.js';
import { getBoxRecommendationEntries, boxRecommendationSourcePaths } from './boxRecommendationSeo.js';
import { getMarketReportEntries } from './marketReportSeo.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(rootDir, 'public', 'sitemap.xml');
const siteOrigin = 'https://www.optcgkorea.com';

const sourcePaths = [
  path.join(rootDir, 'src', 'RenewApp.jsx'),
  path.join(rootDir, 'src', 'data', 'collection-guide.js'),
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
  '/news/guide',
  '/news/faq',
  '/guide/card-storage',
  '/guide/shops',
  '/guide/card-price',
  '/guide/card-catalog',
  '/guide/booster-comparison',
  '/guide/character-cards',
  '/guide/psa-grading',
  '/guide/release-schedule',
  '/guide/preview/eb-05',
  '/guide/preview/op-18',
  '/guide/collection',
  '/guide/collection/start',
  '/guide/collection/manga',
  '/guide/collection/championship',
  '/guide/collection/flagship',
  '/guide/collection/promo',
  '/guide/box-recommendation',
  '/guide/box-recommendation/high-price',
  '/guide/box-recommendation/stable',
  '/guide/box-recommendation/more-hits',
  '/shops',
  '/shops/official',
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
const marketReportPaths = getMarketReportEntries().map((entry) => entry.pathname);
// The box recommendation entries repeat the hub paths listed above, so keep each URL once.
const entries = [...new Set([...paths, ...seriesGuidePaths, ...boxRecommendationPaths, ...marketReportPaths])].map((urlPath) => {
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
