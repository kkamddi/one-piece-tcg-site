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

export function fetchMarketplaceListings(cardId = '') {
  const params = new URLSearchParams();
  if (cardId) params.set('cardId', cardId);
  const query = params.toString();
  return requestJson(`/api/marketplace${query ? `?${query}` : ''}`);
}

export function createMarketplaceListing(payload) {
  return requestJson('/api/marketplace?action=listing', {
    auth: true,
    method: 'POST',
    body: payload
  });
}

export function uploadMarketplaceImage(payload) {
  return requestJson('/api/marketplace?action=image', {
    auth: true,
    method: 'POST',
    body: payload
  });
}

export function updateMarketplaceListing(id, payload) {
  return requestJson(`/api/marketplace?action=listing&id=${encodeURIComponent(id)}`, {
    auth: true,
    method: 'PATCH',
    body: payload
  });
}

export function incrementMarketplaceListingView(id) {
  return requestJson(`/api/marketplace?action=listing-view&id=${encodeURIComponent(id)}`, {
    method: 'POST'
  });
}

export function updateMarketplaceListingInterest(id, active) {
  return requestJson(`/api/marketplace?action=listing-interest&id=${encodeURIComponent(id)}`, {
    auth: true,
    method: 'POST',
    body: { listingId: id, active }
  });
}

export function deleteMarketplaceListing(id) {
  return requestJson(`/api/marketplace?action=listing&id=${encodeURIComponent(id)}`, {
    auth: true,
    method: 'DELETE'
  });
}

export function fetchMarketplaceMyVerification() {
  return requestJson('/api/marketplace?action=my-verification', { auth: true });
}

export function startMarketplaceConversation(payload) {
  return requestJson('/api/marketplace?action=conversation', {
    auth: true,
    method: 'POST',
    body: payload
  });
}

export function fetchMarketplaceConversations() {
  return requestJson('/api/marketplace?action=conversations', { auth: true });
}

export function fetchMarketplaceMessages(conversationId) {
  return requestJson(`/api/marketplace?action=messages&id=${encodeURIComponent(conversationId)}`, { auth: true });
}

export function sendMarketplaceMessage(payload) {
  return requestJson('/api/marketplace?action=message', {
    auth: true,
    method: 'POST',
    body: payload
  });
}

export function fetchMarketplaceNotifications() {
  return requestJson('/api/marketplace?action=notifications', { auth: true });
}

export function submitMarketplaceVerification(payload) {
  return requestJson('/api/marketplace?action=verification', {
    auth: true,
    method: 'POST',
    body: payload
  });
}

export function fetchMarketplaceVerifications() {
  return requestJson('/api/marketplace?action=verifications', { auth: true });
}

export function updateMarketplaceVerification(id, status) {
  return requestJson(`/api/marketplace?action=verification&id=${encodeURIComponent(id)}`, {
    auth: true,
    method: 'PATCH',
    body: { status }
  });
}

export function deleteMarketplaceVerification(id) {
  return requestJson(`/api/marketplace?action=verification&id=${encodeURIComponent(id)}`, {
    auth: true,
    method: 'DELETE'
  });
}
