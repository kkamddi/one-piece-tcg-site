import { supabaseAdmin } from '../lib/supabase-admin.js';

function getBearerToken(request) {
  const header = String(request.headers?.authorization || request.headers?.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) throw error;
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

async function fetchDeckLabReference(region) {
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

  const [
    { data: archetypes, error: archetypeError },
    { data: legalityRules, error: legalityError }
  ] = await Promise.all([
    supabaseAdmin
      .from('deck_archetypes')
      .select('id,environment_id,leader_id,slug,nickname,summary,play_style,difficulty,offense,defense,control,strengths,weaknesses,recommended_for,starter_based,budget_min_krw,budget_max_krw,source_url,is_published')
      .in('environment_id', environmentIds)
      .order('nickname', { ascending: true }),
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

  const { data: templates, error: templateError } = await supabaseAdmin
    .from('deck_templates')
    .select('id,archetype_id,template_type,title,description,source_url,is_published')
    .in('archetype_id', archetypeIds)
    .order('updated_at', { ascending: false });
  if (templateError) throw templateError;

  return {
    configured: true,
    environments: environments || [],
    leaders: leaders || [],
    archetypes: archetypes || [],
    templates: templates || [],
    legalityRules: legalityRules || []
  };
}

async function fetchTemplateVersion(versionId) {
  const { data: version, error: versionError } = await supabaseAdmin
    .from('deck_template_versions')
    .select('id,template_id,environment_id,version_label,notes,published_at,is_current,is_published')
    .eq('id', versionId)
    .maybeSingle();
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

export default async function handler(request, response) {
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: 'unauthorized' });
    if (!isAdminUser(user)) return response.status(403).json({ error: 'forbidden' });

    if (request.method !== 'GET') return response.status(405).json({ error: 'method_not_allowed' });

    const action = String(request.query?.action || 'reference').trim().toLowerCase();
    response.setHeader('Cache-Control', 'no-store, max-age=0');

    if (action === 'reference') {
      const payload = await fetchDeckLabReference(normalizeRegion(request.query?.region));
      return response.status(200).json(payload);
    }

    if (action === 'template-version') {
      const versionId = String(request.query?.versionId || '').trim();
      if (!versionId) return response.status(400).json({ error: 'invalid_request' });
      const item = await fetchTemplateVersion(versionId);
      if (!item) return response.status(404).json({ error: 'not_found' });
      return response.status(200).json({ item });
    }

    return response.status(400).json({ error: 'invalid_action' });
  } catch (error) {
    if (isMissingTableError(error)) {
      return response.status(200).json({
        configured: false,
        environments: [],
        leaders: [],
        archetypes: [],
        templates: [],
        legalityRules: []
      });
    }
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
