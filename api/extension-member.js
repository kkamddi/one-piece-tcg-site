import { supabaseAdmin } from '../lib/supabase-admin.js';
import { isRejectedUserToken } from '../lib/auth-errors.js';

// No account data, token echo, cache, or database writes.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, private');
  if (request.method !== 'GET') return response.status(405).json({ error: 'method_not_allowed' });
  const header = request.headers?.authorization || request.headers?.Authorization || '';
  const token = /^Bearer ([^\s]+)$/i.exec(header)?.[1];
  if (!token) return response.status(401).json({ error: 'unauthorized' });
  if (!supabaseAdmin) return response.status(503).json({ error: 'auth_unavailable' });
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (isRejectedUserToken(error)) return response.status(401).json({ error: 'unauthorized' });
    if (error) return response.status(503).json({ error: 'auth_unavailable' });
    if (!data?.user?.id || data.user.is_anonymous) return response.status(401).json({ error: 'unauthorized' });
    return response.status(200).json({ member: true, memberId: data.user.id });
  } catch {
    return response.status(503).json({ error: 'auth_unavailable' });
  }
}
