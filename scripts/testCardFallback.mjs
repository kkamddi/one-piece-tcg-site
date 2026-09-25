import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

const fixtures = [
  { id: 'a', locale: 'KR', cardNo: 'OP01-004', name: '우솝', color: 'red', category: 'CHARACTER' },
  { id: 'b', locale: 'KR', cardNo: 'OP01-005', name: '우타', color: 'red', category: 'CHARACTER', effect: 'OP01-004' },
  { id: 'c', locale: 'KR', cardNo: 'OP01-004_p1', name: '우솝', color: 'red', category: 'CHARACTER' },
  { id: 'd', locale: 'JP', cardNo: 'OP01-004', name: 'Usopp', color: 'red', category: 'CHARACTER' },
  { id: 'e', locale: 'KR', cardNo: 'OP01-001', name: '리더', color: 'red', category: 'LEADER' }
];
const { outputFiles } = await build({
  entryPoints: ['src/api/cards.js'], bundle: true, write: false, format: 'cjs', platform: 'node',
  plugins: [{ name: 'catalog-fixture', setup(builder) {
    builder.onLoad({ filter: /[\\/]cards\.json$/ }, () => ({ contents: JSON.stringify(fixtures), loader: 'json' }));
    builder.onLoad({ filter: /[\\/]special-promo-cards\.js$/ }, () => ({ contents: 'export default []' }));
  } }]
});
function api(fetch) {
  const context = vm.createContext({ module: { exports: {} }, fetch, URLSearchParams, console: { warn() {} } });
  vm.runInContext(outputFiles[0].text, context);
  return context.module.exports;
}
const ids = rows => Array.from(rows, row => row.id);

test('offline card-code query filters before pagination and ignores effect-text matches', async () => {
  const client = api(async () => { throw new Error('offline'); });
  const filters = { q: ' op01-004 ', locale: 'KR', color: 'red', excludeCategory: 'LEADER', limit: 1 };
  assert.deepEqual(ids(await client.fetchCards({ ...filters, page: 1 })), ['a']);
  assert.deepEqual(ids(await client.fetchCards({ ...filters, page: 2 })), ['c']);
  assert.deepEqual(ids(await client.fetchCards({ ...filters, page: 3 })), []);
});

test('malformed API JSON falls back to name search and preserves empty results', async () => {
  const client = api(async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML'); } }));
  assert.deepEqual(ids(await client.fetchCards({ q: ' 우솝 ', locale: 'KR' })), ['a', 'c']);
  assert.deepEqual(ids(await client.fetchCards({ q: 'not-found', locale: 'KR' })), []);
  assert.deepEqual(ids(await client.fetchCards({ q: ' ', locale: 'KR', excludeCategory: 'LEADER' })), ['a', 'b', 'c']);
});

test('successful API response is not replaced by offline catalog', async () => {
  const client = api(async () => ({ ok: true, json: async () => [{ id: 'server' }] }));
  assert.deepEqual(ids(await client.fetchCards({ q: 'OP01-004' })), ['server']);
});
