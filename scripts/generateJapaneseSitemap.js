import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import boxMarketItems from '../src/data/box-market-items.js';
import cardMarketLinks from '../src/data/card-market-links.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(rootDir, 'public', 'sitemap-jp.xml');
const siteOrigin = 'https://www.optcgkorea.com';

const sourcePaths = {
  app: path.join(rootDir, 'src', 'RenewApp.jsx'),
  middleware: path.join(rootDir, 'functions', '_middleware.js'),
  series: path.join(rootDir, 'src', 'data', 'series.json'),
  cards: path.join(rootDir, 'src', 'data', 'card-market-links.js'),
  boxes: path.join(rootDir, 'src', 'data', 'box-market-items.js')
};

const seriesData = JSON.parse(fs.readFileSync(sourcePaths.series, 'utf8'));

function getLastModified(paths) {
  const timestamp = Math.max(...paths.map((sourcePath) => fs.statSync(sourcePath).mtimeMs));
  return new Date(timestamp).toISOString().slice(0, 10);
}

function normalizeSeriesSlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function getDefaultPath(japanesePath) {
  const pathWithoutPrefix = japanesePath.replace(/^\/jp(?=\/|$)/, '');
  return pathWithoutPrefix || '/';
}

function renderUrl(japanesePath, { lastmod, changefreq, priority }) {
  const defaultPath = getDefaultPath(japanesePath);
  const japaneseUrl = `${siteOrigin}${japanesePath}`;
  const defaultUrl = `${siteOrigin}${defaultPath}`;
  return [
    '  <url>',
    `    <loc>${escapeXml(japaneseUrl)}</loc>`,
    `    <xhtml:link rel="alternate" hreflang="ja" href="${escapeXml(japaneseUrl)}" />`,
    `    <xhtml:link rel="alternate" hreflang="ko" href="${escapeXml(defaultUrl)}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(defaultUrl)}" />`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>'
  ].join('\n');
}

const pageLastmod = getLastModified([sourcePaths.app, sourcePaths.middleware]);
const seriesLastmod = getLastModified([sourcePaths.series]);
const cardLastmod = getLastModified([sourcePaths.cards]);
const boxLastmod = getLastModified([sourcePaths.boxes]);

const basePaths = [
  '/jp',
  '/jp/cards',
  '/jp/prices',
  '/jp/community',
  '/jp/lab',
  '/jp/lab/centering',
  '/jp/lab/pack-simulator',
  '/jp/guides/centering',
  '/jp/guides/pack-simulator',
  '/jp/tools/profit-calculator',
  '/jp/guides/profit-calculator',
  '/jp/calendar',
  '/jp/news',
  '/jp/shops'
];
const seriesPaths = [...new Set(
  seriesData
    .filter((series) => series.locale === 'JP')
    .map((series) => normalizeSeriesSlug(series.baseSeriesId || series.officialSeriesKeyword || series.id))
    .filter(Boolean)
    .map((slug) => `/jp/cards/${slug}`)
)].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
const cardPaths = [...new Set(
  cardMarketLinks
    .filter((item) => item.locale === 'JP' && item.status === 'approved' && /^[A-Z0-9-]+$/.test(item.cardNo || ''))
    .map((item) => `/jp/prices/card/${item.cardNo.toUpperCase()}`)
)].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
const boxPaths = [...new Set(
  boxMarketItems
    .map((item) => String(item.code || '').toUpperCase())
    .filter((code) => /^[A-Z0-9-]+$/.test(code))
    .map((code) => `/jp/prices/box/${code}`)
)].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

const entries = [
  ...basePaths.map((urlPath) => renderUrl(urlPath, { lastmod: pageLastmod, changefreq: 'daily', priority: urlPath === '/jp' ? '0.9' : '0.82' })),
  ...seriesPaths.map((urlPath) => renderUrl(urlPath, { lastmod: seriesLastmod, changefreq: 'weekly', priority: '0.72' })),
  ...cardPaths.map((urlPath) => renderUrl(urlPath, { lastmod: cardLastmod, changefreq: 'daily', priority: '0.68' })),
  ...boxPaths.map((urlPath) => renderUrl(urlPath, { lastmod: boxLastmod, changefreq: 'daily', priority: '0.66' }))
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...entries,
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync(outputPath, xml, 'utf8');
console.log(`[seo] Japanese sitemap: ${entries.length} URLs (${seriesPaths.length} series, ${cardPaths.length} cards, ${boxPaths.length} boxes)`);
