import test from 'node:test';
import assert from 'node:assert/strict';
import { marketDateKeyFromTimestamp, marketTradeDateKey } from '../lib/market-trade-date.js';

test('keeps an explicit calendar date unchanged', () => {
  assert.equal(marketTradeDateKey('2026-07-17'), '2026-07-17');
  assert.equal(marketTradeDateKey('Jul 17th, 2026'), '2026-07-17');
});

test('groups an ISO trading timestamp by the KST and JST calendar date', () => {
  assert.equal(marketTradeDateKey('2026-07-16T11:55:00Z'), '2026-07-16');
  assert.equal(marketTradeDateKey('2026-07-16T22:38:53Z'), '2026-07-17');
});

test('uses the same KST and JST boundary for numeric timestamps', () => {
  assert.equal(marketDateKeyFromTimestamp(Date.parse('2026-07-16T22:38:53Z')), '2026-07-17');
  assert.equal(marketTradeDateKey('not-a-date'), '');
});
