import { Capacitor } from '@capacitor/core';

const SITE_ORIGIN = 'https://www.optcgkorea.com';
const isNativeApp = Capacitor.isNativePlatform();

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
  window.__cardPoneNativeRuntimeConfigured = true;
}
