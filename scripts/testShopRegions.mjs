import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

// Execute the real pure filter and handlers without loading database adapters.
const shops = JSON.parse(await readFile(new URL('../src/data/shops.json', import.meta.url), 'utf8'));
const store = await readFile(new URL('../lib/cards-store.js', import.meta.url), 'utf8');
const filterNode = parse(store, { sourceType: 'module' }).program.body
  .find(node => node.declaration?.id?.name === 'filterShops').declaration;
const context = vm.createContext({ shops });
vm.runInContext(store.slice(filterNode.start, filterNode.end), context);

async function invoke(file, query) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const code = (await transform(source.replace(/^import .*;\r?\n/gm, ''), { format: 'cjs' })).code;
  const sandbox = vm.createContext({ module: { exports: {} }, readShops: async () => shops, filterShops: context.filterShops });
  vm.runInContext(code, sandbox);
  let status, data;
  await sandbox.module.exports.default({ query }, {
    setHeader() {}, status(value) { status = value; return this; }, json(value) { data = value; }
  });
  assert.equal(status, 200);
  return data;
}

test('Yatap shop region agrees with its bundled address', () => {
  const shop = shops.find(row => row.id === 'official-3650');
  assert.ok(shop.address.startsWith('경기도 성남시 분당구'));
  assert.equal(shop.sido, '경기도');
  assert.equal(shop.gungu, '분당구');
});

test('shop API includes Yatap in Gyeonggi and excludes it from Seoul', async () => {
  for (const [sido, count] of [['경기도', 1], ['서울특별시', 0]]) {
    const rows = await invoke('../api/shops/index.js', { sido, gungu: '분당구', q: '야탑', type: 'official' });
    assert.equal(rows.length, count);
    if (count) assert.equal(rows[0].id, 'official-3650');
  }
});

test('region API lists Bundang under Gyeonggi, not Seoul', async () => {
  const gyeonggi = await invoke('../api/shops/regions.js', { sido: '경기도' });
  const seoul = await invoke('../api/shops/regions.js', { sido: '서울특별시' });
  assert.ok(gyeonggi.gungus.includes('분당구'));
  assert.ok(!seoul.gungus.includes('분당구'));
});
