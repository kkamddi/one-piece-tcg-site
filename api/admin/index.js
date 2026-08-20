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
  const isAdmin = String(authUser?.app_metadata?.role || '').toLowerCase() === 'admin';
  if (authError || !isAdmin) {
    return response.status(403).json({ error: 'forbidden' });
  }

  const requestedDays = Number(request.query?.days);
  const periodDays = [1, 7, 30].includes(requestedDays) ? requestedDays : 7;
  const todayStart = getKstDayStartIso();
  const periodStart = getKstDayStartIso(periodDays - 1);
  const dailyVisitRanges = Array.from({ length: periodDays }, (_, index) => {
    const daysAgo = periodDays - 1 - index;
    return {
      date: getKstDateKey(getKstDayStartIso(daysAgo)),
      start: getKstDayStartIso(daysAgo),
      end: daysAgo > 0 ? getKstDayStartIso(daysAgo - 1) : ''
    };
  });
  const users = await listAllAuthUsers();
  const [
    { count: totalVisits, error: visitCountError },
    dailyVisitResults,
    { data: analyticsRows, error: analyticsRowsError },
    { data: postRows, error: postRowsError }
  ] = await Promise.all([
    supabaseAdmin.from(COMMUNITY_TABLE).select('id', { count: 'exact', head: true }).eq('board_id', '__visit__'),
    Promise.all(dailyVisitRanges.map(({ start, end }) => {
      const query = supabaseAdmin
        .from(COMMUNITY_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('board_id', '__visit__')
        .gte('created_at', start);
      return end ? query.lt('created_at', end) : query;
    })),
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
  const dailyVisitError = dailyVisitResults.find((result) => result.error)?.error;
  if (dailyVisitError) throw dailyVisitError;
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

  for (const row of mergedAnalyticsRows) {
    const path = normalizeVisitPath(row.content);
    const date = getKstDateKey(row.created_at);
    if (!date) continue;
    const page = pageMap.get(path) ?? { path, visits: new Set(), visitors: new Set() };
    page.visits.add(`${row.author_token}|${date}`);
    page.visitors.add(row.author_token);
    pageMap.set(path, page);
  }

  const popularPages = [...pageMap.values()]
    .map((item) => ({ path: item.path, visits: item.visits.size, visitors: item.visitors.size }))
    .sort((a, b) => b.visits - a.visits || b.visitors - a.visitors || a.path.localeCompare(b.path))
    .slice(0, 12);
  const dailyTrend = dailyVisitRanges.map(({ date }, index) => ({
    date,
    visits: dailyVisitResults[index].count ?? 0
  }));
  const todayVisits = dailyTrend.at(-1)?.visits ?? 0;
  const periodVisits = dailyTrend.reduce((sum, item) => sum + item.visits, 0);
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

function normalizeSearchItem(value) {
  const source = value && typeof value === 'object' ? value : {};
  const type = ['card', 'box', 'query'].includes(source.type) ? source.type : 'query';
  const locale = ['KR', 'JP', 'EN'].includes(String(source.locale || '').toUpperCase())
    ? String(source.locale).toUpperCase()
    : 'JP';
  const label = String(source.label || '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 80);
  const query = String(source.query || label).normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 80);
  const targetId = String(source.targetId || '').trim().slice(0, 120);
  const keySource = targetId || query.toLowerCase().replace(/[^0-9a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣ぁ-んァ-ヶ一-龯]+/g, '');
  const key = `${type}:${locale}:${keySource}`.slice(0, 180);
  if (!label || !query || keySource.length < 1) return null;
  return { type, locale, label, query, targetId, key };
}

async function handleSearch(request, response) {
  const { visitorToken, item } = request.body ?? {};
  const visitIdentity = buildVisitIdentity(request, visitorToken);
  const normalized = normalizeSearchItem(item);
  if (!visitIdentity || !normalized) return response.status(400).json({ error: 'invalid_request' });

  const duplicateWindow = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from(COMMUNITY_TABLE)
    .select('id')
    .eq('board_id', '__search__')
    .eq('author_token', visitIdentity)
    .eq('title', normalized.key)
    .gte('created_at', duplicateWindow)
    .limit(1);
  if (existingError) throw existingError;

  if (!(existingRows ?? []).length) {
    const { error } = await supabaseAdmin.from(COMMUNITY_TABLE).insert({
      id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      board_id: '__search__',
      nickname: normalized.label,
      title: normalized.key,
      card_name: normalized.type,
      image_url: '',
      content: JSON.stringify(normalized),
      likes: 0,
      views: 0,
      author_token: visitIdentity,
      liked_tokens: []
    });
    if (error) throw error;
  }

  return response.status(200).json({ ok: true });
}

async function handlePopularSearches(request, response) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from(COMMUNITY_TABLE)
    .select('title,nickname,card_name,content,author_token,created_at')
    .eq('board_id', '__search__')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const grouped = new Map();
  for (const row of data ?? []) {
    let item;
    try {
      item = normalizeSearchItem(JSON.parse(row.content || '{}'));
    } catch {
      item = null;
    }
    if (!item) continue;
    const entry = grouped.get(item.key) || { ...item, searches: 0, visitors: new Set(), latestAt: '' };
    entry.searches += 1;
    entry.visitors.add(row.author_token);
    if (!entry.latestAt || row.created_at > entry.latestAt) entry.latestAt = row.created_at;
    grouped.set(item.key, entry);
  }

  const items = [...grouped.values()]
    .map(({ visitors, ...item }) => ({ ...item, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors || b.searches - a.searches || b.latestAt.localeCompare(a.latestAt))
    .slice(0, 10);
  response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  return response.status(200).json({ items, windowHours: 24 });
}

async function handleOperations(request, response) {
  const authHeader = String(request.headers.authorization ?? '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return response.status(401).json({ error: 'unauthorized' });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const authUser = authData?.user;
  const isAdmin = String(authUser?.app_metadata?.role || '').toLowerCase() === 'admin';
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
    if (request.method === 'POST' && action === 'search') return await handleSearch(request, response);
    if (request.method === 'GET' && action === 'popular-searches') return await handlePopularSearches(request, response);
    if (request.method === 'GET' && action === 'stats') return await handleStats(request, response);
    if (request.method === 'GET' && action === 'operations') return await handleOperations(request, response);
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
