import { hasSupabaseAdmin, listAllAuthUsers } from '../../lib/supabase-admin.js';

export default async function handler(request, response) {
  if (!hasSupabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  const { type, q } = request.query ?? {};
  const value = String(q ?? '').trim().toLowerCase();
  if (!type || !value) return response.status(400).json({ error: 'invalid_request' });

  try {
    const users = await listAllAuthUsers();
    const taken = users.some((user) => {
      const metadata = user.user_metadata ?? {};
      if (type === 'email') return String(user.email ?? '').toLowerCase() === value;
      if (type === 'username') return String(metadata.username ?? '').toLowerCase() === value;
      if (type === 'nickname') return String(metadata.nickname ?? '').toLowerCase() === value;
      return false;
    });
    return response.status(200).json({ available: !taken });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
