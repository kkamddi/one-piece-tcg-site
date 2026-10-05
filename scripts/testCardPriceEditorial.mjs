import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CARD_PRICE_EDITORIAL } from '../lib/card-price-editorial.js';

test('the price guide page and its pre-rendered HTML share one article', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  assert.match(app, /title: CARD_PRICE_EDITORIAL\.heading/);
  assert.match(middleware, /sections: \[\.\.\.CARD_PRICE_EDITORIAL\.sections, \{ heading: '시세 확인 체크리스트', items: CARD_PRICE_EDITORIAL\.checklist \}\]/);
});

test('won amounts in the article follow the site rate of 9.4 won per yen', () => {
  const text = JSON.stringify(CARD_PRICE_EDITORIAL);
  const pairs = [...text.matchAll(/¥([\d,]+)\(약 ₩([\d,]+)\)/g)];
  assert.ok(pairs.length >= 2);
  for (const [, yen, won] of pairs) {
    assert.equal(Math.round(Number(yen.replaceAll(',', '')) * 9.4), Number(won.replaceAll(',', '')));
  }
  assert.match(text, /1엔=9\.4원/);
});

test('every section has readable content and the article is substantial', () => {
  for (const section of CARD_PRICE_EDITORIAL.sections) {
    assert.ok((section.paragraphs || []).length + (section.items || []).length > 0, section.heading);
  }
  const length = JSON.stringify([CARD_PRICE_EDITORIAL.paragraphs, CARD_PRICE_EDITORIAL.sections, CARD_PRICE_EDITORIAL.checklist]).length;
  assert.ok(length > 2500);
});
