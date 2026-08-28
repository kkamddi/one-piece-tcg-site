const API_BASE = import.meta.env.DEV ? '/__prod_api/api/card-world-cup' : '/api/card-world-cup';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'card_world_cup_request_failed');
  return body;
}

export function fetchCardWorldCupRanking() {
  return requestJson(API_BASE);
}

export function submitCardWorldCupResult(payload) {
  return requestJson(API_BASE, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
