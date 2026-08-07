import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(rootDir, 'public', 'sitemap-jp.xml');
const siteOrigin = 'https://www.optcgkorea.com';

const sourcePaths = {
  app: path.join(rootDir, 'src', 'RenewApp.jsx'),
  middleware: path.join(rootDir, 'functions', '_middleware.js')
};

function getLastModified(paths) {
  const timestamp = Math.max(...paths.map((sourcePath) => fs.statSync(sourcePath).mtimeMs));
  return new Date(timestamp).toISOString().slice(0, 10);
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

const basePaths = [
  '/jp',
  '/jp/cards',
  '/jp/prices',
  '/jp/lab',
  '/jp/lab/centering',
  '/jp/lab/pack-simulator',
  '/jp/guides/centering',
  '/jp/guides/pack-simulator',
  '/jp/tools/profit-calculator',
  '/jp/guides/profit-calculator',
  '/jp/tools/portfolio-calculator',
  '/jp/guides/portfolio-calculator',
  '/jp/calendar',
  '/jp/news',
  '/jp/shops'
];
const entries = basePaths.map((urlPath) => renderUrl(urlPath, {
  lastmod: pageLastmod,
  changefreq: 'weekly',
  priority: urlPath === '/jp' ? '0.9' : '0.82'
}));

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...entries,
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync(outputPath, xml, 'utf8');
console.log(`[seo] Japanese sitemap: ${entries.length} high-value URLs`);
