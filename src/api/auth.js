function normalizeAuthApiError(message) {
  const raw = String(message ?? '').trim();
  if (!raw) return raw;
  if (raw === 'not_found' || raw === 'invalid_credentials' || /invalid login credentials/i.test(raw)) {
    return '아이디 또는 비밀번호가 잘못되었습니다. 입력한 정보를 다시 확인해 주세요.';
  }
  return raw;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    method: options.method ?? 'GET',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }

  if (!response.ok) throw new Error(normalizeAuthApiError(payload?.error || payload?.message || `API ${response.status}`));
  return payload;
}

export function checkAuthAvailability(type, value) {
  return requestJson(`/api/auth?action=check&type=${encodeURIComponent(type)}&q=${encodeURIComponent(value)}`);
}

export function signupWithProfile(payload) {
  return requestJson('/api/auth?action=signup', { method: 'POST', body: payload });
}

export function resolveLoginEmail(identifier) {
  return requestJson(`/api/auth?action=lookup&identifier=${encodeURIComponent(identifier)}`);
}
