import { listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';

function getTodayStartIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
}

export default async function handler(request, response) {
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });
  const adminHeader = String(request.headers['x-admin-username'] ?? '').toLowerCase();
  if (adminHeader !== 'admin') return response.status(403).json({ error: 'forbidden' });

  try {
    const todayStart = getTodayStartIso();
    const users = await listAllAuthUsers();
    const { data: allRows, error: allRowsError } = await supabaseAdmin.from(COMMUNITY_TABLE).select('id,board_id,author_token,created_at');
    if (allRowsError) throw allRowsError;

    const rows = allRows ?? [];
    const visitRows = rows.filter((row) => row.board_id === '__visit__');
    const postRows = rows.filter((row) => row.board_id !== '__visit__');
    const todayVisitRows = visitRows.filter((row) => row.created_at >= todayStart);
    const todayUniqueVisitors = new Set(todayVisitRows.map((row) => row.author_token)).size;
    const todaySignups = users.filter((user) => String(user.created_at ?? '') >= todayStart).length;

    return response.status(200).json({
      todayVisits: todayVisitRows.length,
      todayUniqueVisitors,
      totalUsers: users.length,
      todaySignups,
      totalPosts: postRows.length
    });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
