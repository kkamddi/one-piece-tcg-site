import { supabase } from '../lib/supabase';

async function getAccessToken() {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function requestJson(url) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    cache: 'no-store',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  return payload;
}

export function fetchDeckLabReference(region = 'KR') {
  const query = new URLSearchParams({ action: 'reference', region });
  return requestJson(`/api/deck-lab?${query.toString()}`);
}

export function fetchDeckTemplateVersion(versionId) {
  const query = new URLSearchParams({ action: 'template-version', versionId });
  return requestJson(`/api/deck-lab?${query.toString()}`);
}
