import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';
import { buildRecognitionCandidates, normalizedCrop, recognitionPriceUrl } from '../src/lib/card-recognition-lab.js';

const market = [
  { code: 'OP01-120', locale: 'JP', apparelId: 1, name: 'Base', minPrice: 999 },
  { code: 'OP01-120', locale: 'JP', apparelId: 2, name: 'Manga' },
  { code: 'OP01-120', locale: 'EN', apparelId: 3, name: 'English' },
  { code: 'OP02-013', locale: 'JP', apparelId: 4, name: 'Ace' }
];
const cards = [{ id: 'JP::OP01-120', locale: 'JP', cardNo: 'OP01-120' }, { id: 'JP::OP01-120_p2', locale: 'JP', cardNo: 'OP01-120' }];
const links = [{ cardId: cards[0].id, apparelId: 1, locale: 'JP', cardNo: 'OP01-120', status: 'approved' }, { cardId: cards[1].id, apparelId: 2, locale: 'JP', cardNo: 'OP01-120', status: 'pending' }];
const match = { key: 'JP-2', code: 'OP01-120', score: 22, inliers: 18, verified: true };

test('artwork wins over OCR-only candidates without treating a number as a variant identity', () => {
  const results = buildRecognitionCandidates({ matches: [match], codes: ['OP01-120'], locale: 'JP', market, cards, links });
  assert.equal(results[0].key, 'JP-2');
  assert.equal(results[0].catalogCards.length, 0);
  assert.equal(results[1].key, 'JP-1');
  assert.equal(results[1].artwork, false);
  assert.equal(results[1].catalogCards[0].id, 'JP::OP01-120');
  assert.ok(results.every(item => !('minPrice' in item)));
});

test('wrong OCR does not remove a visually verified different-number candidate', () => {
  const results = buildRecognitionCandidates({ matches: [match], codes: ['OP02-013'], market, cards, links });
  assert.deepEqual(results.map(item => item.key), ['JP-2', 'JP-4']);
  assert.equal(results[0].codeMatch, false);
});

test('blank and unverified images do not invent candidates', () => {
  assert.deepEqual(buildRecognitionCandidates({ matches: [{ ...match, verified: false }], market, cards, links }), []);
});

test('edition isolation, duplicate products and missing card IDs remain safe', () => {
  const results = buildRecognitionCandidates({ codes: ['OP01-120'], locale: 'EN', market: [...market, market[2]], cards, links });
  assert.equal(results.length, 1);
  assert.equal(results[0].key, 'EN-3');
  assert.equal(results[0].catalogCards.length, 0);
  const invalid = buildRecognitionCandidates({ codes: ['OP01-120'], market, cards: [], links });
  assert.ok(invalid.every(item => item.catalogCards.length === 0));
});

test('opening a price requires explicit confirmation and one approved catalog link', () => {
  const [candidate] = buildRecognitionCandidates({ codes: ['OP01-120'], locale: 'JP', market, cards, links });
  assert.equal(recognitionPriceUrl(candidate, false), null);
  assert.equal(new URL(recognitionPriceUrl(candidate, true), 'https://local.test').searchParams.get('cardId'), 'JP::OP01-120');
  assert.equal(recognitionPriceUrl({ ...candidate, catalogCards: [] }, true), null);
  assert.equal(recognitionPriceUrl({ ...candidate, catalogCards: cards }, true), null);
});

test('crop coordinates clamp to image boundaries and accept reverse dragging', () => {
  assert.deepEqual(normalizedCrop({ x: .9, y: .8 }, { x: -.2, y: 1.2 }), { x: 0, y: .8, width: .9, height: 1 - .8 });
});

test('lab stays dev-only and new React screen parses without building the site', async () => {
  const entry = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.ok(entry.includes("import.meta.env.DEV ? React.lazy(() => import('./CardRecognitionLab.jsx')) : null"));
  assert.ok(entry.includes("window.location.pathname === '/dev/card-recognition'"));
  assert.ok(entry.includes("['localhost', '127.0.0.1', '[::1]']"));
  const source = await readFile(new URL('../src/CardRecognitionLab.jsx', import.meta.url), 'utf8');
  transformSync(source, { loader: 'jsx' });
  assert.ok(source.includes("window.addEventListener('paste', paste)"));
  assert.ok(source.includes('ticket !== job.current'));
});
