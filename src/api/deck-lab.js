import { supabase } from '../lib/supabase';

async function getAccessToken() {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function requestJson(url, options = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    }
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

export function fetchPopularDeckLeaders(region = 'KR') {
  const query = new URLSearchParams({ action: 'popular', region });
  return requestJson(`/api/deck-lab?${query.toString()}`);
}

export function fetchLeaderOverview(region, cardNo) {
  const query = new URLSearchParams({ action: 'leader-overview', region, cardNo });
  return requestJson(`/api/deck-lab?${query.toString()}`);
}

export function recordLeaderSelection(region, cardNo) {
  return requestJson('/api/deck-lab', {
    method: 'POST',
    body: JSON.stringify({ action: 'select-leader', region, cardNo })
  });
}

export function saveLeaderReview(region, cardNo, rating, content) {
  return requestJson('/api/deck-lab', {
    method: 'POST',
    body: JSON.stringify({ action: 'review', region, cardNo, rating, content })
  });
}

export function deleteLeaderReview(region, cardNo) {
  const query = new URLSearchParams({ action: 'review', region, cardNo });
  return requestJson(`/api/deck-lab?${query.toString()}`, { method: 'DELETE' });
}
