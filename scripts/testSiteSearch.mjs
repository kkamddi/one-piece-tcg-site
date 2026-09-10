import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import { createSiteSearchLoader, normalizeSiteSearch, parseSiteQuery, rankSiteCards, searchSiteContent } from '../src/lib/site-search.js';
import { applySeo, getPageSeo } from '../functions/_middleware.js';
const series = JSON.parse(fs.readFileSync(new URL('../src/data/series.json', import.meta.url)));

test('series and card identifiers normalize spaces, case, dashes and full-width characters', () => {
  for (const q of ['Op 17', 'op-17', 'ＯＰ１７']) assert.equal(parseSiteQuery(q).cardQuery, 'OP17');
  for (const q of ['OP01-120', 'op 01 120', 'OP-01-120']) assert.equal(parseSiteQuery(q).cardQuery, 'OP01-120');
  assert.equal(parseSiteQuery('P-159').exactCode, true);
  assert.equal(parseSiteQuery('루피 시세').cardQuery, '루피');
  assert.equal(parseSiteQuery('루피시세').cardQuery, '루피');
  assert.equal(normalizeSiteSearch('op-17'), normalizeSiteSearch('Op 17'));
});

test('popular broad queries return real catalog series and curated destinations', () => {
  const op17 = searchSiteContent('Op 17', series).filter(item => item.type === 'series');
  assert.ok(op17.some(item => item.id === 'JP-OP17'));
  assert.equal(searchSiteContent('만화카드', series)[0].href, '/guide/collection/manga');
  assert.equal(searchSiteContent('원피스카드 수집 추천', series)[0].href, '/guide/collection/start');
  assert.ok(searchSiteContent('히로인즈', series).some(item => item.id === 'JP-EB03'));
  assert.ok(!searchSiteContent('히로인즈', series).some(item => item.locale === 'EN'));
  assert.equal(searchSiteContent('센터링', series)[0].href, '/lab/centering');
  assert.deepEqual(searchSiteContent('zzzznotfound', series), []);
  assert.deepEqual(searchSiteContent('', series), []);
});

test('existing guide and Q&A content can be searched without duplicate links', () => {
  const documents = [{ href: '/guide/card-storage', title: '보관', keywords: ['습도'] }, { href: '/faq', title: 'Q&A', keywords: ['가입 방법'] }];
  assert.equal(searchSiteContent('습도', series, documents)[0].href, '/guide/card-storage');
  assert.equal(searchSiteContent('가입 방법', series, documents)[0].href, '/faq');
  assert.equal(searchSiteContent('보관', series, documents).filter(item => item.href === '/guide/card-storage').length, 1);
});

test('series queries prioritize the existing guide and retain a separate catalog link', () => {
  for (const query of ['op-17', 'op17', 'Op 17', 'ＯＰ１７']) {
    const result = searchSiteContent(query, series)[0];
    assert.equal(result.href, '/guides/series/jpop17');
    assert.equal(result.catalogHref, '/cards/series/jpop17');
    assert.match(result.title, /시리즈 가이드/);
  }
  for (const query of ['OP01', 'EB03', 'ST01']) {
    const results = searchSiteContent(query, series).filter(item => item.type === 'series');
    assert.ok(results.length > 0);
    for (const item of results) {
      assert.equal(item.href, `/guides/series/${normalizeSiteSearch(item.id)}`);
      assert.equal(item.catalogHref, `/cards/series/${normalizeSiteSearch(item.id)}`);
    }
  }
  assert.ok(searchSiteContent('OP17 가이드', series).some(item => item.href === '/guides/series/jpop17'));
});

test('exact card number is ranked first while same-number variants remain separate', () => {
  const cards = [{ id: 'other', cardNo: 'OP01-001', name: 'OP01-120 guide' }, { id: 'original', cardNo: 'OP01-120' }, { id: 'parallel', cardNo: 'OP01-120_p1', baseCardNo: 'OP01-120' }];
  const result = rankSiteCards([...cards, cards[1]], 'op01120');
  assert.equal(result.length, 3);
  assert.deepEqual(result.slice(0, 2).map(item => item.id), ['original', 'parallel']);
});

test('search requests are deduplicated, cached and skip shop lookups for exact card numbers', async () => {
  let cards = 0, shops = 0, clock = 0;
  const load = createSiteSearchLoader({ now: () => clock, searchCards: async (_, locale) => { cards++; return [{ id: locale, cardNo: 'OP01-120' }]; }, fetchShops: async () => { shops++; return []; } });
  const [a, b] = await Promise.all([load('OP01-120'), load('op 01 120')]);
  assert.deepEqual(a, b); assert.equal(cards, 2); assert.equal(shops, 0);
  await load('OP01-120'); assert.equal(cards, 2);
  clock = 300001; await load('OP01-120'); assert.equal(cards, 4);
  await load('부산'); assert.equal(shops, 1);
  await load(''); await load('a'); assert.equal(cards, 6);
});

test('partial API failures preserve successful categories and remain retryable', async () => {
  let calls = 0;
  const load = createSiteSearchLoader({ searchCards: async (_, locale) => { calls++; if (locale === 'JP') throw Error('offline'); return [{ id: 'KR', cardNo: 'OP01-120' }]; }, fetchShops: async () => [{ id: 'shop' }] });
  const result = await load('루피');
  assert.equal(result.cards.length, 1); assert.equal(result.shops.length, 1); assert.deepEqual(result.errors, ['cards']);
  await load('루피'); assert.equal(calls, 4);
});

test('region queries with shop suffixes use the region in the shop API', async () => {
  let query;
  const load = createSiteSearchLoader({ searchCards: async () => [], fetchShops: async filters => { query = filters.q; return []; } });
  await load('부산 카드샵');
  assert.equal(query, '부산');
});

test('search route is noindex and UI sources parse without changing the scan lock', () => {
  const html = applySeo(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), '/search', getPageSeo('/search'));
  assert.match(html, /content="noindex,follow"/);
  for (const name of ['SiteSearch.jsx', 'RenewApp.jsx']) parse(fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  assert.match(fs.readFileSync(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8'), /const CARD_SCAN_AVAILABLE = false/);
});
