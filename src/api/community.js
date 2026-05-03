const API_BASE = '/api/community';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { 'x-community-token': options.token } : {}),
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

export function fetchCommunityPosts(token) {
  return requestJson(API_BASE, { token });
}

export function createCommunityPost(payload, token) {
  return requestJson(API_BASE, { method: 'POST', body: payload, token });
}

export function updateCommunityPost(id, payload, token) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token });
}

export function deleteCommunityPost(id, token) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export function incrementCommunityPostView(id, token) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}?action=view`, { method: 'POST', token });
}

export function toggleCommunityPostLike(id, token) {
  return requestJson(`${API_BASE}/${encodeURIComponent(id)}?action=like`, { method: 'POST', token });
}
