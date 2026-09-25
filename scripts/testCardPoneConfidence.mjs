import test from 'node:test';
import assert from 'node:assert/strict';
import { canShowCandidatePrice } from '../extensions/card-pone/result-confidence.js';

const jp = { key: 'JP-1', artwork: true };
const en = { key: 'EN-2', artwork: true };
const parallel = { key: 'JP-3', artwork: true };
const numberOnly = { key: 'JP-4', artwork: false };

test('one visually matched printing can show prices without an extra click', () => {
  const result = { candidates: [jp, numberOnly], warnings: [] };
  assert.equal(canShowCandidatePrice(result, jp), true);
  assert.equal(canShowCandidatePrice(result, numberOnly), false);
});

test('language and parallel ambiguity require exact candidate confirmation', () => {
  for (const other of [en, parallel]) {
    const result = { candidates: [jp, other], warnings: [] };
    assert.equal(canShowCandidatePrice(result, jp), false);
    assert.equal(canShowCandidatePrice(result, other), false);
    assert.equal(canShowCandidatePrice(result, other, other.key), true);
    assert.equal(canShowCandidatePrice(result, jp, other.key), false);
  }
});

test('partial recognition and OCR alone never automatically expose a price', () => {
  assert.equal(canShowCandidatePrice({ candidates: [jp], warnings: ['partial'] }, jp), false);
  const result = { candidates: [numberOnly], warnings: [] };
  assert.equal(canShowCandidatePrice(result, numberOnly), false);
  assert.equal(canShowCandidatePrice(result, numberOnly, numberOnly.key), true);
  assert.equal(canShowCandidatePrice({ candidates: [] }, numberOnly, numberOnly.key), false);
});
