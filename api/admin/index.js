import { listAllAuthUsers, supabaseAdmin } from '../../lib/supabase-admin.js';

const COMMUNITY_TABLE = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';

function getKstDayStartIso(daysAgo = 0) {
  const now = new Date();
  const koreaNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startKstUtcMs = Date.UTC(
    koreaNow.getUTCFullYear(),
    koreaNow.getUTCMonth(),
    koreaNow.getUTCDate() - Math.max(0, Number(daysAgo) || 0),
    -9, 0, 0, 0
  );
  return new Date(startKstUtcMs).toISOString();
}

function getKstDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeVisitPath(value = '/') {
  let path = String(value || '/').trim().split(/[?#]/)[0] || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';

  const isJapanese = path === '/jp' || path.startsWith('/jp/');
  const appPath = isJapanese ? path.slice(3) || '/' : path;
  let normalized = appPath;
  if (appPath.startsWith('/cards/')) normalized = '/cards';
  else if (appPath.startsWith('/prices/card/')) normalized = '/prices/card';
  else if (appPath.startsWith('/prices/product/')) normalized = '/prices/product';
  else if (appPath.startsWith('/prices/box/')) normalized = '/prices/box';
  else if (appPath.startsWith('/shops/') && appPath !== '/shops/partners') normalized = '/shops/detail';

  return `${isJapanese ? '/jp' : ''}${normalized === '/' ? (isJapanese ? '' : '/') : normalized}` || '/';
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

  const todayStart = getKstDayStartIso();
  const normalizedPath = normalizeVisitPath(path);
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from(COMMUNITY_TABLE)
    .select('id,board_id,content')
    .in('board_id', ['__visit__', '__pageview__'])
    .eq('author_token', visitIdentity)
    .gte('created_at', todayStart)
    .limit(100);

  if (existingError) throw existingError;

  const rowsToInsert = [];
  if (!(existingRows ?? []).some((row) => row.board_id === '__visit__')) {
    rowsToInsert.push({
      id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      board_id: '__visit__',
      nickname: 'visit',
      title: 'visit',
      card_name: '',
      image_url: '',
      content: normalizedPath,
      likes: 0,
      views: 0,
      author_token: visitIdentity,
      liked_tokens: []
    });
  }
  if (!(existingRows ?? []).some((row) => row.board_id === '__pageview__' && normalizeVisitPath(row.content) === normalizedPath)) {
    rowsToInsert.push({
      id: `pageview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      board_id: '__pageview__',
      nickname: 'pageview',
      title: 'pageview',
      card_name: '',
      image_url: '',
      content: normalizedPath,
      likes: 0,
      views: 0,
      author_token: visitIdentity,
      liked_tokens: []
    });
  }

  if (rowsToInsert.length) {
    const { error } = await supabaseAdmin.from(COMMUNITY_TABLE).insert(rowsToInsert);
    if (error) throw error;
  }

  return response.status(200).json({ ok: true });
}

async function handleStats(request, response) {
  const authHeader = String(request.headers.authorization ?? '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return response.status(401).json({ error: 'unauthorized' });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const authUser = authData?.user;
  const isAdmin = authUser?.app_metadata?.role === 'admin'
    || authUser?.user_metadata?.username === 'admin';
  if (authError || !isAdmin) {
    return response.status(403).json({ error: 'forbidden' });
  }

  const requestedDays = Number(request.query?.days);
  const periodDays = [1, 7, 30].includes(requestedDays) ? requestedDays : 7;
  const todayStart = getKstDayStartIso();
  const periodStart = getKstDayStartIso(periodDays - 1);
  const users = await listAllAuthUsers();
  const [
    { count: totalVisits, error: visitCountError },
    { count: todayVisits, error: todayVisitCountError },
    { count: periodVisits, error: periodVisitCountError },
    { data: analyticsRows, error: analyticsRowsError },
    { data: postRows, error: postRowsError }
  ] = await Promise.all([
    supabaseAdmin.from(COMMUNITY_TABLE).select('id', { count: 'exact', head: true }).eq('board_id', '__visit__'),
    supabaseAdmin.from(COMMUNITY_TABLE).select('id', { count: 'exact', head: true }).eq('board_id', '__visit__').gte('created_at', todayStart),
    supabaseAdmin.from(COMMUNITY_TABLE).select('id', { count: 'exact', head: true }).eq('board_id', '__visit__').gte('created_at', periodStart),
    supabaseAdmin
      .from(COMMUNITY_TABLE)
      .select('board_id,content,author_token,created_at')
      .in('board_id', ['__visit__', '__pageview__'])
      .gte('created_at', periodStart)
      .order('created_at', { ascending: true })
      .limit(10000),
    supabaseAdmin.from(COMMUNITY_TABLE).select('id,board_id').limit(10000)
  ]);

  if (visitCountError) throw visitCountError;
  if (todayVisitCountError) throw todayVisitCountError;
  if (periodVisitCountError) throw periodVisitCountError;
  if (analyticsRowsError) throw analyticsRowsError;
  if (postRowsError) throw postRowsError;

  const publicPostRows = (postRows ?? []).filter((row) => !String(row.board_id ?? '').startsWith('__'));
  const todaySignups = users.filter((user) => String(user.created_at ?? '') >= todayStart).length;
  const pageViewRows = (analyticsRows ?? []).filter((row) => row.board_id === '__pageview__');
  const visitRows = (analyticsRows ?? []).filter((row) => row.board_id === '__visit__');
  const pageViewVisitorDays = new Set(pageViewRows.map((row) => `${row.author_token}|${getKstDateKey(row.created_at)}`));
  const mergedAnalyticsRows = [
    ...pageViewRows,
    ...(analyticsRows ?? []).filter((row) => (
      row.board_id === '__visit__'
      && !pageViewVisitorDays.has(`${row.author_token}|${getKstDateKey(row.created_at)}`)
    ))
  ];
  const pageMap = new Map();
  const dailyMap = new Map();

  for (const row of mergedAnalyticsRows) {
    const path = normalizeVisitPath(row.content);
    const date = getKstDateKey(row.created_at);
    if (!date) continue;
    const page = pageMap.get(path) ?? { path, visits: new Set(), visitors: new Set() };
    page.visits.add(`${row.author_token}|${date}`);
    page.visitors.add(row.author_token);
    pageMap.set(path, page);
  }

  for (const row of visitRows) {
    const date = getKstDateKey(row.created_at);
    if (!date) continue;
    const day = dailyMap.get(date) ?? { date, visitors: new Set() };
    day.visitors.add(row.author_token);
    dailyMap.set(date, day);
  }

  const popularPages = [...pageMap.values()]
    .map((item) => ({ path: item.path, visits: item.visits.size, visitors: item.visitors.size }))
    .sort((a, b) => b.visits - a.visits || b.visitors - a.visitors || a.path.localeCompare(b.path))
    .slice(0, 12);
  const dailyTrend = [...dailyMap.values()]
    .map((item) => ({ date: item.date, visits: item.visitors.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const periodUniqueVisitors = new Set(visitRows.map((row) => row.author_token)).size;

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(200).json({
    totalVisits: totalVisits ?? 0,
    todayVisits: todayVisits ?? 0,
    todayUniqueVisitors: todayVisits ?? 0,
    totalUsers: users.length,
    todaySignups,
    totalPosts: publicPostRows.length,
    periodDays,
    periodVisits: periodVisits ?? 0,
    periodUniqueVisitors,
    popularPages,
    dailyTrend
  });
}

async function handleOperations(request, response) {
  const authHeader = String(request.headers.authorization ?? '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return response.status(401).json({ error: 'unauthorized' });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const authUser = authData?.user;
  const isAdmin = authUser?.app_metadata?.role === 'admin'
    || authUser?.user_metadata?.username === 'admin';
  if (authError || !isAdmin) {
    return response.status(403).json({ error: 'forbidden' });
  }

  const bucket = process.env?.CARD_THUMBNAILS;
  if (!bucket || typeof bucket.get !== 'function') {
    return response.status(503).json({ error: 'operations_store_unavailable' });
  }
  const object = await bucket.get('operations/status/latest.json');
  if (!object) {
    return response.status(404).json({ error: 'operations_status_not_found' });
  }
  const payload = JSON.parse(await object.text());
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(200).json(payload);
}

export default async function handler(request, response) {
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  const action = String(request.query?.action ?? '').toLowerCase();

  try {
    if (request.method === 'POST' && action === 'visit') return await handleVisit(request, response);
    if (request.method === 'GET' && action === 'stats') return await handleStats(request, response);
    if (request.method === 'GET' && action === 'operations') return await handleOperations(request, response);
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
