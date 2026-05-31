import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://omxrcqjmnsthxyvnunjj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Es05CnslUVmRqOeGehdMkA_pciWLFlD';

export const hasSupabaseAuthConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseAuthConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
