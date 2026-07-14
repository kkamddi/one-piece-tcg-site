import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { configureNativeAuth } from './native-auth';

const SITE_ORIGIN = 'https://www.optcgkorea.com';
const isNativeApp = Capacitor.isNativePlatform();

function closeTopModal() {
  const buttons = Array.from(document.querySelectorAll('.renew-modal-close'));
  const visibleButton = buttons.reverse().find((button) => {
    const style = window.getComputedStyle(button);
    return style.display !== 'none' && style.visibility !== 'hidden' && button.getClientRects().length > 0;
  });
  if (!visibleButton) return false;
  visibleButton.click();
  return true;
}

export function resolveApiUrl(value) {
  if (!isNativeApp || typeof value !== 'string' || !value.startsWith('/api/')) return value;
  return `${SITE_ORIGIN}${value}`;
}

export function configureNativeRuntime() {
  if (!isNativeApp || window.__cardPoneNativeRuntimeConfigured) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') {
      return nativeFetch(resolveApiUrl(input), init);
    }

    if (input instanceof URL && input.origin === window.location.origin) {
      return nativeFetch(resolveApiUrl(`${input.pathname}${input.search}${input.hash}`), init);
    }

    if (input instanceof Request) {
      const requestUrl = new URL(input.url);
      if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/')) {
        const url = resolveApiUrl(`${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`);
        return nativeFetch(new Request(url, input), init);
      }
    }

    return nativeFetch(input, init);
  };
  document.documentElement.classList.add('is-native-app');
  configureNativeAuth().catch(() => {});
  PushNotifications.createChannel({
    id: 'price_alerts',
    name: '시세 알림',
    description: '등록한 카드가 설정한 가격 조건에 도달했을 때 알려드립니다.',
    importance: 4,
    visibility: 1,
    vibration: true
  }).catch(() => {});

  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const path = String(notification?.data?.url || '/prices');
    const target = path.startsWith('/') ? path : '/prices';
    window.history.pushState(null, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopModal()) return;
    if (canGoBack) window.history.back();
    else App.minimizeApp();
  });
  window.__cardPoneNativeRuntimeConfigured = true;
}
