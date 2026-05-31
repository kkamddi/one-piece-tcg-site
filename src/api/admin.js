import { supabase } from '../lib/supabase';

async function getAccessToken() {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function requestJson(url, options = {}) {
  const accessToken = options.auth ? await getAccessToken() : '';
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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

export function trackVisit(visitorToken, path) {
  return requestJson('/api/admin?action=visit', { method: 'POST', body: { visitorToken, path } });
}

export function fetchAdminStats(username) {
  return requestJson('/api/admin?action=stats', { auth: true, headers: { 'x-admin-username': username } });
}
