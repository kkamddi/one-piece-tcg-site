import { supabase } from '../lib/supabase';

const API_BASE = '/api/community';

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

  if (!response.ok) {
    let message = `API ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch {}
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function fetchCommunityPosts() {
  return requestJson(API_BASE, { auth: true });
}

export function createCommunityPost(payload) {
  return requestJson(API_BASE, { auth: true, method: 'POST', body: payload });
}

export function uploadCommunityImage(payload) {
  return requestJson(`${API_BASE}?action=image`, {
    auth: true,
    method: 'POST',
    body: payload
  });
}

export function updateCommunityPost(id, payload) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}`, { auth: true, method: 'PATCH', body: payload });
}

export function deleteCommunityPost(id) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}`, { auth: true, method: 'DELETE' });
}

export function incrementCommunityPostView(id) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}?action=view`, { auth: true, method: 'POST' });
}

export function toggleCommunityPostLike(id) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}?action=like`, { auth: true, method: 'POST' });
}

export function fetchCommunityComments(id) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}?action=comments`, { auth: true });
}

export function addCommunityComment(id, payload) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}?action=comment`, { auth: true, method: 'POST', body: payload });
}

export function fetchCommunityAttendance() {
  return requestJson(`${API_BASE}?action=attendance`, { auth: true });
}

export function checkInCommunityAttendance() {
  return requestJson(`${API_BASE}?action=attendance`, { auth: true, method: 'POST' });
}
