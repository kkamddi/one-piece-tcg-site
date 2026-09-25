import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

for (const entry of ['api/me.js', 'api/push-subscriptions.js', 'api/portfolio.js']) {
  const compiled = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'isolated-user-api', setup(builder) {
      builder.onResolve({ filter: /(?:supabase-admin|user-state-store|web-push)\.js$/ }, ({ path }) => ({ path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'js', contents:
        'export const { supabaseAdmin, getUserAppState, saveUserAppState, getVapidPublicKey, isFirebasePushConfigured, sendPushToUser } = globalThis.services;'
      }));
    } }]
  });
  async function request(error, token = 'test-only-token') {
    let reads = 0;
    const context = { module: { exports: {} }, process: { env: {} }, services: {
      supabaseAdmin: { auth: { async getUser() { return { data: null, error }; } } },
      getUserAppState() { reads++; throw new Error('Unexpected user data access'); },
      saveUserAppState() { reads++; throw new Error('Unexpected user data write'); }
    } };
    vm.runInNewContext(compiled.outputFiles[0].text, context);
    const response = {
      headers: {}, setHeader(name, value) { this.headers[name] = value; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; }
    };
    await context.module.exports.default({ method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} }, response);
    assert.equal(reads, 0);
    assert.equal(response.headers['Cache-Control'], 'no-store, private');
    return response;
  }

  test(`${entry}: invalid, expired, and deleted credentials return 401 without reading data`, async () => {
    for (const error of [
      { status: 401 }, { status: 403, code: 'user_not_found' },
      { status: 403, code: 'bad_jwt' }, { status: 403, code: 'session_not_found' },
      { status: 403, code: 'session_expired' }
    ]) {
      const response = await request(error);
      assert.equal(response.statusCode, 401);
      assert.equal(response.body.error, 'unauthorized');
    }
    assert.equal((await request(null, '')).statusCode, 401);
  });

  test(`${entry}: genuine backend failures are not disguised as invalid login`, async () => {
    for (const error of [{ status: 503 }, { status: 429 }, { message: 'network unavailable' }, { status: 500, code: 'bad_jwt' }]) {
      assert.equal((await request(error)).statusCode, 500);
    }
  });
}
