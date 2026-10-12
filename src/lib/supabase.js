import { readAuthCallbackError } from './auth-errors';

// Capture provider errors before the SDK consumes the callback URL.
export const initialAuthCallbackError = typeof window === 'undefined'
  ? null : readAuthCallbackError(window.location.href);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://omxrcqjmnsthxyvnunjj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Es05CnslUVmRqOeGehdMkA_pciWLFlD';

export const hasSupabaseAuthConfig = Boolean(supabaseUrl && supabaseAnonKey);

// The SDK is about a quarter of the app bundle, so it is loaded after the first paint.
// Every caller awaits getSupabase(); it resolves to null when auth is not configured.
let clientPromise = null;

export function getSupabase() {
  if (!hasSupabaseAuthConfig) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }));
  return clientPromise;
}

// A page opened from an auth redirect carries tokens or an error in the URL. main.jsx lets the SDK read them
// before the app renders, because the app rewrites the URL as it routes. Web sign-in uses the implicit flow
// (tokens in the hash); `?code=` is not checked because site links such as /prices?tab=box&code= use it.
export function hasAuthCallbackInUrl(href) {
  try {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.slice(1));
    return ['access_token', 'refresh_token', 'error', 'error_description'].some((key) => hash.has(key))
      || ['error', 'error_description'].some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
}
