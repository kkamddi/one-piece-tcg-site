import { supabaseAdmin } from '../lib/supabase-admin.js';
import { getUserAppState, saveUserAppState } from '../lib/user-state-store.js';

const HOLDINGS_TABLE = process.env.SUPABASE_PORTFOLIO_HOLDINGS_TABLE || 'portfolio_holdings';
const PURCHASES_TABLE = process.env.SUPABASE_PORTFOLIO_PURCHASES_TABLE || 'portfolio_purchases';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function safeString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeGrade(value) {
  return String(value || '').toLowerCase() === 'psa10' ? 'psa10' : 'a';
}

function normalizeMode(value) {
  const mode = String(value || '').toLowerCase();
  return ['manual', 'estimate', 'later'].includes(mode) ? mode : 'later';
}

function normalizeCurrency(value) {
  const currency = String(value || '').toUpperCase();
  return ['KRW', 'JPY', 'USD'].includes(currency) ? currency : 'KRW';
}

function normalizeDate(value) {
  const date = safeString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function normalizeSource(value) {
  const source = String(value || '').toLowerCase();
  return ['listing', 'trade'].includes(source) ? source : null;
}

function mapPurchase(row) {
  return {
    id: row.id,
    holdingId: row.holding_id,
    mode: row.mode,
    quantity: Number(row.quantity || 1),
    purchaseDate: row.purchase_date || '',
    originalCurrency: row.original_currency || 'KRW',
    originalUnitPrice: Number(row.original_unit_price || 0),
    unitPriceJpy: Number(row.unit_price_jpy || 0),
    referenceDate: row.reference_date || '',
    referenceSource: row.reference_source || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function mapHolding(row, purchases = []) {
  return {
    id: row.id,
    key: row.id,
    apparelId: Number(row.apparel_id || 0),
    cardId: row.card_id || '',
    code: row.code || '',
    name: row.name || row.code || '',
    setName: row.set_name || '',
    imageUrl: row.image_url || '',
    previewImageUrl: row.image_url || '',
    sourceUrl: row.source_url || '',
    grade: normalizeGrade(row.grade),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    purchases: purchases.map(mapPurchase)
  };
}

async function listPortfolio(userId) {
  const { data: holdings, error: holdingsError } = await supabaseAdmin
    .from(HOLDINGS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (holdingsError) throw holdingsError;

  const { data: purchases, error: purchasesError } = await supabaseAdmin
    .from(PURCHASES_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (purchasesError) throw purchasesError;

  const purchasesByHolding = new Map();
  for (const purchase of purchases || []) {
    const list = purchasesByHolding.get(purchase.holding_id) || [];
    list.push(purchase);
    purchasesByHolding.set(purchase.holding_id, list);
  }
  return (holdings || []).map((holding) => mapHolding(holding, purchasesByHolding.get(holding.id) || []));
}

function legacyGrade(key, state) {
  const direct = state?.valuationCardGrades?.[key];
  if (direct) return normalizeGrade(direct);
  return String(key || '').toLowerCase().endsWith('::psa10') ? 'psa10' : 'a';
}

function purchaseValues(lot = {}) {
  const mode = normalizeMode(lot.mode);
  return {
    mode,
    quantity: Math.min(9999, Math.max(1, Math.round(Number(lot.quantity || 1) || 1))),
    purchase_date: mode === 'later' ? null : normalizeDate(lot.purchaseDate),
    original_currency: normalizeCurrency(lot.originalCurrency),
    original_unit_price: Math.max(0, Number(lot.originalUnitPrice || 0) || 0),
    unit_price_jpy: Math.max(0, Math.round(Number(lot.unitPriceJpy || 0) || 0)),
    reference_date: normalizeDate(lot.referenceDate),
    reference_source: normalizeSource(lot.referenceSource)
  };
}

async function upsertHolding(userId, item, grade) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from(HOLDINGS_TABLE)
    .upsert({
      user_id: userId,
      apparel_id: Number(item.apparelId),
      card_id: safeString(item.cardId, 160) || null,
      code: safeString(item.code, 80).toUpperCase(),
      name: safeString(item.name, 240) || safeString(item.code, 80).toUpperCase(),
      set_name: safeString(item.setName, 300) || null,
      image_url: safeString(item.previewImageUrl || item.imageUrl, 1200) || null,
      source_url: safeString(item.sourceUrl, 1200) || null,
      grade: normalizeGrade(grade),
      updated_at: now
    }, { onConflict: 'user_id,apparel_id,grade' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function migrateLegacyPortfolio(userId) {
  const state = await getUserAppState(userId);
  if (state.portfolioMigratedAt) return;

  const legacyEntries = new Map([
    ...Object.entries(state.ownedMarketItems || {}),
    ...Object.entries(state.valuationMarketItems || {})
  ]);

  for (const [key, item] of legacyEntries.entries()) {
    const apparelId = Number(item?.apparelId || 0);
    const code = safeString(item?.code, 80).toUpperCase();
    if (!Number.isInteger(apparelId) || apparelId <= 0 || !code) continue;
    const holding = await upsertHolding(userId, item, legacyGrade(key, state));
    const { count, error: countError } = await supabaseAdmin
      .from(PURCHASES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('holding_id', holding.id);
    if (countError) throw countError;
    if (Number(count || 0) > 0) continue;

    const legacyLots = Array.isArray(state.portfolioLots?.[key]) && state.portfolioLots[key].length
      ? state.portfolioLots[key]
      : [{ mode: 'later', quantity: 1 }];
    const rows = legacyLots.map((lot) => ({
      holding_id: holding.id,
      user_id: userId,
      ...purchaseValues(lot)
    }));
    const { error: purchaseError } = await supabaseAdmin.from(PURCHASES_TABLE).insert(rows);
    if (purchaseError) throw purchaseError;
  }

  await saveUserAppState(userId, {
    ownedMarketItems: {},
    valuationCardGrades: {},
    valuationMarketItems: {},
    portfolioLots: {},
    portfolioMigratedAt: new Date().toISOString(),
    __changedFields: [
      'ownedMarketItems',
      'valuationCardGrades',
      'valuationMarketItems',
      'portfolioLots',
      'portfolioMigratedAt'
    ]
  });
}

async function savePortfolio(request, response, user) {
  const body = request.body || {};
  const item = body.holding || body.item || {};
  const purchase = body.purchase || body.lot || {};
  const apparelId = Number(item.apparelId || 0);
  const code = safeString(item.code, 80).toUpperCase();
  const grade = normalizeGrade(item.grade || body.grade);
  if (!Number.isInteger(apparelId) || apparelId <= 0 || !code) {
    return response.status(400).json({ error: 'invalid_portfolio_holding' });
  }

  const holding = await upsertHolding(user.id, item, grade);
  const values = {
    holding_id: holding.id,
    user_id: user.id,
    ...purchaseValues(purchase),
    updated_at: new Date().toISOString()
  };
  const purchaseId = safeString(purchase.id, 80);
  let savedPurchase;
  if (UUID_PATTERN.test(purchaseId)) {
    const { data, error } = await supabaseAdmin
      .from(PURCHASES_TABLE)
      .update(values)
      .eq('id', purchaseId)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    savedPurchase = data;
  }
  if (!savedPurchase) {
    const { data, error } = await supabaseAdmin
      .from(PURCHASES_TABLE)
      .insert(values)
      .select('*')
      .single();
    if (error) throw error;
    savedPurchase = data;
  }

  return response.status(200).json({ holding: mapHolding(holding, [savedPurchase]), holdings: await listPortfolio(user.id) });
}

async function deletePortfolio(request, response, user) {
  const purchaseId = safeString(request.query?.purchaseId, 80);
  const holdingId = safeString(request.query?.holdingId, 80);
  if (UUID_PATTERN.test(purchaseId)) {
    const { error } = await supabaseAdmin.from(PURCHASES_TABLE).delete().eq('id', purchaseId).eq('user_id', user.id);
    if (error) throw error;
  } else if (UUID_PATTERN.test(holdingId)) {
    const { error } = await supabaseAdmin.from(HOLDINGS_TABLE).delete().eq('id', holdingId).eq('user_id', user.id);
    if (error) throw error;
  } else {
    return response.status(400).json({ error: 'missing_portfolio_id' });
  }
  return response.status(200).json({ ok: true, holdings: await listPortfolio(user.id) });
}

export default async function handler(request, response) {
  response.setHeader?.('Cache-Control', 'no-store, private');
  response.setHeader?.('Vary', 'Authorization');
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
    if (request.method === 'GET') {
      await migrateLegacyPortfolio(user.id);
      return response.status(200).json({ holdings: await listPortfolio(user.id) });
    }
    if (request.method === 'POST' || request.method === 'PATCH') return await savePortfolio(request, response, user);
    if (request.method === 'DELETE') return await deletePortfolio(request, response, user);
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'portfolio_failed' });
  }
}
