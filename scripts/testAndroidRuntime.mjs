import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

// Exercise the shipped runtime with native bridges replaced by local test doubles.
const { outputFiles } = await build({
  entryPoints: ['src/lib/native-runtime.js'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'native-test-bridges',
    setup(builder) {
      builder.onResolve({ filter: /^(@capacitor\/(core|app|push-notifications)|\.\/native-auth)$/ }, ({ path }) => ({ path, namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const { Capacitor, App, PushNotifications, configureNativeAuth } = globalThis.mocks;',
        loader: 'js'
      }));
    }
  }]
});

function createRuntime(native) {
  const calls = { fetch: [], channels: [], classes: [], events: [], back: 0, minimized: 0, auth: 0 };
  const appListeners = new Map();
  const pushListeners = new Map();
  const modals = [];
  const window = {
    location: { origin: 'https://localhost' },
    history: {
      back() { calls.back += 1; },
      pushState(_state, _title, path) { calls.path = path; }
    },
    async fetch(input, init) { calls.fetch.push({ input, init }); return { ok: true }; },
    getComputedStyle: (element) => element.style,
    dispatchEvent(event) { calls.events.push(event.type); }
  };
  const context = {
    module: { exports: {} }, URL, Request, window,
    PopStateEvent: class { constructor(type) { this.type = type; } },
    document: {
      documentElement: { classList: { add(value) { calls.classes.push(value); } } },
      querySelectorAll: () => modals
    },
    mocks: {
      Capacitor: { isNativePlatform: () => native },
      App: {
        addListener(name, handler) { appListeners.set(name, handler); },
        minimizeApp() { calls.minimized += 1; }
      },
      PushNotifications: {
        async createChannel(channel) { calls.channels.push(channel); },
        addListener(name, handler) { pushListeners.set(name, handler); }
      },
      async configureNativeAuth() { calls.auth += 1; }
    }
  };
  vm.runInNewContext(outputFiles[0].text, context, { filename: 'native-runtime.test.cjs' });
  return { ...context.module.exports, calls, window, modals, appListeners, pushListeners };
}

test('web runtime leaves fetch, API paths and native bridges untouched', () => {
  const runtime = createRuntime(false);
  const originalFetch = runtime.window.fetch;
  runtime.configureNativeRuntime();
  assert.equal(runtime.resolveApiUrl('/api/cards'), '/api/cards');
  assert.equal(runtime.window.fetch, originalFetch);
  assert.equal(runtime.calls.auth, 0);
  assert.equal(runtime.appListeners.size, 0);
});

test('native runtime rewrites only app API paths', () => {
  const runtime = createRuntime(true);
  assert.equal(runtime.resolveApiUrl('/api/cards?q=OP17'), 'https://www.optcgkorea.com/api/cards?q=OP17');
  for (const value of ['/cards', '/assets/icon.png', 'https://example.com/api/cards', null]) {
    assert.equal(runtime.resolveApiUrl(value), value);
  }
});

test('native fetch handles string, URL and Request inputs without losing request data', async () => {
  const runtime = createRuntime(true);
  runtime.configureNativeRuntime();
  await runtime.window.fetch('/api/cards', { cache: 'no-store' });
  await runtime.window.fetch(new URL('https://localhost/api/cards?q=OP17'));
  await runtime.window.fetch(new Request('https://localhost/api/test', {
    method: 'POST', headers: { 'X-Test': 'runtime-only' }, body: 'test-body'
  }));
  assert.equal(runtime.calls.fetch[0].input, 'https://www.optcgkorea.com/api/cards');
  assert.equal(runtime.calls.fetch[0].init.cache, 'no-store');
  assert.equal(runtime.calls.fetch[1].input, 'https://www.optcgkorea.com/api/cards?q=OP17');
  const forwarded = runtime.calls.fetch[2].input;
  assert.equal(forwarded.url, 'https://www.optcgkorea.com/api/test');
  assert.equal(forwarded.method, 'POST');
  assert.equal(forwarded.headers.get('X-Test'), 'runtime-only');
  assert.equal(await forwarded.text(), 'test-body');
});

test('initialization is idempotent and creates the price-alert channel', () => {
  const runtime = createRuntime(true);
  runtime.configureNativeRuntime();
  runtime.configureNativeRuntime();
  assert.equal(runtime.calls.auth, 1);
  assert.deepEqual(runtime.calls.classes, ['is-native-app']);
  assert.equal(runtime.calls.channels.length, 1);
  assert.equal(runtime.calls.channels[0].id, 'price_alerts');
});

test('Android Back closes the top visible modal before navigating or minimizing', () => {
  const runtime = createRuntime(true);
  runtime.configureNativeRuntime();
  let closed = 0;
  runtime.modals.push({ style: { display: 'block', visibility: 'visible' }, getClientRects: () => [{}], click() { closed += 1; } });
  runtime.appListeners.get('backButton')({ canGoBack: true });
  assert.equal(closed, 1);
  assert.equal(runtime.calls.back, 0);
  runtime.modals.length = 0;
  runtime.appListeners.get('backButton')({ canGoBack: true });
  runtime.appListeners.get('backButton')({ canGoBack: false });
  assert.equal(runtime.calls.back, 1);
  assert.equal(runtime.calls.minimized, 1);
});

test('notification taps open an app route and notify the router', () => {
  const runtime = createRuntime(true);
  runtime.configureNativeRuntime();
  const onTap = runtime.pushListeners.get('pushNotificationActionPerformed');
  onTap({ notification: { data: { url: '/prices?code=OP01-120' } } });
  assert.equal(runtime.calls.path, '/prices?code=OP01-120');
  assert.deepEqual(runtime.calls.events, ['popstate']);
  onTap({ notification: { data: { url: 'https://example.com/' } } });
  assert.equal(runtime.calls.path, '/prices');
});
