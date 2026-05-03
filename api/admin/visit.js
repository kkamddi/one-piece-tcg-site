import { supabaseAdmin } from '../../lib/supabase-admin.js';

const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';

function getTodayStartIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  const { visitorToken, path = '/' } = request.body ?? {};
  const safeToken = String(visitorToken ?? '').trim();
  if (!safeToken) return response.status(400).json({ error: 'invalid_request' });

  const todayStart = getTodayStartIso();

  try {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from(COMMUNITY_TABLE)
      .select('id')
      .eq('board_id', '__visit__')
      .eq('author_token', safeToken)
      .gte('created_at', todayStart)
      .limit(1);

    if (existingError) throw existingError;

    if (!existing?.length) {
      const { error } = await supabaseAdmin.from(COMMUNITY_TABLE).insert({
        id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        board_id: '__visit__',
        nickname: 'visit',
        title: 'visit',
        card_name: '',
        image_url: '',
        content: String(path).slice(0, 200),
        likes: 0,
        views: 0,
        author_token: safeToken,
        liked_tokens: []
      });
      if (error) throw error;
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
