import { createHash } from 'node:crypto';
import { listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';

function getTodayStartIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
}

function getClientIp(request) {
  const forwarded = String(
    request.headers['cf-connecting-ip']
      ?? request.headers['x-forwarded-for']
      ?? request.headers['x-real-ip']
      ?? request.headers['x-vercel-forwarded-for']
      ?? ''
  ).trim();

  if (!forwarded) return '';
  return forwarded.split(',')[0].trim();
}

function buildVisitIdentity(request, visitorToken = '') {
  const clientIp = getClientIp(request);
  if (clientIp) {
    const hashedIp = createHash('sha256').update(clientIp).digest('hex');
    return `ip:${hashedIp}`;
  }

  const safeToken = String(visitorToken ?? '').trim();
  return safeToken ? `token:${safeToken}` : '';
}

async function handleVisit(request, response) {
  const { visitorToken, path = '/' } = request.body ?? {};
  const visitIdentity = buildVisitIdentity(request, visitorToken);
  if (!visitIdentity) return response.status(400).json({ error: 'invalid_request' });

  const todayStart = getTodayStartIso();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from(COMMUNITY_TABLE)
    .select('id')
    .eq('board_id', '__visit__')
    .eq('author_token', visitIdentity)
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
      author_token: visitIdentity,
      liked_tokens: []
    });
    if (error) throw error;
  }

  return response.status(200).json({ ok: true });
}

async function handleStats(request, response) {
  const adminHeader = String(request.headers['x-admin-username'] ?? '').toLowerCase();
  if (adminHeader !== 'admin') return response.status(403).json({ error: 'forbidden' });

  const todayStart = getTodayStartIso();
  const users = await listAllAuthUsers();
  const { data: allRows, error: allRowsError } = await supabaseAdmin.from(COMMUNITY_TABLE).select('id,board_id,author_token,created_at');
  if (allRowsError) throw allRowsError;

  const rows = allRows ?? [];
  const visitRows = rows.filter((row) => row.board_id === '__visit__');
  const postRows = rows.filter((row) => !String(row.board_id ?? '').startsWith('__'));
  const todayVisitRows = visitRows.filter((row) => row.created_at >= todayStart);
  const todayUniqueVisitors = new Set(todayVisitRows.map((row) => row.author_token)).size;
  const todaySignups = users.filter((user) => String(user.created_at ?? '') >= todayStart).length;

  return response.status(200).json({
    totalVisits: visitRows.length,
    todayVisits: todayUniqueVisitors,
    todayUniqueVisitors,
    totalUsers: users.length,
    todaySignups,
    totalPosts: postRows.length
  });
}

export default async function handler(request, response) {
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  const action = String(request.query?.action ?? '').toLowerCase();

  try {
    if (request.method === 'POST' && action === 'visit') return await handleVisit(request, response);
    if (request.method === 'GET' && action === 'stats') return await handleStats(request, response);
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
