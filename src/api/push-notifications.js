import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const NATIVE_TOKEN_KEY = 'card-pone-native-push-token';
const isNativeApp = Capacitor.isNativePlatform();

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

async function registerNativePushToken() {
  let registrationHandle;
  let errorHandle;
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error('push_registration_timeout')), 15000);
      Promise.all([
        PushNotifications.addListener('registration', ({ value }) => resolve(value)),
        PushNotifications.addListener('registrationError', (error) => reject(new Error(error?.error || 'push_registration_failed')))
      ]).then(([registered, failed]) => {
        registrationHandle = registered;
        errorHandle = failed;
        return PushNotifications.register();
      }).catch(reject);
    });
  } finally {
    window.clearTimeout(timer);
    await registrationHandle?.remove();
    await errorHandle?.remove();
  }
}

async function saveNativePushToken(token, silent = false) {
  if (!token) throw new Error('push_registration_failed');
  window.localStorage.setItem(NATIVE_TOKEN_KEY, token);
  await requestJson('/api/push-subscriptions', { method: 'POST', body: { platform: 'android', token, silent } });
  return token;
}

export function getPushCapability() {
  if (typeof window === 'undefined') return { supported: false, permission: 'unsupported' };
  if (isNativeApp) {
    return { supported: true, permission: window.localStorage.getItem(NATIVE_TOKEN_KEY) ? 'granted' : 'prompt' };
  }
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, permission: supported ? Notification.permission : 'unsupported' };
}

export async function fetchPushNotificationStatus() {
  const capability = getPushCapability();
  if (!capability.supported) return { ...capability, subscribed: false, configured: false };
  if (isNativeApp) {
    const permission = await PushNotifications.checkPermissions();
    const token = window.localStorage.getItem(NATIVE_TOKEN_KEY) || '';
    const endpoint = token ? `fcm:${token}` : '';
    const status = await requestJson(`/api/push-subscriptions${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`);
    return {
      ...capability,
      ...status,
      permission: permission.receive,
      configured: Boolean(status.nativeConfigured),
      subscribed: Boolean(token && status.subscribed)
    };
  }
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || '';
  const status = await requestJson(`/api/push-subscriptions${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`);
  return { ...capability, ...status, subscribed: Boolean(subscription && status.subscribed), registration };
}

export async function enablePushNotifications() {
  const capability = getPushCapability();
  if (!capability.supported) throw new Error('push_unsupported');
  if (isNativeApp) {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') throw new Error(permission.receive === 'denied' ? 'push_denied' : 'push_not_granted');

    const token = await registerNativePushToken();
    await saveNativePushToken(token);
    return { permission: 'granted', subscribed: true };
  }
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

export async function syncNativePushRegistration() {
  if (!isNativeApp || !supabase) return { synced: false };
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted') return { synced: false };
  const token = await registerNativePushToken();
  await saveNativePushToken(token, true);
  return { synced: true };
}
