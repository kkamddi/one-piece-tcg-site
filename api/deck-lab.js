import { supabaseAdmin } from '../lib/supabase-admin.js';

function getBearerToken(request) {
  const header = String(request.headers?.authorization || request.headers?.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

function isAdminUser(user) {
  return user?.app_metadata?.role === 'admin' || user?.app_metadata?.is_admin === true;
}

function isMissingTableError(error) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(String(error?.message || ''));
}

function normalizeRegion(value) {
  const region = String(value || 'KR').trim().toUpperCase();
  return ['KR', 'JP', 'EN'].includes(region) ? region : 'KR';
}

function normalizeCardNo(value) {
  return String(value || '').trim().replace(/_p\d+$/i, '').slice(0, 80);
}

function getUserNickname(user) {
  const metadata = user?.user_metadata || {};
  return String(metadata.nickname || metadata.username || metadata.name || 'Card Pone 유저')
    .trim()
    .slice(0, 40);
}

async function fetchDeckLabReference(region, includeDrafts) {
  const { data: environments, error: environmentError } = await supabaseAdmin
    .from('deck_game_environments')
    .select('id,environment_key,region,format,name,rules_version,effective_from,effective_to,notes,is_active')
    .eq('region', region)
    .eq('is_active', true)
    .order('effective_from', { ascending: false, nullsFirst: false });
  if (environmentError) throw environmentError;

  const { data: leaders, error: leaderError } = await supabaseAdmin
    .from('deck_leaders')
    .select('id,region,card_id,card_no,card_name,colors,image_url,is_active')
    .eq('region', region)
    .eq('is_active', true)
    .order('card_no', { ascending: true });
  if (leaderError) throw leaderError;

  const environmentIds = (environments || []).map((item) => item.id);
  if (!environmentIds.length) {
    return {
      configured: true,
      environments: [],
      leaders: leaders || [],
      archetypes: [],
      templates: [],
      legalityRules: []
    };
  }

  let archetypeQuery = supabaseAdmin
    .from('deck_archetypes')
    .select('id,environment_id,leader_id,slug,nickname,summary,play_style,difficulty,offense,defense,control,strengths,weaknesses,recommended_for,starter_based,budget_min_krw,budget_max_krw,source_url,is_published')
    .in('environment_id', environmentIds)
    .order('nickname', { ascending: true });
  if (!includeDrafts) archetypeQuery = archetypeQuery.eq('is_published', true);

  const [
    { data: archetypes, error: archetypeError },
    { data: legalityRules, error: legalityError }
  ] = await Promise.all([
    archetypeQuery,
    supabaseAdmin
      .from('deck_legality_rules')
      .select('id,environment_id,card_no,restriction_type,max_copies,effective_from,effective_to,source_url,notes')
      .in('environment_id', environmentIds)
      .order('effective_from', { ascending: false })
  ]);
  if (archetypeError) throw archetypeError;
  if (legalityError) throw legalityError;

  const archetypeIds = (archetypes || []).map((item) => item.id);
  if (!archetypeIds.length) {
    return {
      configured: true,
      environments: environments || [],
      leaders: leaders || [],
      archetypes: [],
      templates: [],
      legalityRules: legalityRules || []
    };
  }

  let templateQuery = supabaseAdmin
    .from('deck_templates')
    .select('id,archetype_id,template_type,title,description,source_url,is_published')
    .in('archetype_id', archetypeIds)
    .order('updated_at', { ascending: false });
  if (!includeDrafts) templateQuery = templateQuery.eq('is_published', true);
  const { data: templates, error: templateError } = await templateQuery;
  if (templateError) throw templateError;

  const templateIds = (templates || []).map((item) => item.id);
  let versions = [];
  if (templateIds.length) {
    let versionQuery = supabaseAdmin
      .from('deck_template_versions')
      .select('id,template_id,version_label,is_current,is_published,published_at')
      .in('template_id', templateIds)
      .eq('is_current', true)
      .order('published_at', { ascending: false, nullsFirst: false });
    if (!includeDrafts) versionQuery = versionQuery.eq('is_published', true);
    const { data, error } = await versionQuery;
    if (error) throw error;
    versions = data || [];
  }
  const currentVersionByTemplate = new Map(versions.map((item) => [String(item.template_id), item.id]));

  return {
    configured: true,
    environments: environments || [],
    leaders: leaders || [],
    archetypes: archetypes || [],
    templates: (templates || []).map((item) => ({
      ...item,
      current_version_id: currentVersionByTemplate.get(String(item.id)) || null
    })),
    legalityRules: legalityRules || []
  };
}

async function fetchTemplateVersion(versionId, includeDrafts) {
  let versionQuery = supabaseAdmin
    .from('deck_template_versions')
    .select('id,template_id,environment_id,version_label,notes,published_at,is_current,is_published')
    .eq('id', versionId);
  if (!includeDrafts) versionQuery = versionQuery.eq('is_published', true);
  const { data: version, error: versionError } = await versionQuery.maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;

  const { data: cards, error: cardsError } = await supabaseAdmin
    .from('deck_template_cards')
    .select('card_id,card_no,card_name,quantity,role_tags,sort_order')
    .eq('version_id', versionId)
    .order('sort_order', { ascending: true })
    .order('card_no', { ascending: true });
  if (cardsError) throw cardsError;
  return { ...version, cards: cards || [] };
}

async function fetchPopularLeaders(region) {
  const { data, error } = await supabaseAdmin
    .from('deck_leader_usage')
    .select('card_no')
    .eq('region', region)
    .limit(10000);
  if (error) throw error;
  const counts = new Map();
  (data || []).forEach((item) => {
    const cardNo = normalizeCardNo(item.card_no);
    if (cardNo) counts.set(cardNo, Number(counts.get(cardNo) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([cardNo, count]) => ({ cardNo, count }))
    .sort((a, b) => b.count - a.count || a.cardNo.localeCompare(b.cardNo))
    .slice(0, 12);
}

async function fetchLeaderOverview(region, cardNo, user) {
  const [
    { data: usage, error: usageError },
    { data: reviews, error: reviewsError }
  ] = await Promise.all([
    supabaseAdmin
      .from('deck_leader_usage')
      .select('user_id')
      .eq('region', region)
      .eq('card_no', cardNo)
      .limit(10000),
    supabaseAdmin
      .from('deck_leader_reviews')
      .select('id,user_id,nickname,rating,content,created_at,updated_at')
      .eq('region', region)
      .eq('card_no', cardNo)
      .order('updated_at', { ascending: false })
      .limit(1000)
  ]);
  if (usageError) throw usageError;
  if (reviewsError) throw reviewsError;
  const items = reviews || [];
  const averageRating = items.length
    ? items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length
    : 0;
  return {
    configured: true,
    usageCount: (usage || []).length,
    reviewCount: items.length,
    averageRating,
    reviews: items.slice(0, 30).map((item) => ({
      id: item.id,
      nickname: item.nickname,
      rating: item.rating,
      content: item.content,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      mine: Boolean(user && item.user_id === user.id)
    }))
  };
}

async function upsertLeaderUsage(region, cardNo, user) {
  const { error } = await supabaseAdmin
    .from('deck_leader_usage')
    .upsert({
      user_id: user.id,
      region,
      card_no: cardNo,
      selected_at: new Date().toISOString()
    }, { onConflict: 'user_id,region' });
  if (error) throw error;
}

async function upsertLeaderReview(region, cardNo, user, body) {
  const rating = Number(body?.rating);
  const content = String(body?.content || '').trim().slice(0, 800);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !content) {
    const error = new Error('invalid_review');
    error.statusCode = 400;
    throw error;
  }
  const { error } = await supabaseAdmin
    .from('deck_leader_reviews')
    .upsert({
      user_id: user.id,
      region,
      card_no: cardNo,
      nickname: getUserNickname(user),
      rating,
      content,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,region,card_no' });
  if (error) throw error;
}

async function deleteLeaderReview(region, cardNo, user) {
  const { error } = await supabaseAdmin
    .from('deck_leader_reviews')
    .delete()
    .eq('user_id', user.id)
    .eq('region', region)
    .eq('card_no', cardNo);
  if (error) throw error;
}

export default async function handler(request, response) {
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  try {
    const user = await getAuthenticatedUser(request);
    const method = String(request.method || 'GET').toUpperCase();
    const action = String(request.query?.action || request.body?.action || 'reference').trim().toLowerCase();
    const region = normalizeRegion(request.query?.region || request.body?.region);
    const cardNo = normalizeCardNo(request.query?.cardNo || request.body?.cardNo);
    response.setHeader('Cache-Control', user ? 'no-store, max-age=0' : 'public, s-maxage=300, stale-while-revalidate=1800');

    if (method === 'GET' && action === 'reference') {
      return response.status(200).json(await fetchDeckLabReference(region, isAdminUser(user)));
    }
    if (method === 'GET' && action === 'template-version') {
      const versionId = String(request.query?.versionId || '').trim();
      if (!versionId) return response.status(400).json({ error: 'invalid_request' });
      const item = await fetchTemplateVersion(versionId, isAdminUser(user));
      if (!item) return response.status(404).json({ error: 'not_found' });
      return response.status(200).json({ item });
    }
    if (method === 'GET' && action === 'popular') {
      return response.status(200).json({ configured: true, items: await fetchPopularLeaders(region) });
    }
    if (method === 'GET' && action === 'leader-overview') {
      if (!cardNo) return response.status(400).json({ error: 'invalid_request' });
      return response.status(200).json(await fetchLeaderOverview(region, cardNo, user));
    }

    if (!user) return response.status(401).json({ error: 'unauthorized' });
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    if (method === 'POST' && action === 'select-leader') {
      if (!cardNo) return response.status(400).json({ error: 'invalid_request' });
      await upsertLeaderUsage(region, cardNo, user);
      return response.status(200).json({ ok: true });
    }
    if (method === 'POST' && action === 'review') {
      if (!cardNo) return response.status(400).json({ error: 'invalid_request' });
      await upsertLeaderReview(region, cardNo, user, request.body);
      return response.status(200).json(await fetchLeaderOverview(region, cardNo, user));
    }
    if (method === 'DELETE' && action === 'review') {
      if (!cardNo) return response.status(400).json({ error: 'invalid_request' });
      await deleteLeaderReview(region, cardNo, user);
      return response.status(200).json(await fetchLeaderOverview(region, cardNo, user));
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    if (isMissingTableError(error)) {
      if (String(request.method || 'GET').toUpperCase() !== 'GET') {
        return response.status(503).json({ error: 'deck_feedback_not_configured' });
      }
      return response.status(200).json({
        configured: false,
        environments: [],
        leaders: [],
        archetypes: [],
        templates: [],
        legalityRules: [],
        items: [],
        reviews: []
      });
    }
    return response.status(error?.statusCode || 500).json({ error: error?.message || 'server_error' });
  }
}
