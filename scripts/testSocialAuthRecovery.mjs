import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/_middleware.js';
import { onRequestGet } from '../functions/naver-userinfo.js';
import { readAuthCallbackError, clearAuthCallbackError, getSocialAuthErrorMessage } from '../src/lib/auth-errors.js';

test('Naver userinfo bypasses SEO middleware and reaches the auth handler', async () => {
  const request = new Request('https://www.optcgkorea.com/naver-userinfo');
  const response = await onRequest({ request, next: () => onRequestGet({ request }) });
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).error, 'missing_bearer_token');
  const routes = JSON.parse(await readFile(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/naver-userinfo'));
});

test('unknown paths remain 404; API routes still bypass SEO', async () => {
  const missing = await onRequest({ request: new Request('https://www.optcgkorea.com/missing-auth-route'), next: () => { throw new Error('Unexpected next'); } });
  assert.equal(missing.status, 404);
  const api = await onRequest({ request: new Request('https://www.optcgkorea.com/api/auth'), next: () => new Response('api') });
  assert.equal(await api.text(), 'api');
});

test('callback failures are captured from query and hash without disclosing backend text', () => {
  for (const separator of ['?', '#']) {
    const error = readAuthCallbackError(`https://www.optcgkorea.com/${separator}error=server_error&error_code=unexpected_failure&error_description=Multiple+accounts+with+the+same+email+address`);
    assert.equal(error.code, 'unexpected_failure');
    assert.match(getSocialAuthErrorMessage(error), /마이페이지/);
  }
  assert.match(getSocialAuthErrorMessage({ code: 'access_denied' }), /취소/);
  assert.match(getSocialAuthErrorMessage({ code: 'identity_already_exists' }), /다른 Card Pone/);
  assert.match(getSocialAuthErrorMessage({ code: 'manual_linking_disabled' }), /사용할 수 없습니다/);
  assert.match(getSocialAuthErrorMessage({ code: 'session_not_found' }), /만료/);
  assert.doesNotMatch(getSocialAuthErrorMessage({ message: '<html>secret@example.com</html>' }), /html|secret@example/);
});

test('cleaning failed callbacks preserves unrelated routes, parameters, and successful tokens', () => {
  assert.equal(clearAuthCallbackError('https://www.optcgkorea.com/?q=OP17&error=denied#error=denied&tab=cards'), '/?q=OP17#tab=cards');
  const success = 'https://www.optcgkorea.com/?code=sample-code#access_token=sample-token&refresh_token=sample-refresh';
  assert.equal(readAuthCallbackError(success), null);
  assert.equal(clearAuthCallbackError(success), '/?code=sample-code#access_token=sample-token&refresh_token=sample-refresh');
  assert.equal(readAuthCallbackError('invalid'), null);
  assert.equal(clearAuthCallbackError('https://www.optcgkorea.com/#collection'), '/#collection');
});

test('Naver accepts an authenticated stable ID even when optional email is not shared', async (t) => {
  const request = new Request('https://www.optcgkorea.com/naver-userinfo', { headers: { Authorization: 'Bearer test-only' } });
  for (const email of [undefined, 'TEST@example.com']) {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, 'https://openapi.naver.com/v1/nid/me');
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      return Response.json({ resultcode: '00', response: { id: 'stable-id', nickname: 'Tester', email } });
    });
    const response = await onRequestGet({ request });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.equal(data.sub, 'stable-id');
    assert.equal(data.naver_email, email ? email.toLowerCase() : undefined);
    assert.equal(data.email, undefined);
    assert.equal(data.email_verified, undefined);
    t.mock.restoreAll();
  }
});

test('Naver rejects invalid provider responses and network failures', async (t) => {
  const request = new Request('https://www.optcgkorea.com/naver-userinfo', { headers: { Authorization: 'Bearer test-only' } });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ resultcode: '024' }, { status: 401 }));
  assert.equal((await onRequestGet({ request })).status, 401);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal((await onRequestGet({ request })).status, 502);
});
