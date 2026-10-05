import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CARD_PRICE_EDITORIAL } from '../lib/card-price-editorial.js';

test('the price guide page and its pre-rendered HTML share one article', async () => {
  const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  assert.match(app, /const CARD_PRICE_GUIDE = toEditorialGuide\(CARD_PRICE_EDITORIAL\);/);
  assert.match(middleware, /\.\.\.CARD_PRICE_EDITORIAL\.sections, \{ heading: '시세 확인 체크리스트', items: CARD_PRICE_EDITORIAL\.checklist \}\]/);
});

test('won amounts in the article follow the site rate of 9.4 won per yen', () => {
  const text = JSON.stringify(CARD_PRICE_EDITORIAL);
  // Example card: Single ¥6,016 and PSA10 ¥13,690.
  assert.ok(text.includes(`₩${Math.round(6016 * 9.4).toLocaleString('en-US')}`));
  assert.ok(text.includes(`₩${Math.round(13690 * 9.4).toLocaleString('en-US')}`));
  assert.match(text, /1엔=9\.4원/);
});

test('every section has readable content and visuals carry display values', () => {
  for (const section of CARD_PRICE_EDITORIAL.sections) {
    const parts = (section.paragraphs || []).length + (section.items || []).length + (section.bars || []).length + (section.stats || []).length;
    assert.ok(parts > 0, section.heading);
    for (const bar of section.bars || []) assert.ok(bar.value > 0 && bar.display, bar.label);
  }
  assert.equal(CARD_PRICE_EDITORIAL.summary.length, 4);
});
