import test from 'node:test';
import assert from 'node:assert/strict';
import { resultLinks } from '../extensions/card-pone/result-links.js';
import { recognitionContact } from '../extensions/card-pone/contact.js';

test('KR products never expose market prices', () => {
  assert.equal(resultLinks({ key: 'KR-1', apparelId: 1, code: 'P-110', locale: 'KR' }).price, null);
});
test('contact drafts contain only version and candidate identity', () => {
  const url = new URL(recognitionContact('0.1.3', [{ code: 'P-110', locale: 'JP', image: 'private-image', url: 'private-url' }]));
  assert.equal(url.pathname, 'optkr26@gmail.com');
  assert.match(url.searchParams.get('body'), /P-110 \(JP\)/);
  assert.ok(!url.searchParams.get('body').includes('private'));
  assert.match(new URL(recognitionContact('0.1.3')).searchParams.get('body'), /없음/);
});

const candidate = { key: 'JP-686000', code: 'P-110', locale: 'JP', apparelId: 686000, catalogCards: [] };
test('artwork-verified DON products link by product ID without inventing a catalog entry', () => {
  const don = { ...candidate, code: 'OPCD-EN-036', artwork: true };
  assert.deepEqual(resultLinks(don), { price: '/prices/product/686000', catalog: null, catalogLabel: null });
  assert.equal(resultLinks({ ...don, artwork: false }), null);
});
test('unmapped P-110 opens its exact market product and a catalog search', () => {
  const links = resultLinks(candidate);
  assert.equal(links.price, '/prices/product/686000?code=P-110');
  assert.equal(links.catalog, '/search?q=P-110');
  assert.equal(links.catalogLabel, '도감 검색');
});
test('approved catalog printing uses its real detail route and preserves its ID', () => {
  const card = { id: 'JP::OP01-120_p2', locale: 'JP', cardNo: 'OP01-120' };
  const links = resultLinks({ ...candidate, key: 'JP-93520', apparelId: 93520, code: 'OP01-120', catalogCards: [card] });
  assert.equal(links.catalog, '/cards/jp/OP01-120-p2');
  assert.equal(links.catalogLabel, '도감 보기');
  assert.equal(new URL(links.price, 'https://www.optcgkorea.com').searchParams.get('cardId'), card.id);
});
test('ambiguous or inconsistent catalog mappings do not select an arbitrary printing', () => {
  const card = { id: 'JP::P-110', locale: 'JP', cardNo: 'P-110' };
  for (const catalogCards of [[card, card], [{ ...card, locale: 'KR' }], [{ ...card, cardNo: 'P-001' }]]) {
    const links = resultLinks({ ...candidate, catalogCards });
    assert.equal(links.catalog, '/search?q=P-110');
    assert.ok(!links.price.includes('cardId='));
  }
});
test('English market products do not invent an unsupported English catalog route', () => {
  const links = resultLinks({ ...candidate, key: 'EN-686000', locale: 'EN', catalogCards: [{ id: 'EN::P-110', locale: 'EN', cardNo: 'P-110' }] });
  assert.equal(links.catalog, '/search?q=P-110');
  assert.ok(links.price.startsWith('/prices/product/686000?'));
});
test('invalid product identifiers and card numbers cannot form outbound links', () => {
  for (const invalid of [null, { ...candidate, apparelId: 0 }, { ...candidate, apparelId: 'https://other.test' }, { ...candidate, key: 'JP-1' }, { ...candidate, code: 'not-a-card' }]) assert.equal(resultLinks(invalid), null);
});
