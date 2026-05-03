import { getUserAppState, saveUserAppState } from '../lib/user-state-store.js';
import { supabaseAdmin } from '../lib/supabase-admin.js';

async function getAuthenticatedUser(request) {
  const authHeader = String(request.headers.authorization ?? '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) throw error;
  return data?.user ?? null;
}

export default async function handler(request, response) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) return response.status(401).json({ error: 'unauthorized' });

    if (request.method === 'GET') {
      const state = await getUserAppState(user.id);
      return response.status(200).json({
        ...state,
        profile: {
          userId: user.id,
          username: user.user_metadata?.username ?? '',
          nickname: user.user_metadata?.nickname ?? ''
        }
      });
    }

    if (request.method === 'PATCH') {
      const next = await saveUserAppState(user.id, request.body ?? {});
      return response.status(200).json({ ok: true, ...next });
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
