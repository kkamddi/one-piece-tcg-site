import { supabase } from '../lib/supabase';

async function requestJson(url, options = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const token = data?.session?.access_token || '';
  const response = await fetch(url, {
    method: options.method || 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `API ${response.status}`);
  return payload;
}

export function fetchPriceAlertRules() {
  return requestJson('/api/price-alerts');
}

export function savePriceAlertRule(payload) {
  return requestJson('/api/price-alerts', { method: payload?.id ? 'PATCH' : 'POST', body: payload });
}

export function deletePriceAlertRule(id) {
  return requestJson(`/api/price-alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
