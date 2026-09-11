import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

async function compile(entry) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'isolated-native-services', setup(builder) {
      builder.onResolve({ filter: /^(@capacitor\/|\.\.?\/lib\/supabase$|\.\/supabase$)/ }, ({ path }) => ({ path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
        contents: 'export const { App, Browser, Capacitor, PushNotifications, supabase } = globalThis.services;', loader: 'js'
      }));
    } }]
  });
  return result.outputFiles[0].text;
}

const authCode = await compile('src/lib/native-auth.js');
const pushCode = await compile('src/api/push-notifications.js');
const accountCode = await compile('src/api/auth.js');

function harness(code, options = {}) {
  const calls = { events: [], requests: [], oauth: [], sessions: [], exchanges: [], opened: [], removed: [], closed: 0 };
  const listeners = new Map();
  const storage = new Map();
  let timeout;
  const auth = {
    async getSession() { return { data: { session: options.signedOut ? null : { access_token: 'example-session' } } }; },
    async signInWithOAuth(input) { calls.oauth.push(input); return options.oauthResult || { data: { url: 'https://example.test/authorize' } }; },
    async exchangeCodeForSession(code) { calls.exchanges.push(code); return options.sessionResult || { data: { session: { user: { id: 'test-user' } } } }; },
    async setSession(session) { calls.sessions.push(session); return options.sessionResult || { data: { session: { user: { id: 'test-user' } } } }; }
  };
  const context = {
    module: { exports: {} }, URL, URLSearchParams, Uint8Array,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    navigator: {},
    window: {
      location: { hostname: 'www.optcgkorea.com' },
      dispatchEvent(event) { calls.events.push(event); },
      setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() { timeout = undefined; },
      localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
    },
    async fetch(url, init) {
      calls.requests.push({ url, ...init });
      if (options.requestGate) await options.requestGate(init);
      if (options.networkError) throw new Error('test-network-offline');
      return { ok: !options.apiError, status: options.apiError ? 503 : 200,
        async json() { return options.apiError ? { error: 'test-service-unavailable' } : { nativeConfigured: true, subscribed: true }; },
        async text() { return JSON.stringify(options.apiError ? { error: 'invalid_credentials' } : { accessToken: 'example-access', refreshToken: 'example-refresh' }); }
      };
    },
    services: {
      Capacitor: { isNativePlatform: () => options.native !== false }, supabase: { auth },
      App: {
        async addListener(name, fn) { listeners.set(name, fn); },
        async getLaunchUrl() { return options.launch ? { url: options.launch } : undefined; }
      },
      Browser: { async open(input) { calls.opened.push(input); }, async close() { calls.closed += 1; } },
      PushNotifications: {
        async unregister() { calls.events.push('unregister'); },
        async removeAllDeliveredNotifications() { calls.events.push('clear-notifications'); },
        async checkPermissions() { return { receive: options.permission || 'granted' }; },
        async requestPermissions() { return { receive: options.requestedPermission || 'granted' }; },
        async addListener(name, fn) {
          listeners.set(name, fn);
          return { async remove() { calls.removed.push(name); listeners.delete(name); } };
        },
        async register() {
          if (options.registration === 'timeout') timeout();
          else if (options.registration === 'error') listeners.get('registrationError')({ error: 'test-fcm-error' });
          else listeners.get('registration')({ value: 'test-only-fcm-token' });
        }
      }
    }
  };
  vm.runInNewContext(code, context);
  return { api: context.module.exports, calls, listeners, storage, context };
}

test('native social login opens the production handoff, not the WebView', async () => {
  for (const provider of ['google', 'kakao']) {
    const h = harness(authCode);
    await h.api.signInWithSocialProvider(provider);
    assert.equal(h.calls.oauth[0].provider, provider);
    assert.equal(h.calls.oauth[0].options.skipBrowserRedirect, true);
    const opened = new URL(h.calls.opened[0].url);
    assert.equal(opened.origin, 'https://www.optcgkorea.com');
    assert.equal(opened.pathname, '/native-auth-start');
    assert.equal(opened.searchParams.get('oauth'), 'https://example.test/authorize');
  }
});

test('web social login does not open native browser', async () => {
  const h = harness(authCode, { native: false });
  await h.api.signInWithSocialProvider('google');
  assert.equal(h.calls.opened.length, 0);
  assert.equal(h.calls.oauth[0].options.redirectTo, 'https://www.optcgkorea.com/');
});

test('cold-start code callback establishes session and closes browser', async () => {
  const h = harness(authCode, { launch: 'com.optcgkorea.cardpone://auth/callback?code=test-code' });
  await h.api.configureNativeAuth();
  await h.api.configureNativeAuth();
  assert.deepEqual(h.calls.exchanges, ['test-code']);
  assert.equal(h.calls.closed, 1);
  assert.equal(h.calls.events[0].detail.user.id, 'test-user');
});

test('token callback establishes session without exchanging a code', async () => {
  const h = harness(authCode, { launch: 'com.optcgkorea.cardpone://auth/callback#access_token=test-a&refresh_token=test-r' });
  await h.api.configureNativeAuth();
  assert.equal(h.calls.sessions[0].access_token, 'test-a');
  assert.equal(h.calls.sessions[0].refresh_token, 'test-r');
  assert.equal(h.calls.exchanges.length, 0);
});

test('OAuth cancellation and unrelated deep links never establish sessions', async () => {
  const cancelled = harness(authCode, { launch: 'com.optcgkorea.cardpone://auth/callback?error=access_denied' });
  await cancelled.api.configureNativeAuth();
  assert.equal(cancelled.calls.events[0].detail.error, 'access_denied');
  const other = harness(authCode, { launch: 'https://example.test/?code=not-app-auth' });
  await other.api.configureNativeAuth();
  assert.equal(other.calls.exchanges.length, 0);
  assert.equal(other.calls.sessions.length, 0);
});

test('invalid callback and failed provider expose errors', async () => {
  const invalid = harness(authCode, { launch: 'com.optcgkorea.cardpone://auth/callback' });
  await assert.rejects(invalid.api.configureNativeAuth());
  const failed = harness(authCode, { oauthResult: { error: new Error('test-provider-error') } });
  await assert.rejects(failed.api.signInWithSocialProvider('google'), /test-provider-error/);
  assert.equal(failed.calls.opened.length, 0);
});

test('push permission denial never registers or writes a subscription', async () => {
  for (const permission of ['denied', 'prompt', 'prompt-with-rationale']) {
    const h = harness(pushCode, { permission, requestedPermission: 'denied' });
    await assert.rejects(h.api.enablePushNotifications(), /push_denied/);
    assert.equal(h.calls.requests.length, 0);
    assert.equal(h.storage.size, 0);
  }
});

test('push registration saves Android subscription and removes listeners', async () => {
  const h = harness(pushCode, { permission: 'prompt' });
  const result = await h.api.enablePushNotifications();
  assert.equal(result.subscribed, true);
  const request = h.calls.requests[0];
  assert.equal(request.url, '/api/push-subscriptions');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer example-session');
  assert.equal(JSON.parse(request.body).platform, 'android');
  assert.equal(h.calls.removed.length, 2);
});

test('FCM registration errors and timeouts clean listeners and do not save', async () => {
  for (const registration of ['error', 'timeout']) {
    const h = harness(pushCode, { registration });
    await assert.rejects(h.api.enablePushNotifications(), registration === 'error' ? /test-fcm-error/ : /push_registration_timeout/);
    assert.equal(h.calls.removed.length, 2);
    assert.equal(h.calls.requests.length, 0);
  }
});

test('push network/API failure never reports subscription success', async () => {
  for (const options of [{ apiError: true }, { networkError: true }]) {
    const h = harness(pushCode, options);
    await assert.rejects(h.api.enablePushNotifications());
  }
});

test('notification status uses OS permission and native server configuration', async () => {
  const h = harness(pushCode, { permission: 'denied' });
  const status = await h.api.fetchPushNotificationStatus();
  assert.equal(status.permission, 'denied');
  assert.equal(status.configured, true);
  assert.equal(status.subscribed, false);
});

test('silent push sync does nothing without granted permission', async () => {
  const h = harness(pushCode, { permission: 'prompt' });
  assert.equal((await h.api.syncNativePushRegistration()).synced, false);
  assert.equal(h.calls.requests.length, 0);
});

test('account deletion requires session; authenticated request is mocked only', async () => {
  const anonymous = harness(accountCode, { signedOut: true });
  await assert.rejects(anonymous.api.deleteMyAccount());
  assert.equal(anonymous.calls.requests.length, 0);
  const signedIn = harness(accountCode);
  await signedIn.api.deleteMyAccount();
  assert.equal(signedIn.calls.requests[0].method, 'DELETE');
  assert.equal(signedIn.calls.requests[0].headers.Authorization, 'Bearer example-session');
});

test('password login failure does not create a local session', async () => {
  const h = harness(accountCode, { apiError: true });
  await assert.rejects(h.api.signInWithIdentifier('test-user', 'test-not-a-password'));
  assert.equal(h.calls.sessions.length, 0);
});

test('native logout deactivates only this device and clears its token and notifications', async () => {
  const h = harness(pushCode);
  h.storage.set('card-pone-native-push-token', 'test-only-device');
  await h.api.disableDevicePushNotifications();
  assert.equal(h.calls.requests[0].method, 'DELETE');
  assert.equal(JSON.parse(h.calls.requests[0].body).endpoint, 'fcm:test-only-device');
  assert.equal(h.calls.requests[0].headers.Authorization, 'Bearer example-session');
  assert.deepEqual(h.calls.events, ['unregister', 'clear-notifications']);
  assert.equal(h.storage.size, 0);
});

test('failed subscription deactivation keeps token for retry and rejects logout cleanup', async () => {
  const h = harness(pushCode, { apiError: true });
  h.storage.set('card-pone-native-push-token', 'test-only-device');
  await assert.rejects(h.api.disableDevicePushNotifications(), /test-service-unavailable/);
  assert.equal(h.storage.size, 1);
  assert.equal(h.calls.events.length, 0);
});

test('logout waits for an in-flight save before deactivating the same token', async () => {
  let release;
  let saving;
  const started = new Promise(resolve => { saving = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const h = harness(pushCode, { requestGate: async (init) => {
    if (init.method === 'POST') { saving(); await gate; }
  } });
  const sync = h.api.syncNativePushRegistration();
  await started;
  const logout = h.api.disableDevicePushNotifications();
  release();
  await sync;
  await logout;
  assert.deepEqual(h.calls.requests.map(request => request.method), ['POST', 'DELETE']);
  assert.equal(h.storage.size, 0);
});

test('signed-out native sync cannot create a device subscription', async () => {
  const h = harness(pushCode, { signedOut: true });
  assert.equal((await h.api.syncNativePushRegistration()).synced, false);
  assert.equal(h.calls.requests.length, 0);
});

test('web logout uses the existing subscription without requesting permission', async () => {
  const h = harness(pushCode, { native: false });
  let unsubscribed = false;
  h.context.navigator.serviceWorker = { async getRegistration(scope) {
    assert.equal(scope, '/');
    return { pushManager: { async getSubscription() {
      return { endpoint: 'https://push.example.test/device', async unsubscribe() { unsubscribed = true; } };
    } } };
  } };
  await h.api.disableDevicePushNotifications();
  assert.equal(h.calls.requests[0].method, 'DELETE');
  assert.equal(JSON.parse(h.calls.requests[0].body).endpoint, 'https://push.example.test/device');
  assert.equal(unsubscribed, true);
});
