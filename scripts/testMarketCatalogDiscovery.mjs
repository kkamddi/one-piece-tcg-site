import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogCardCode, catalogProductLocale } from '../api/market-collector.js';

test('discovery preserves JP and EN without admitting other languages', () => {
  for (const [name, expected] of [['Luffy [P-110]', 'JP'], ['Luffy [EN] [P-110]', 'EN'], ['Luffy [P-110] [en]', 'EN'], ['Luffy [KR]', null], ['Luffy [EN] [CN]', null]]) {
    assert.equal(catalogProductLocale({ name }), expected);
  }
});
test('language and edition tags cannot replace the card number', () => {
  assert.equal(catalogCardCode({ name: 'Luffy [EN] [Parallel] [OP01-003]' }), 'OP01-003');
  assert.equal(catalogCardCode({ name: 'Luffy [EN]', productNumber: 'OPC-TCG-P-110' }), 'P-110');
});
