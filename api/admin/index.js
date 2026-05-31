import { listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';

function getTodayStartIso() {
  const now = new Date();
  const koreaNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startKstUtcMs = Date.UTC(
    koreaNow.getUTCFullYear(),
    koreaNow.getUTCMonth(),
    koreaNow.getUTCDate(),
    -9, 0, 0, 0
  );
  return new Date(startKstUtcMs).toISOString();
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

function simpleHash(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function buildVisitIdentity(request, visitorToken = '') {
  const safeToken = String(visitorToken ?? '').trim();
  if (safeToken) return `token:${safeToken}`;

  const clientIp = getClientIp(request);
  if (clientIp) {
    return `ip:${simpleHash(clientIp)}`;
  }
  return '';
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
  const authHeader = String(request.headers.authorization ?? '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return response.status(401).json({ error: 'unauthorized' });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || authData?.user?.user_metadata?.username !== 'admin') {
    return response.status(403).json({ error: 'forbidden' });
  }

  const todayStart = getTodayStartIso();
  const users = await listAllAuthUsers();
  const [
    { count: totalVisits, error: visitCountError },
    { data: todayVisitRows, error: todayVisitRowsError },
    { data: postRows, error: postRowsError }
  ] = await Promise.all([
    supabaseAdmin.from(COMMUNITY_TABLE).select('id', { count: 'exact', head: true }).eq('board_id', '__visit__'),
    supabaseAdmin.from(COMMUNITY_TABLE).select('author_token').eq('board_id', '__visit__').gte('created_at', todayStart).limit(10000),
    supabaseAdmin.from(COMMUNITY_TABLE).select('id,board_id').limit(10000)
  ]);

  if (visitCountError) throw visitCountError;
  if (todayVisitRowsError) throw todayVisitRowsError;
  if (postRowsError) throw postRowsError;

  const publicPostRows = (postRows ?? []).filter((row) => !String(row.board_id ?? '').startsWith('__'));
  const todayUniqueVisitors = new Set((todayVisitRows ?? []).map((row) => row.author_token)).size;
  const todaySignups = users.filter((user) => String(user.created_at ?? '') >= todayStart).length;

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(200).json({
    totalVisits: totalVisits ?? 0,
    todayVisits: todayUniqueVisitors,
    todayUniqueVisitors,
    totalUsers: users.length,
    todaySignups,
    totalPosts: publicPostRows.length
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
