import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const WEB_AUTH_REDIRECT = 'https://www.optcgkorea.com/';
const NATIVE_AUTH_REDIRECT = 'com.optcgkorea.cardpone://auth/callback';
const NATIVE_AUTH_START = `${WEB_AUTH_REDIRECT}native-auth-start`;
const NATIVE_AUTH_EVENT = 'card-pone:native-auth';

let nativeAuthConfigured = false;

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

function getCallbackParams(url) {
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  return { query, hash };
}

async function handleNativeAuthUrl(url) {
  if (!isNativePlatform() || !supabase || !String(url || '').startsWith(NATIVE_AUTH_REDIRECT)) return false;

  const { query, hash } = getCallbackParams(url);
  const errorMessage = query.get('error_description') || hash.get('error_description') || query.get('error') || hash.get('error');
  if (errorMessage) {
    window.dispatchEvent(new CustomEvent(NATIVE_AUTH_EVENT, { detail: { error: errorMessage } }));
    return true;
  }

  let session = null;
  const code = query.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    session = data?.session || null;
  } else {
    const accessToken = hash.get('access_token') || query.get('access_token');
    const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
    if (!accessToken || !refreshToken) throw new Error('인증 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    session = data?.session || null;
  }

  await Browser.close().catch(() => {});
  window.dispatchEvent(new CustomEvent(NATIVE_AUTH_EVENT, { detail: { user: session?.user || null } }));
  return true;
}

export async function configureNativeAuth() {
  if (!isNativePlatform() || nativeAuthConfigured) return;
  nativeAuthConfigured = true;

  await App.addListener('appUrlOpen', ({ url }) => {
    handleNativeAuthUrl(url).catch((error) => {
      window.dispatchEvent(new CustomEvent(NATIVE_AUTH_EVENT, {
        detail: { error: error?.message || '소셜 로그인에 실패했습니다.' }
      }));
    });
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) await handleNativeAuthUrl(launch.url);
}

export async function signInWithSocialProvider(provider) {
  if (!supabase) throw new Error('인증 설정을 확인할 수 없습니다.');

  if (!isNativePlatform()) {
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: WEB_AUTH_REDIRECT }
    });
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: WEB_AUTH_REDIRECT,
      skipBrowserRedirect: true
    }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('로그인 페이지를 열 수 없습니다.');

  const startUrl = `${NATIVE_AUTH_START}?oauth=${encodeURIComponent(data.url)}`;
  await Browser.open({ url: startUrl, toolbarColor: '#ffffff', presentationStyle: 'fullscreen' });
  return { data, error: null };
}

export { NATIVE_AUTH_EVENT };
