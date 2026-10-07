import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { applySeo, getPageSeo } from '../functions/_middleware.js';
import { getBoosterPreviewEntries } from './boosterPreviewSeo.js';
import { getReleaseScheduleEntries } from './releaseScheduleSeo.js';
import { GUIDE_FAQ_PATHS } from '../lib/guide-article-faq.js';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const graph = html => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => { const o = JSON.parse(m[1]); return o['@graph'] || [o]; });

test('llms.txt only links to pages the site publishes', async () => {
  const [llms, sitemap] = await Promise.all([read('../public/llms.txt'), read('./generatePrimarySitemap.js')]);
  const paths = [...llms.matchAll(/\]\(https:\/\/www\.optcgkorea\.com([^)]*)\)/g)].map(m => m[1]);
  assert.ok(paths.length >= 15);
  // The weekly report hub is added to the sitemap by scripts/marketReportSeo.js.
  for (const path of paths) assert.ok(sitemap.includes(`'${path}'`) || path === '/market-report', path);
});

test('editorial guides pre-render their FAQ as text and FAQPage next to the Article', async () => {
  const html = await read('../index.html');
  for (const path of Object.values(GUIDE_FAQ_PATHS)) {
    // The release schedule is pre-rendered by its own build script, not the middleware map.
    const seo = path === '/guide/release-schedule' ? getReleaseScheduleEntries('2026-10-07')[0].seo : getPageSeo(path);
    const out = applySeo(html, path, seo);
    const nodes = graph(out);
    const article = nodes.find(node => node['@type'] === 'Article');
    const faq = nodes.find(node => node['@type'] === 'FAQPage');
    assert.ok(article?.datePublished && article.image, path);
    assert.equal(faq?.mainEntity.length, 2, path);
    assert.match(out, /<meta property="og:type" content="article" \/>/, path);
  }
});

test('preview pages share their own package image', async () => {
  const html = await read('../index.html');
  for (const { pathname, seo } of getBoosterPreviewEntries()) {
    const out = applySeo(html, pathname, seo);
    assert.ok(out.includes(`<meta property="og:image" content="${seo.image}" />`), pathname);
    assert.equal(graph(out).find(node => node['@type'] === 'Article').image, seo.image);
  }
});
