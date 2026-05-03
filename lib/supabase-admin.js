import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const hasSupabaseAdmin = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = hasSupabaseAdmin
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export async function listAllAuthUsers() {
  if (!supabaseAdmin) throw new Error('supabase_admin_not_configured');
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}
