import { supabase } from '../lib/supabase';

function normalizeAuthApiError(message) {
  const raw = String(message ?? '').trim();
  if (!raw) return raw;
  if (raw === 'not_found' || raw === 'invalid_credentials' || /invalid login credentials/i.test(raw)) {
    return '아이디 또는 비밀번호가 잘못되었습니다. 입력한 정보를 다시 확인해 주세요.';
  }
  return raw;
}

function isLocalPreview() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function getLocalPreviewEmail(identifier) {
  const value = String(identifier ?? '').trim();
  if (!isLocalPreview() || value.includes('@')) return '';
  if (value.toLowerCase() === 'admin') return 'admin@onepiece-tcg.local';
  return '';
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

export async function signInWithIdentifier(identifier, password) {
  const value = String(identifier ?? '').trim();
  const localEmail = getLocalPreviewEmail(value);

  if (localEmail) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: localEmail, password });
    if (error) throw error;
    return data;
  }

  const payload = await requestJson('/api/auth?action=login', {
    method: 'POST',
    body: { identifier: value, password }
  });
  const { data, error } = await supabase.auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken
  });
  if (error) throw error;
  return data;
}

export async function deleteMyAccount() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token || '';
  if (!token) throw new Error('로그인이 필요합니다.');
  return requestJson('/api/auth?action=delete-account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}
