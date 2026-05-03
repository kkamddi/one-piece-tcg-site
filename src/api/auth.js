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
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  return payload;
}

export function checkAuthAvailability(type, value) {
  return requestJson(`/api/auth/check?type=${encodeURIComponent(type)}&q=${encodeURIComponent(value)}`);
}

export function signupWithProfile(payload) {
  return requestJson('/api/auth/signup', { method: 'POST', body: payload });
}

export function resolveLoginEmail(identifier) {
  return requestJson(`/api/auth/lookup?identifier=${encodeURIComponent(identifier)}`);
}
