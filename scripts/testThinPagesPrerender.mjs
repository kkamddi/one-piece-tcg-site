import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getPageSeo } from '../functions/_middleware.js';
import { getBoxRecommendationEntries } from './boxRecommendationSeo.js';

const textOf = (seo) => JSON.stringify([seo.paragraphs, seo.sections]).length;

test('list and FAQ pages pre-render the cards and questions they show', () => {
  for (const path of ['/guide/collection/manga', '/guide/collection/championship', '/guide/collection/flagship', '/guide/collection/promo', '/news/faq', '/news/guide']) {
    const seo = getPageSeo(path);
    assert.ok(seo, path);
  }
});

test('box recommendation hub and category pages have pre-rendered sections', () => {
  const entries = new Map(getBoxRecommendationEntries().map((entry) => [entry.pathname, entry.seo]));
  for (const path of ['/guide/box-recommendation', '/guide/box-recommendation/high-price', '/guide/box-recommendation/stable', '/guide/box-recommendation/more-hits']) {
    const seo = entries.get(path);
    assert.ok(seo?.sections?.length >= 3, path);
    assert.ok(textOf(seo) > 300, path);
  }
  assert.ok(entries.get('/guide/box-recommendation').sections[2].links.length >= 20);
});

test('the card world cup launcher is out of the sitemap and index', async () => {
  const sitemap = await readFile(new URL('./generatePrimarySitemap.js', import.meta.url), 'utf8');
  const headers = (await readFile(new URL('../public/_headers', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.doesNotMatch(sitemap, /'\/lab\/card-world-cup'/);
  assert.match(headers, /^\/lab\/card-world-cup\n {2}X-Robots-Tag: noindex, follow$/m);
  assert.equal(getPageSeo('/lab/card-world-cup').robots, 'noindex,follow');
});

test('unprefixed URLs never restore a saved Japanese UI', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /return savedLocale === 'EN' \? 'EN' : 'KR';/);
});

test('the hidden partner shop page redirects to /shops and leaves the sitemap', async () => {
  const redirects = (await readFile(new URL('../public/_redirects', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const sitemap = await readFile(new URL('./generatePrimarySitemap.js', import.meta.url), 'utf8');
  assert.match(redirects, /^\/shops\/partners \/shops 301$/m);
  assert.doesNotMatch(sitemap, /'\/shops\/partners'/);
});

test('box category pages explain how each ranking is scored', async () => {
  const { BOX_RECOMMENDATION_CATEGORIES, getBoxCategorySections } = await import('../lib/box-recommendation-editorial.js');
  for (const category of BOX_RECOMMENDATION_CATEGORIES) {
    assert.ok(category.method.length >= 3, category.id);
    assert.equal(getBoxCategorySections(category).at(-1).heading, '점수 계산 방법');
  }
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /activeCategory\.method\.map/);
});

test('the storage guide is a shared article with no unverified size specs', async () => {
  const { CARD_STORAGE_EDITORIAL } = await import('../lib/card-storage-editorial.js');
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /const CARD_STORAGE_GUIDE = toEditorialGuide\(CARD_STORAGE_EDITORIAL\);/);
  assert.equal(getPageSeo('/guide/card-storage').reviewedAt, CARD_STORAGE_EDITORIAL.reviewedAt);
  assert.doesNotMatch(JSON.stringify(CARD_STORAGE_EDITORIAL), /\d+\s?(mm|pt|μm)/);
});
