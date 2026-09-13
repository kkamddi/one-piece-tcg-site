import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMarketVariantLabel } from '../src/market-variant-label.js';

test('labels only explicitly named variants', () => {
  assert.equal(getMarketVariantLabel({ name: 'Monkey D Luffy SEC [OP05-119]' }), '');
  assert.equal(getMarketVariantLabel({ name: 'Monkey D Luffy SEC-P [OP05-119]' }), '패러렐');
  assert.equal(getMarketVariantLabel({ name: 'SEC-SP (Comic Parallel)' }), '망가');
  assert.equal(getMarketVariantLabel({ name: 'SEC-SPC : Anniversary Special Card (Gold Background)' }), '금색 배경 · 기념판');
  assert.equal(getMarketVariantLabel({ name: 'SEC-SPC : Anniversary Special Card (Silver Background)' }), '은색 배경 · 기념판');
});
test('preserves prize and locale distinctions', () => {
  assert.equal(getMarketVariantLabel({ name: 'Champion Ship 2023 World Final 2nd Prize' }), '대회 2위');
  assert.equal(getMarketVariantLabel({ name: 'Promotional Card' }, 'EN'), 'Promo');
  assert.equal(getMarketVariantLabel({ name: 'Wanted SEC-SPC' }, 'JP'), '手配書');
});
