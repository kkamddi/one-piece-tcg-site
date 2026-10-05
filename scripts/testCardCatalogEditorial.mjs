import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CARD_CATALOG_EDITORIAL } from '../lib/card-catalog-editorial.js';

test('the catalog guide page and its pre-rendered HTML share one article', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  assert.match(app, /const CARD_CATALOG_GUIDE = toEditorialGuide\(CARD_CATALOG_EDITORIAL\);/);
  assert.match(middleware, /\.\.\.CARD_CATALOG_EDITORIAL\.sections, \{ heading: '도감 사용 체크리스트', items: CARD_CATALOG_EDITORIAL\.checklist \}\]/);
});

test('catalog counts in the article still match the bundled catalog', async () => {
  const cards = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8')).filter((card) => card.locale === 'JP');
  const base = new Set(cards.map((card) => String(card.cardNo).replace(/_p\d+$/i, '')));
  const withParallel = new Set(cards.filter((card) => /_p\d+$/i.test(card.id)).map((card) => String(card.cardNo).replace(/_p\d+$/i, '')));
  // The article states its data date; refresh the figures when the catalog grows.
  assert.ok(base.size >= 2773, 'catalog shrank below the article figure');
  assert.ok(withParallel.size >= 960);
  assert.ok(JSON.stringify(CARD_CATALOG_EDITORIAL).includes('960 / 2,773'));
});

test('version table rows are complete and example images use the card CDN', () => {
  const versions = CARD_CATALOG_EDITORIAL.sections.find((section) => section.table).table;
  for (const row of versions.rows) assert.equal(row.length, versions.columns.length);
  for (const section of CARD_CATALOG_EDITORIAL.sections) {
    for (const image of section.images || []) assert.match(image.src, /^https:\/\/cards\.optcgkorea\.com\/cards\/JP\//);
  }
});
