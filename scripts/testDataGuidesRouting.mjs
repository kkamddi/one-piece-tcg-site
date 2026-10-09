import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getReleaseScheduleEntries } from './releaseScheduleSeo.js';
import { getBoxPricesEntries } from './boxPricesSeo.js';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('character, PSA and release guides are routed, listed, searchable and in the sitemap', async () => {
  const [app, middleware, sitemap, search] = await Promise.all([read('../src/RenewApp.jsx'), read('../functions/_middleware.js'), read('./generatePrimarySitemap.js'), read('../src/lib/site-search.js')]);
  for (const [path, flag, component, key] of [
    ['/guide/character-cards', 'isCharacterCardsGuide', 'RenewCharacterCardsGuide', 'character'],
    ['/guide/psa-grading', 'isPsaGradingGuide', 'RenewPsaGradingGuide', 'psa'],
    ['/guide/release-schedule', 'isReleaseScheduleGuide', 'RenewReleaseScheduleGuide', 'release'],
    ['/guide/getting-started', 'isGettingStartedGuide', 'RenewGettingStartedGuide', 'start'],
    ['/guide/price-ranking', 'isPriceRankingGuide', 'RenewPriceRankingGuide', 'ranking'],
    ['/guide/card-types', 'isCardTypesGuide', 'RenewCardTypesGuide', 'types'],
    ['/guide/box-prices', 'isBoxPricesGuide', 'RenewBoxPricesGuide', 'boxPrices']
  ]) {
    assert.match(app, new RegExp(`const ${flag} = initialPath === '${path}';`));
    assert.match(app, new RegExp(`${flag} \\? <${component} /> : null`));
    assert.match(app, new RegExp(`!${flag} &&`));
    assert.match(app, new RegExp(`guideKey="${key}"`));
    assert.match(app, new RegExp(`\\n  ${key}: \\{\\r?\\n    checklistTitle:`));
    assert.match(app, new RegExp(`href: '${path}', title:`));
    assert.ok(app.includes(`if (path === '${path}')`));
    assert.match(sitemap, new RegExp(`'${path}'`));
    assert.match(search, new RegExp(`href: '${path}'`));
  }
  assert.match(middleware, /'\/guide\/character-cards': editorialPageContent\(CHARACTER_CARDS_EDITORIAL/);
  assert.match(middleware, /'\/guide\/psa-grading': editorialPageContent\(PSA_GRADING_EDITORIAL/);
  assert.match(middleware, /'\/guide\/getting-started': editorialPageContent\(GETTING_STARTED_EDITORIAL/);
  assert.match(middleware, /'\/guide\/price-ranking': editorialPageContent\(PRICE_RANKING_EDITORIAL/);
  assert.match(middleware, /'\/guide\/card-types': editorialPageContent\(CARD_TYPES_EDITORIAL/);
  // The release schedule depends on topics.json, which stays out of the Functions bundle.
  assert.doesNotMatch(middleware, /topics\.json/);
  // The box price page depends on the daily price snapshot, which also stays out of the Functions bundle.
  assert.doesNotMatch(middleware, /box-market-prices|box-prices-editorial/);
});

test('the release schedule page is pre-rendered from the topics of the build', () => {
  const [entry] = getReleaseScheduleEntries('2026-10-07');
  assert.equal(entry.pathname, '/guide/release-schedule');
  assert.ok(entry.seo.heading && entry.seo.sections.length > 3);
  assert.equal(entry.seo.sections[0].heading, '핵심 숫자');
  assert.equal(entry.seo.sections.at(-1).heading, '발매 일정 체크리스트');
});

test('the box price page is pre-rendered from the box prices of the build', () => {
  const [entry] = getBoxPricesEntries('2026-10-09');
  assert.equal(entry.pathname, '/guide/box-prices');
  assert.match(entry.seo.title, /박스 가격/);
  assert.equal(entry.seo.sections[0].heading, '핵심 숫자');
  assert.equal(entry.seo.sections.at(-1).heading, '박스 가격 체크리스트');
  assert.ok(entry.seo.sections.some((section) => section.table?.rows.length >= 10));
});

test('regional shop guides are routed, pre-rendered, listed in the sitemap and searchable', async () => {
  const [app, sitemap, search, staticPages, shopGuide] = await Promise.all([read('../src/RenewApp.jsx'), read('./generatePrimarySitemap.js'), read('../src/lib/site-search.js'), read('./generateStaticSeoPages.js'), read('../lib/shop-guide-editorial.js')]);
  const { getRegionShopEntries } = await import('./regionShopsSeo.js');
  const entries = getRegionShopEntries();
  assert.deepEqual(entries.map((entry) => entry.pathname), ['/guide/shops/seoul', '/guide/shops/gyeonggi', '/guide/shops/busan', '/guide/shops/gyeongnam']);
  for (const { pathname, seo } of entries) {
    assert.match(sitemap, new RegExp(`'${pathname}'`));
    assert.match(search, new RegExp(`href: '${pathname}'`));
    assert.ok(shopGuide.includes(`href: '${pathname}'`), pathname);
    assert.equal(seo.faq.length, 2, pathname);
    assert.ok(seo.title && seo.description && seo.sections.length >= 3, pathname);
  }
  assert.match(app, /regionShopSlug \? <RenewRegionShopGuide slug=\{regionShopSlug\} \/> : null/);
  assert.match(app, /!regionShopSlug/);
  assert.match(staticPages, /regionShopSeo\.get\(pathname\)/);
});
