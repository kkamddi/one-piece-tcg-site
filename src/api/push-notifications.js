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

function base64UrlToUint8Array(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function getPushCapability() {
  if (typeof window === 'undefined') return { supported: false, permission: 'unsupported' };
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, permission: supported ? Notification.permission : 'unsupported' };
}

export async function fetchPushNotificationStatus() {
  const capability = getPushCapability();
  if (!capability.supported) return { ...capability, subscribed: false, configured: false };
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || '';
  const status = await requestJson(`/api/push-subscriptions${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`);
  return { ...capability, ...status, subscribed: Boolean(subscription && status.subscribed), registration };
}

export async function enablePushNotifications() {
  const capability = getPushCapability();
  if (!capability.supported) throw new Error('push_unsupported');
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'push_denied' : 'push_not_granted');
  const status = await requestJson('/api/push-subscriptions');
  if (!status.configured || !status.publicKey) throw new Error('push_not_configured');
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(status.publicKey)
    });
  }
  await requestJson('/api/push-subscriptions', { method: 'POST', body: { subscription: subscription.toJSON() } });
  return { permission, subscribed: true, registration };
}

export function sendTestPushNotification() {
  return requestJson('/api/push-subscriptions?action=test', { method: 'POST', body: {} });
}
