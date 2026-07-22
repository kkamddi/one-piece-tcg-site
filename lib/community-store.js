import { listAllAuthUsers } from './supabase-admin.js';

function cleanEnvValue(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

const supabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
const supabaseServiceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseTable = process.env.SUPABASE_COMMUNITY_TABLE || 'community_posts';
const hasSupabase = Boolean(supabaseUrl && supabaseServiceKey);
const publicSelect = 'id,board_id,nickname,title,card_name,image_url,content,likes,views,created_at,updated_at,author_token,liked_tokens';
const COMMENT_BOARD_PREFIX = '__comment__:';
const PINNED_EVENT_MARKER = '__pinned__';
const HIDDEN_EVENT_MARKER = '__hidden__';
const ACTIVE_BOARD_IDS = new Set(['intro', 'question', 'info', 'free', 'event']);
const MAX_POST_IMAGES = 5;

function normalizeImageUrls(value) {
  let candidates = value;
  if (!Array.isArray(candidates)) {
    const raw = String(value || '').trim();
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try {
        candidates = JSON.parse(raw);
      } catch {
        candidates = [raw];
      }
    } else {
      candidates = [raw];
    }
  }
  return [...new Set(candidates
    .map((url) => String(url || '').trim())
    .filter(Boolean))]
    .slice(0, MAX_POST_IMAGES);
}

function serializeImageUrls(imageUrls, fallbackImageUrl = '') {
  const urls = normalizeImageUrls(Array.isArray(imageUrls) ? imageUrls : fallbackImageUrl);
  if (urls.length <= 1) return urls[0] || '';
  return JSON.stringify(urls);
}

function isInternalBoardId(value) {
  return String(value || '').startsWith('__');
}

function normalizeBoardId(value) {
  const boardId = String(value || 'free');
  if (isInternalBoardId(boardId) || boardId === 'feedback') return boardId;
  return ACTIVE_BOARD_IDS.has(boardId) ? boardId : 'free';
}

function supabaseHeaders() {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json'
  };
}

function normalizeRecord(row = {}) {
  const imageUrls = normalizeImageUrls(row.image_urls ?? row.imageUrls ?? row.image_url ?? row.imageUrl);
  return {
    id: String(row.id),
    boardId: normalizeBoardId(row.board_id),
    nickname: row.nickname ?? '',
    title: row.title ?? '',
    cardName: row.card_name ?? '',
    imageUrl: imageUrls[0] || '',
    imageUrls,
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
    board_id: normalizeBoardId(post.boardId),
    nickname: post.nickname ?? '',
    title: post.title ?? '',
    card_name: post.cardName ?? '',
    image_url: serializeImageUrls(post.imageUrls, post.imageUrl),
    content: post.content ?? '',
    likes: Number(post.likes ?? 0),
    views: Number(post.views ?? 0),
    created_at: post.createdAt ?? new Date().toISOString(),
    updated_at: post.updatedAt ?? null,
    author_token: post.authorToken ?? '',
    liked_tokens: Array.isArray(post.likedTokens) ? post.likedTokens : []
  };
}

function toPublicPost(post, viewerToken = '', options = {}) {
  const viewerTokens = [viewerToken, viewerToken ? `user:${viewerToken}` : ''].filter(Boolean);
  const isFeedbackLocked = (post.boardId ?? 'free') === 'feedback';
  const isAdmin = Boolean(options.isAdmin);
  const canReadContent = !isFeedbackLocked || isAdmin;
  return {
    id: post.id,
    boardId: post.boardId,
    nickname: post.nickname,
    title: post.title,
    cardName: canReadContent && ![PINNED_EVENT_MARKER, HIDDEN_EVENT_MARKER].includes(post.cardName) ? post.cardName : '',
    imageUrl: canReadContent ? post.imageUrl : '',
    imageUrls: canReadContent ? normalizeImageUrls(post.imageUrls ?? post.imageUrl) : [],
    content: canReadContent ? post.content : '🔒 관리자만 확인할 수 있는 피드백입니다.',
    likes: post.likes,
    views: post.views,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    commentCount: Number(options.commentCount ?? 0),
    comments: Array.isArray(options.comments) ? options.comments : [],
    likedByMe: isFeedbackLocked ? false : viewerTokens.some((token) => post.likedTokens.includes(token)),
    ownedByMe: !isFeedbackLocked && viewerTokens.includes(post.authorToken),
    canEdit: !isFeedbackLocked && (isAdmin || viewerTokens.includes(post.authorToken)),
    pinned: post.boardId === 'event' && post.cardName === PINNED_EVENT_MARKER,
    hidden: post.boardId === 'event' && post.cardName === HIDDEN_EVENT_MARKER,
    locked: isFeedbackLocked,
    adminOnly: isFeedbackLocked,
    canInteract: !isFeedbackLocked,
    canReadContent,
    visibleToAdminOnly: Boolean(options.visibleToAdminOnly),
    authorGrade: options.authorGrade || ''
  };
}

function toPublicComment(post, viewerToken = '', options = {}) {
  const viewerTokens = [viewerToken, viewerToken ? `user:${viewerToken}` : ''].filter(Boolean);
  return {
    id: post.id,
    nickname: post.nickname,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    canEdit: viewerTokens.includes(post.authorToken),
    authorGrade: options.authorGrade || ''
  };
}

function normalizeAuthorId(value) {
  return String(value || '').replace(/^user:/, '').trim();
}

function getCommentBoardId(postId = '') {
  return `${COMMENT_BOARD_PREFIX}${String(postId).trim()}`;
}

function isCommentRecord(post = {}) {
  return String(post.boardId ?? '').startsWith(COMMENT_BOARD_PREFIX);
}

function getCommentCountMap(posts = []) {
  return posts.reduce((map, post) => {
    if (!isCommentRecord(post)) return map;
    const parentId = String(post.boardId).slice(COMMENT_BOARD_PREFIX.length);
    map.set(parentId, (map.get(parentId) ?? 0) + 1);
    return map;
  }, new Map());
}

function matchesAuthor(post, authorToken = '') {
  if (!authorToken) return false;
  return post.authorToken === authorToken || post.authorToken === `user:${authorToken}`;
}

async function readFallbackPosts() {
  try {
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { readFile } = await import('node:fs/promises');
    const fallbackFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/community-posts.json');
    const raw = await readFile(fallbackFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch {
    return [];
  }
}

async function writeFallbackPosts(posts) {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const fallbackFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/community-posts.json');
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

async function isAdminViewer(viewerToken = '') {
  const safeToken = String(viewerToken ?? '').trim();
  if (!safeToken || !hasSupabase) return false;
  try {
    const users = await listAllAuthUsers();
    return users.some((user) => user.id === safeToken && String(user.user_metadata?.username ?? '').toLowerCase() === 'admin');
  } catch {
    return false;
  }
}

export async function listCommunityPosts(viewerToken = '', options = {}) {
  const posts = await readAllPosts();
  const isAdmin = await isAdminViewer(viewerToken);
  const commentCountMap = getCommentCountMap(posts);
  const publicPosts = posts.filter((post) => !isInternalBoardId(post.boardId));
  const authorGradeMap = typeof options.resolveAuthorGrades === 'function'
    ? await options.resolveAuthorGrades([...new Set(publicPosts.map((post) => normalizeAuthorId(post.authorToken)).filter(Boolean))])
    : new Map();
  return posts
    .filter((post) => !isInternalBoardId(post.boardId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((post) => toPublicPost(post, viewerToken, {
      isAdmin,
      visibleToAdminOnly: (post.boardId ?? 'free') === 'feedback',
      commentCount: commentCountMap.get(post.id) ?? 0,
      authorGrade: authorGradeMap.get(normalizeAuthorId(post.authorToken)) || ''
    }));
}

export async function createCommunityPost(input, authorToken, viewerToken = authorToken) {
  const boardId = normalizeBoardId(input.boardId);
  const post = normalizeRecord({
    id: boardId === 'intro' ? `intro:${authorToken}` : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    board_id: boardId,
    nickname: input.nickname,
    title: input.title,
    card_name: input.cardName,
    image_url: serializeImageUrls(input.imageUrls, input.imageUrl),
    content: input.content,
    likes: 0,
    views: 0,
    created_at: new Date().toISOString(),
    author_token: authorToken,
    liked_tokens: []
  });

  if (post.boardId === 'intro') {
    const posts = await readAllPosts();
    if (posts.some((item) => item.boardId === 'intro' && matchesAuthor(item, authorToken))) {
      throw new Error('intro_post_already_exists');
    }
  }

  let saved;
  try {
    saved = hasSupabase ? await insertSupabasePost(post) : post;
  } catch (error) {
    const errorMessage = String(error?.message || '');
    if (post.boardId === 'intro' && /duplicate key|already exists/i.test(errorMessage)) {
      throw new Error('intro_post_already_exists');
    }
    throw error;
  }

  if (!hasSupabase) {
    const posts = await readFallbackPosts();
    posts.unshift(saved);
    await writeAllPosts(posts);
  }

  const isAdmin = await isAdminViewer(viewerToken);
  return toPublicPost(saved, viewerToken, { isAdmin });
}

export async function listCommunityComments(postId, viewerToken = '', options = {}) {
  const posts = await readAllPosts();
  const isAdmin = await isAdminViewer(viewerToken);
  const parent = posts.find((post) => post.id === postId && !isCommentRecord(post));
  if (!parent) return null;
  if ((parent.boardId ?? 'free') === 'feedback' && !isAdmin) throw new Error('forbidden');

  const comments = posts
    .filter((post) => post.boardId === getCommentBoardId(postId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const authorGradeMap = typeof options.resolveAuthorGrades === 'function'
    ? await options.resolveAuthorGrades([...new Set(comments.map((post) => normalizeAuthorId(post.authorToken)).filter(Boolean))])
    : new Map();
  return comments.map((post) => toPublicComment(post, viewerToken, {
    authorGrade: authorGradeMap.get(normalizeAuthorId(post.authorToken)) || ''
  }));
}

export async function addCommunityComment(postId, input, authorToken, viewerToken = authorToken) {
  if (!authorToken) throw new Error('token_required');

  const posts = await readAllPosts();
  const isAdmin = await isAdminViewer(viewerToken);
  const parent = posts.find((post) => post.id === postId && !isCommentRecord(post));
  if (!parent) return null;
  if ((parent.boardId ?? 'free') === 'feedback' && !isAdmin) throw new Error('forbidden');

  const comment = normalizeRecord({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    board_id: getCommentBoardId(postId),
    nickname: input.nickname,
    content: input.content,
    created_at: new Date().toISOString(),
    updated_at: null,
    author_token: authorToken,
    liked_tokens: []
  });

  const saved = hasSupabase ? await insertSupabasePost(comment) : (() => comment)();

  if (!hasSupabase) {
    posts.unshift(saved);
    await writeAllPosts(posts);
  }

  return toPublicComment(saved, viewerToken);
}

export async function updateCommunityPost(id, input, authorToken, viewerToken = authorToken) {
  const posts = await readAllPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return null;
  const isAdmin = await isAdminViewer(viewerToken);
  if (!matchesAuthor(target, authorToken) && !isAdmin) throw new Error('forbidden');

  const nextImageUrls = Object.prototype.hasOwnProperty.call(input, 'imageUrls')
    ? normalizeImageUrls(input.imageUrls)
    : Object.prototype.hasOwnProperty.call(input, 'imageUrl')
      ? normalizeImageUrls(input.imageUrl)
      : normalizeImageUrls(target.imageUrls ?? target.imageUrl);
  const next = {
    ...target,
    boardId: target.boardId,
    nickname: input.nickname ?? target.nickname,
    title: input.title ?? target.title,
    cardName: input.cardName ?? target.cardName,
    imageUrl: nextImageUrls[0] || '',
    imageUrls: nextImageUrls,
    content: input.content ?? target.content,
    updatedAt: new Date().toISOString()
  };
  const commentCount = posts.filter((post) => post.boardId === getCommentBoardId(id)).length;
  if (hasSupabase) {
    const saved = await patchSupabasePost(id, next);
    return toPublicPost(saved ?? next, viewerToken, { commentCount, isAdmin });
  }

  const updated = posts.map((post) => (post.id === id ? next : post));
  await writeAllPosts(updated);
  return toPublicPost(next, viewerToken, { commentCount, isAdmin });
}

export async function deleteCommunityPost(id, authorToken, viewerToken = authorToken) {
  const posts = await readAllPosts();
  const target = posts.find((post) => post.id === id);
  if (!target) return false;
  const isAdmin = await isAdminViewer(viewerToken);
  if (!matchesAuthor(target, authorToken) && !isAdmin) throw new Error('forbidden');

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
  const commentCount = posts.filter((post) => post.boardId === getCommentBoardId(id)).length;
  const isAdmin = await isAdminViewer(viewerToken);

  if (hasSupabase) {
    const saved = await patchSupabasePost(id, next);
    return toPublicPost(saved ?? next, viewerToken, { commentCount, isAdmin });
  }

  await writeAllPosts(posts.map((post) => (post.id === id ? next : post)));
  return toPublicPost(next, viewerToken, { commentCount, isAdmin });
}

export async function toggleCommunityPostLike(id, viewerToken, options = {}) {
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
  const commentCount = posts.filter((post) => post.boardId === getCommentBoardId(id)).length;
  const isAdmin = await isAdminViewer(viewerToken);

  const formatResult = (post) => {
    const publicPost = toPublicPost(post, viewerToken, { commentCount, isAdmin });
    if (!options.includeEvent) return publicPost;
    return {
      post: publicPost,
      event: {
        liked: !liked,
        authorToken: String(target.authorToken || '').replace(/^user:/, '')
      }
    };
  };

  if (hasSupabase) {
    const saved = await patchSupabasePost(id, next);
    return formatResult(saved ?? next);
  }

  await writeAllPosts(posts.map((post) => (post.id === id ? next : post)));
  return formatResult(next);
}

export function getCommunityStorageMode() {
  return hasSupabase ? 'supabase' : 'file';
}
