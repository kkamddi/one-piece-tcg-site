import { supabaseAdmin } from './supabase-admin.js';

const communityTable = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';
const protectedStateFields = [
  'ownedCardIds',
  'wishlistCardIds',
  'ownedCardGrades',
  'ownedMarketItems',
  'valuationCardGrades',
  'valuationMarketItems',
  'deckEntries',
  'savedDecks'
];

function fallbackKey(userId) {
  return `user:${userId}`;
}

function stateRowId(userId) {
  return `state-${userId}`;
}

function emptyState() {
  return {
    ownedCardIds: [],
    wishlistCardIds: [],
    ownedCardGrades: {},
    ownedMarketItems: {},
    valuationCardGrades: {},
    valuationMarketItems: {},
    deckEntries: [],
    leaderCardId: null,
    savedDecks: [],
    activeDeckId: null,
    updateNoticeSeenId: null
  };
}

function normalizeStringArray(input) {
  return Array.isArray(input) ? [...new Set(input.map((value) => String(value).trim()).filter(Boolean))] : [];
}

function normalizeGradeMap(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    const safeKey = String(key ?? '').trim();
    const safeValue = String(value ?? '').trim().toLowerCase();
    return safeKey && (safeValue === 'a' || safeValue === 'psa10') ? [safeKey, safeValue] : null;
  }).filter(Boolean));
}

function normalizeMarketItems(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([key, item]) => {
    const safeKey = String(key ?? '').trim();
    const code = String(item?.code ?? '').trim().toUpperCase();
    const apparelId = Number(item?.apparelId ?? 0);
    if (!safeKey || !code || !Number.isFinite(apparelId) || apparelId <= 0) return null;
    return [safeKey, {
      code,
      apparelId,
      name: String(item?.name ?? '').trim(),
      imageUrl: String(item?.imageUrl ?? '').trim(),
      sourceUrl: String(item?.sourceUrl ?? '').trim(),
      minPrice: Number(item?.minPrice ?? 0) || 0
    }];
  }).filter(Boolean));
}

function normalizeState(input = {}) {
  return {
    ownedCardIds: normalizeStringArray(input.ownedCardIds),
    wishlistCardIds: normalizeStringArray(input.wishlistCardIds),
    ownedCardGrades: normalizeGradeMap(input.ownedCardGrades),
    ownedMarketItems: normalizeMarketItems(input.ownedMarketItems),
    valuationCardGrades: normalizeGradeMap(input.valuationCardGrades),
    valuationMarketItems: normalizeMarketItems(input.valuationMarketItems),
    deckEntries: Array.isArray(input.deckEntries)
      ? input.deckEntries
          .map((entry) => ({ id: String(entry?.id ?? '').trim(), count: Math.max(1, Number(entry?.count ?? 1) || 1) }))
          .filter((entry) => entry.id)
      : [],
    leaderCardId: input.leaderCardId ? String(input.leaderCardId) : null,
    savedDecks: Array.isArray(input.savedDecks)
      ? input.savedDecks
          .map((deck) => ({
            id: String(deck?.id ?? '').trim(),
            name: String(deck?.name ?? '').trim() || '내 덱',
            deckEntries: Array.isArray(deck?.deckEntries)
              ? deck.deckEntries
                  .map((entry) => ({ id: String(entry?.id ?? '').trim(), count: Math.max(1, Number(entry?.count ?? 1) || 1) }))
                  .filter((entry) => entry.id)
              : [],
            leaderCardId: deck?.leaderCardId ? String(deck.leaderCardId) : null,
            updatedAt: deck?.updatedAt ? String(deck.updatedAt) : null
          }))
          .filter((deck) => deck.id)
      : [],
    activeDeckId: input.activeDeckId ? String(input.activeDeckId) : null,
    updateNoticeSeenId: input.updateNoticeSeenId ? String(input.updateNoticeSeenId) : null
  };
}

function mergeMissingStateFields(existingState = {}, incomingState = {}) {
  const merged = { ...incomingState };
  for (const key of Object.keys(emptyState())) {
    if (!Object.prototype.hasOwnProperty.call(incomingState, key)) {
      merged[key] = existingState[key];
    }
  }
  return merged;
}

function isEmptyStateField(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return !value;
}

function protectNonEmptyStateFields(existingState = {}, incomingState = {}, rawState = {}) {
  const changedFields = new Set(Array.isArray(rawState.__changedFields) ? rawState.__changedFields : []);
  const protectedState = { ...incomingState };
  protectedStateFields.forEach((key) => {
    if (
      !changedFields.has(key) &&
      !isEmptyStateField(existingState[key]) &&
      isEmptyStateField(incomingState[key])
    ) {
      protectedState[key] = existingState[key];
    }
  });
  return protectedState;
}

function hasUserData(state = {}) {
  return normalizeStringArray(state.ownedCardIds).length > 0
    || normalizeStringArray(state.wishlistCardIds).length > 0
    || Object.keys(state.ownedCardGrades || {}).length > 0
    || Object.keys(state.ownedMarketItems || {}).length > 0
    || Object.keys(state.valuationCardGrades || {}).length > 0
    || Object.keys(state.valuationMarketItems || {}).length > 0
    || (Array.isArray(state.deckEntries) && state.deckEntries.length > 0)
    || (Array.isArray(state.savedDecks) && state.savedDecks.length > 0)
    || Boolean(state.leaderCardId)
    || Boolean(state.activeDeckId);
}

async function readFallbackStateMap() {
  try {
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { readFile } = await import('node:fs/promises');
    const fallbackFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/user-app-state.json');
    const raw = await readFile(fallbackFile, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFallbackStateMap(map) {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const fallbackFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/user-app-state.json');
  await mkdir(path.dirname(fallbackFile), { recursive: true });
  await writeFile(fallbackFile, JSON.stringify(map, null, 2), 'utf8');
}

export async function getUserAppState(userId) {
  if (!userId) return { hasState: false, ...emptyState() };

  if (!supabaseAdmin) {
    const map = await readFallbackStateMap();
    const stored = map[fallbackKey(userId)];
    return stored ? { hasState: true, ...normalizeState(stored) } : { hasState: false, ...emptyState() };
  }

  const id = stateRowId(userId);
  const { data: idRow, error: idError } = await supabaseAdmin
    .from(communityTable)
    .select('content')
    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (idError) throw idError;
  if (idRow?.content) {
    try {
      return { hasState: true, ...normalizeState(JSON.parse(idRow.content)) };
    } catch {
      return { hasState: true, ...emptyState() };
    }
  }

  const { data, error } = await supabaseAdmin
    .from(communityTable)
    .select('content')
    .eq('board_id', '__user_state__')
    .eq('author_token', fallbackKey(userId))
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.content) return { hasState: false, ...emptyState() };

  try {
    return { hasState: true, ...normalizeState(JSON.parse(data.content)) };
  } catch {
    return { hasState: true, ...emptyState() };
  }
}

export async function saveUserAppState(userId, state) {
  if (!userId) throw new Error('user_required');

  const existingState = await getUserAppState(userId);
  const mergedState = mergeMissingStateFields(existingState, state);
  const next = normalizeState(protectNonEmptyStateFields(existingState, mergedState, state));
  const hasExplicitFieldChange = Array.isArray(state?.__changedFields) && state.__changedFields.length > 0;
  if (hasUserData(existingState) && !hasUserData(next) && !state?.allowEmptyStateReset && !hasExplicitFieldChange) {
    throw new Error('refusing_to_overwrite_existing_state_with_empty_payload');
  }
  if (!supabaseAdmin) {
    const map = await readFallbackStateMap();
    map[fallbackKey(userId)] = next;
    await writeFallbackStateMap(map);
    return next;
  }

  const authorToken = fallbackKey(userId);
  const id = stateRowId(userId);
  const payload = {
    board_id: '__user_state__',
    nickname: 'state',
    title: 'user_state',
    card_name: '',
    image_url: '',
    content: JSON.stringify(next),
    likes: 0,
    views: 0,
    author_token: authorToken,
    liked_tokens: [],
    updated_at: new Date().toISOString()
  };

  const { data: existingById, error: existingByIdError } = await supabaseAdmin
    .from(communityTable)
    .select('id')
    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (existingByIdError) throw existingByIdError;

  if (existingById?.id) {
    const { error } = await supabaseAdmin.from(communityTable).update(payload).eq('id', existingById.id);
    if (error) throw error;
    return next;
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from(communityTable)
    .select('id')
    .eq('board_id', '__user_state__')
    .eq('author_token', authorToken)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingRows?.id) {
    const { error } = await supabaseAdmin.from(communityTable).update(payload).eq('id', existingRows.id);
    if (error) throw error;
    return next;
  }

  const { error } = await supabaseAdmin.from(communityTable).insert({
    id,
    created_at: new Date().toISOString(),
    ...payload
  });
  if (error) throw error;
  return next;
}
