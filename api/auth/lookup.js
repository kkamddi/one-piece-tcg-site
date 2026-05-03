import { hasSupabaseAdmin, listAllAuthUsers } from '../../lib/supabase-admin.js';

export default async function handler(request, response) {
  if (!hasSupabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  const identifier = String(request.query?.identifier ?? '').trim();
  if (!identifier) return response.status(400).json({ error: 'invalid_request' });
  if (identifier.includes('@')) return response.status(200).json({ email: identifier });

  try {
    const users = await listAllAuthUsers();
    const found = users.find((user) => String(user.user_metadata?.username ?? '').toLowerCase() === identifier.toLowerCase());
    if (!found?.email) return response.status(404).json({ error: 'not_found' });
    return response.status(200).json({ email: found.email });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
