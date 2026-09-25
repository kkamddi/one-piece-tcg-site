import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

// Extract the real component through its AST without changing its production exports.
const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'RenewHomeMarketIndex');
assert.ok(component);
const { code } = await transform(source.slice(component.start, component.end), { loader: 'jsx' });
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(fetch) {
  const listeners = new Map();
  const writes = [];
  let cleanup;
  const context = {
    fetch, HOME_MARKET_INDEX_OPTIONS: [{ key: 'manga' }, { key: 'luffy' }], MARKET_INDEX_CONDITION: 'raw',
    useState: () => [{}, value => writes.push(value)],
    useEffect: effect => { cleanup = effect(); },
    window: {
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    }
  };
  vm.runInNewContext(`${code}\nRenewHomeMarketIndex({});`, context);
  return { writes, listeners, cleanup: () => cleanup() };
}

test('home indexes retry when connectivity returns after offline startup', async () => {
  let online = false;
  let requests = 0;
  const h = harness(async () => {
    requests += 1;
    if (!online) throw new Error('offline');
    return { ok: true, json: async () => ({ currentValue: 123 }) };
  });
  await flush();
  assert.equal(Object.keys(h.writes.at(-1)).length, 0);
  online = true;
  h.listeners.get('online')();
  await flush();
  assert.equal(requests, 4);
  assert.equal(h.writes.at(-1).manga.currentValue, 123);
  h.cleanup();
  assert.equal(h.listeners.size, 0);
});

test('older failed request cannot erase recovered home indexes', async () => {
  const pending = [];
  const h = harness(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  h.listeners.get('online')();
  for (const request of pending.slice(2)) request.resolve({ ok: true, json: async () => ({ currentValue: 321 }) });
  await flush();
  pending[0].reject(new Error('old-offline-error'));
  pending[1].reject(new Error('old-offline-error'));
  await flush();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].luffy.currentValue, 321);
  h.cleanup();
});

test('unmounted home index does not write late responses', async () => {
  const pending = [];
  const h = harness(() => new Promise(resolve => pending.push(resolve)));
  h.cleanup();
  for (const resolve of pending) resolve({ ok: true, json: async () => ({ currentValue: 456 }) });
  await flush();
  assert.equal(h.writes.length, 0);
  assert.equal(h.listeners.size, 0);
});
