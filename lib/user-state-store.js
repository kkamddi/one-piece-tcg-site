import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabaseAdmin } from './supabase-admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackFile = path.resolve(__dirname, '../data/user-app-state.json');
const communityTable = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';

function fallbackKey(userId) {
  return `user:${userId}`;
}

function emptyState() {
  return { ownedCardIds: [], deckEntries: [], leaderCardId: null };
}

function normalizeState(input = {}) {
  return {
    ownedCardIds: Array.isArray(input.ownedCardIds) ? [...new Set(input.ownedCardIds.map((value) => String(value).trim()).filter(Boolean))] : [],
    deckEntries: Array.isArray(input.deckEntries)
      ? input.deckEntries
          .map((entry) => ({ id: String(entry?.id ?? '').trim(), count: Math.max(1, Number(entry?.count ?? 1) || 1) }))
          .filter((entry) => entry.id)
      : [],
    leaderCardId: input.leaderCardId ? String(input.leaderCardId) : null
  };
}

async function readFallbackStateMap() {
  try {
    const raw = await readFile(fallbackFile, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFallbackStateMap(map) {
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

  const { data, error } = await supabaseAdmin
    .from(communityTable)
    .select('content')
    .eq('board_id', '__user_state__')
    .eq('author_token', fallbackKey(userId))
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

  const next = normalizeState(state);
  if (!supabaseAdmin) {
    const map = await readFallbackStateMap();
    map[fallbackKey(userId)] = next;
    await writeFallbackStateMap(map);
    return next;
  }

  const authorToken = fallbackKey(userId);
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

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(communityTable)
    .select('id')
    .eq('board_id', '__user_state__')
    .eq('author_token', authorToken)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabaseAdmin.from(communityTable).update(payload).eq('id', existing.id);
    if (error) throw error;
    return next;
  }

  const { error } = await supabaseAdmin.from(communityTable).insert({
    id: `state-${userId}`,
    created_at: new Date().toISOString(),
    ...payload
  });
  if (error) throw error;
  return next;
}
