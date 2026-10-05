import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CARD_CATALOG_EDITORIAL } from '../lib/card-catalog-editorial.js';

test('the catalog guide page and its pre-rendered HTML share one article', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  assert.match(app, /title: CARD_CATALOG_EDITORIAL\.heading/);
  assert.match(middleware, /sections: \[\.\.\.CARD_CATALOG_EDITORIAL\.sections, \{ heading: '도감 사용 체크리스트', items: CARD_CATALOG_EDITORIAL\.checklist \}\]/);
});

test('catalog counts in the article still match the bundled catalog', async () => {
  const cards = JSON.parse(await readFile(new URL('../src/data/cards.json', import.meta.url), 'utf8')).filter((card) => card.locale === 'JP');
  const base = new Set(cards.map((card) => String(card.cardNo).replace(/_p\d+$/i, '')));
  const withParallel = new Set(cards.filter((card) => /_p\d+$/i.test(card.id)).map((card) => String(card.cardNo).replace(/_p\d+$/i, '')));
  const text = JSON.stringify(CARD_CATALOG_EDITORIAL);
  // The article states its data date; refresh the figures when the catalog grows.
  assert.ok(base.size >= 2773, 'catalog shrank below the article figure');
  assert.match(text, /기본 카드번호 2,773개 중 960개\(35%\)/);
  assert.ok(withParallel.size >= 960);
});

test('every section has readable content', () => {
  for (const section of CARD_CATALOG_EDITORIAL.sections) {
    assert.ok((section.paragraphs || []).length + (section.items || []).length > 0, section.heading);
  }
});
