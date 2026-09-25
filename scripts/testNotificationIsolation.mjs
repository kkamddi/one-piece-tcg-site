import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
let callback;
let sessionEffect;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name === 'refreshNotifications') callback = node.init.arguments[0];
  if (node.type === 'CallExpression' && node.callee?.name === 'useLayoutEffect'
    && source.slice(node.start, node.end).includes('notificationSessionRef.current')) sessionEffect = node.arguments[0];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.ok(callback);
assert.ok(sessionEffect);

function harness() {
  const pending = [], writes = [];
  const context = vm.createContext({
    authUser: { id: 'account-a' },
    notificationSessionRef: { current: { userId: 'account-a', request: 0 } },
    fetchMarketplaceNotifications: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    setNotifications: value => writes.push(value)
  });
  vm.runInContext(`this.refresh = ${source.slice(callback.start, callback.end)}`, context);
  return { context, pending, writes };
}

test('logout and account replacement discard pending notification responses', async () => {
  for (const nextUser of [null, 'account-b']) {
    const h = harness();
    const request = h.context.refresh();
    h.context.notificationSessionRef.current = { userId: nextUser, request: 0 };
    h.pending[0].resolve({ notifications: [{ id: 'old-account-notification' }] });
    await request;
    assert.equal(h.writes.length, 0);
    await h.context.refresh(); // An old callback must not fetch for the new session.
    assert.equal(h.pending.length, 1);
  }
});

test('the newest notification request wins over late success or failure', async () => {
  for (const fail of [false, true]) {
    const h = harness();
    const old = h.context.refresh().catch(() => {});
    const latest = h.context.refresh();
    h.pending[1].resolve({ notifications: [{ id: 'latest' }] });
    await latest;
    if (fail) h.pending[0].reject(new Error('offline'));
    else h.pending[0].resolve({ notifications: [{ id: 'older' }] });
    await old;
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0][0].id, 'latest');
  }
});

test('unmount invalidates requests and current failures clear the list', async () => {
  const h = harness();
  const first = h.context.refresh();
  h.context.notificationSessionRef.current = null;
  h.pending[0].resolve({ notifications: [{ id: 'late' }] });
  await first;
  assert.equal(h.writes.length, 0);
  h.context.notificationSessionRef.current = { userId: 'account-a', request: 0 };
  const next = h.context.refresh();
  h.pending[1].reject(new Error('offline'));
  await assert.rejects(next, /offline/);
  assert.equal(h.writes.at(-1).length, 0);
});

test('the actual session effect clears old items and invalidates on switch and unmount', async () => {
  const h = harness();
  vm.runInContext(`this.mountSession = ${source.slice(sessionEffect.start, sessionEffect.end)}`, h.context);
  const cleanupA = h.context.mountSession();
  const old = h.context.refresh();
  cleanupA();
  h.context.authUser = { id: 'account-b' };
  const cleanupB = h.context.mountSession();
  h.pending[0].resolve({ notifications: [{ id: 'private-old' }] });
  await old;
  assert.ok(h.writes.every(items => items.length === 0));
  assert.equal(h.context.notificationSessionRef.current.userId, 'account-b');
  cleanupB();
  assert.equal(h.context.notificationSessionRef.current, null);
});
