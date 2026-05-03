import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackFile = path.resolve(__dirname, '../data/community-posts.json');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseTable = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';
const hasSupabase = Boolean(supabaseUrl && supabaseServiceKey);
const publicSelect = 'id,board_id,nickname,title,card_name,image_url,content,likes,views,created_at,updated_at,author_token,liked_tokens';

function supabaseHeaders() {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json'
  };
}

function normalizeRecord(row = {}) {
  return {
    id: String(row.id),
    boardId: row.board_id ?? 'free',
    nickname: row.nickname ?? '',
    title: row.title ?? '',
    cardName: row.card_name ?? '',
    imageUrl: row.image_url ?? '',
    content: row.content ?? '',
    likes: Number(row.likes ?? 0),
    views: Number(row.views ?? 0),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? null,
    authorToken: row.author_token ?? '',
    likedTokens: Array.isArray(row.liked_tokens) ? row.liked_tokens : []
  };
}

function serializeRecord(post = {}) {
  return {
    id: String(post.id),
    board_id: post.boardId ?? 'free',
    nickname: post.nickname ?? '',
    title: post.title ?? '',
    card_name: post.cardName ?? '',
    image_url: post.imageUrl ?? '',
    content: post.content ?? '',
    likes: Number(post.likes ?? 0),
    views: Number(post.views ?? 0),
    created_at: post.createdAt ?? new Date().toISOString(),
    updated_at: post.updatedAt ?? null,
    author_token: post.authorToken ?? '',
    liked_tokens: Array.isArray(post.likedTokens) ? post.likedTokens : []
  };
}

function toPublicPost(post, viewerToken = '') {
  const viewerTokens = [viewerToken, viewerToken ? `user:${viewerToken}` : ''].filter(Boolean);
  return {
    id: post.id,
    boardId: post.boardId,
    nickname: post.nickname,
    title: post.title,
    cardName: post.cardName,
    imageUrl: post.imageUrl,
    content: post.content,
    likes: post.likes,
    views: post.views,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likedByMe: viewerTokens.some((token) => post.likedTokens.includes(token)),
    canEdit: viewerTokens.includes(post.authorToken)
  };
}

function matchesAuthor(post, authorToken = '') {
  if (!authorToken) return false;
  return post.authorToken === authorToken || post.authorToken === `user:${authorToken}`;
}

async function readFallbackPosts() {
  try {
    const raw = await readFile(fallbackFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch {
    return [];
  }
}

async function writeFallbackPosts(posts) {
  await mkdir(path.dirname(fallbackFile), { recursive: true });
  await writeFile(fallbackFile, JSON.stringify(posts.map(serializeRecord), null, 2), 'utf8');
}

async function supabaseFetch(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      ...supabaseHeaders(),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function readSupabasePosts() {
  const rows = await supabaseFetch(`${supabaseTable}?select=${encodeURIComponent(publicSelect)}&order=created_at.desc`);
  return Array.isArray(rows) ? rows.map(normalizeRecord) : [];
}

async function insertSupabasePost(post) {
  const rows = await supabaseFetch(`${supabaseTable}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([serializeRecord(post)])
  });
  return normalizeRecord(rows?.[0] ?? post);
}

async function patchSupabasePost(id, patch) {
  const rows = await supabaseFetch(`${supabaseTable}?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(publicSelect)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(serializeRecord({ id, ...patch }))
  });
  return rows?.[0] ? normalizeRecord(rows[0]) : null;
}

async function deleteSupabasePost(id) {
  await supabaseFetch(`${supabaseTable}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

async function readAllPosts() {
  return hasSupabase ? readSupabasePosts() : readFallbackPosts();
}

async function writeAllPosts(posts) {
  if (hasSupabase) throw new Error('Direct bulk write is not supported for Supabase mode');
  return writeFallbackPosts(posts);
}

export async function listCommunityPosts(viewerToken = '') {
  const posts = await readAllPosts();
  return posts
    .filter((post) => !String(post.boardId ?? '').startsWith('__'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((post) => toPublicPost(post, viewerToken));
}

export async function createCommunityPost(input, authorToken, viewerToken = authorToken) {
  const post = normalizeRecord({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    board_id: input.boardId,
    nickname: input.nickname,
    title: input.title,
    card_name: input.cardName,
    image_url: input.imageUrl,
    content: input.content,
    likes: 0,
    views: 0,
    created_at: new Date().toISOString(),
    author_token: authorToken,
    liked_tokens: []
  });

  const saved = hasSupabase ? await insertSupabasePost(post) : (() => post)();

  if (!hasSupabase) {
    const posts = await readFallbackPosts();
    posts.unshift(saved);
    await writeAllPosts(posts);
  }

  return toPublicPost(saved, viewerToken);
}

export async function updateCommunityPost(id, input, authorToken, viewerToken = authorToken) {
  const posts = await readAllPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return null;
  if (!matchesAuthor(target, authorToken)) throw new Error('forbidden');

  const next = {
    ...target,
    boardId: input.boardId ?? target.boardId,
    nickname: input.nickname ?? target.nickname,
    title: input.title ?? target.title,
    cardName: input.cardName ?? target.cardName,
    imageUrl: input.imageUrl ?? target.imageUrl,
    content: input.content ?? target.content,
    updatedAt: new Date().toISOString()
  };

  if (hasSupabase) {
    const saved = await patchSupabasePost(id, next);
    return toPublicPost(saved ?? next, viewerToken);
  }

  const updated = posts.map((post) => (post.id === id ? next : post));
  await writeAllPosts(updated);
  return toPublicPost(next, viewerToken);
}

export async function deleteCommunityPost(id, authorToken) {
  const posts = await readAllPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return false;
  if (!matchesAuthor(target, authorToken)) throw new Error('forbidden');

  if (hasSupabase) {
    await deleteSupabasePost(id);
    return true;
  }

  await writeAllPosts(posts.filter((post) => post.id !== id));
  return true;
}

export async function incrementCommunityPostView(id, viewerToken = '') {
  const posts = await readAllPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return null;

  const next = { ...target, views: Number(target.views ?? 0) + 1 };

  if (hasSupabase) {
    const saved = await patchSupabasePost(id, next);
    return toPublicPost(saved ?? next, viewerToken);
  }

  await writeAllPosts(posts.map((post) => (post.id === id ? next : post)));
  return toPublicPost(next, viewerToken);
}

export async function toggleCommunityPostLike(id, viewerToken) {
  if (!viewerToken) throw new Error('token_required');

  const posts = await readAllPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return null;

  const legacyToken = `user:${viewerToken}`;
  const activeToken = target.likedTokens.includes(viewerToken) ? viewerToken : target.likedTokens.includes(legacyToken) ? legacyToken : viewerToken;
  const liked = target.likedTokens.includes(activeToken);
  const likedTokens = liked
    ? target.likedTokens.filter((token) => token !== activeToken)
    : [...target.likedTokens.filter((token) => token !== legacyToken), viewerToken];
  const next = {
    ...target,
    likedTokens,
    likes: likedTokens.length
  };

  if (hasSupabase) {
    const saved = await patchSupabasePost(id, next);
    return toPublicPost(saved ?? next, viewerToken);
  }

  await writeAllPosts(posts.map((post) => (post.id === id ? next : post)));
  return toPublicPost(next, viewerToken);
}

export function getCommunityStorageMode() {
  return hasSupabase ? 'supabase' : 'file';
}
