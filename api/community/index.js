import {
  createCommunityPost,
  getCommunityStorageMode,
  listCommunityPosts
} from '../../lib/community-store.js';
import { supabaseAdmin } from '../../lib/supabase-admin.js';

function getAuthToken(request) {
  const authHeader = String(request.headers.authorization ?? '');
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function getAuthenticatedUser(request) {
  const token = getAuthToken(request);
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user ?? null;
}

function getUserNickname(user) {
  const metadata = user?.user_metadata || {};
  return String(metadata.nickname || metadata.full_name || metadata.name || metadata.user_name || user?.email?.split('@')[0] || '회원').trim().slice(0, 40);
}

function isAdminUser(user) {
  return String(user?.user_metadata?.username || '').toLowerCase() === 'admin';
}

function decodeBase64(value) {
  const base64 = String(value || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) return null;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
  return null;
}

function getImageExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  return 'webp';
}

async function uploadCommunityImage(request, response, user) {
  if (!user?.id) return response.status(401).json({ error: 'unauthorized' });

  const bucket = process.env?.CARD_THUMBNAILS;
  if (!bucket || typeof bucket.put !== 'function') {
    return response.status(503).json({ error: 'image_bucket_unavailable' });
  }

  const mimeType = String(request.body?.mimeType || 'image/webp').trim();
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(mimeType)) {
    return response.status(400).json({ error: 'invalid_image_type' });
  }

  const bytes = decodeBase64(request.body?.data);
  if (!bytes?.byteLength) return response.status(400).json({ error: 'invalid_image' });
  if (bytes.byteLength > 900 * 1024) return response.status(413).json({ error: 'image_too_large' });

  const key = `community/posts/${user.id}/${Date.now()}-${crypto.randomUUID()}.${getImageExtension(mimeType)}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: mimeType } });
  return response.status(201).json({
    key,
    imageUrl: `/api/card-thumb?key=${encodeURIComponent(key)}`
  });
}

function getKoreanDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizePointStatus(row = {}) {
  return {
    checkedToday: Boolean(row.checked_today),
    totalPoints: Number(row.total_points || 0),
    streak: Number(row.streak || 0),
    checkinDate: row.checkin_date || getKoreanDate(),
    awarded: Boolean(row.awarded)
  };
}

async function getAttendanceStatus(userId) {
  const { data, error } = await supabaseAdmin.rpc('get_community_point_status', {
    p_user_id: userId,
    p_checkin_date: getKoreanDate()
  });
  if (error) throw error;
  return normalizePointStatus(Array.isArray(data) ? data[0] : data);
}

async function recordAttendance(userId) {
  const { data, error } = await supabaseAdmin.rpc('record_community_daily_checkin', {
    p_user_id: userId,
    p_checkin_date: getKoreanDate()
  });
  if (error) throw error;
  return normalizePointStatus(Array.isArray(data) ? data[0] : data);
}

async function getPointOverview(userId) {
  const [status, ledgerResult] = await Promise.all([
    getAttendanceStatus(userId),
    supabaseAdmin
      .from('community_point_ledger')
      .select('id,amount,reason,metadata,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
  ]);
  if (ledgerResult.error) throw ledgerResult.error;
  return {
    ...status,
    history: (ledgerResult.data || []).map((row) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      reason: row.reason,
      metadata: row.metadata || {},
      createdAt: row.created_at
    }))
  };
}

export default async function handler(request, response) {
  try {
    const user = await getAuthenticatedUser(request);
    const viewerToken = user?.id || '';
    const action = String(request.query?.action || '');

    if (action === 'attendance') {
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      if (request.method === 'GET') {
        response.setHeader('Cache-Control', 'no-store, max-age=0');
        return response.status(200).json(await getAttendanceStatus(user.id));
      }
      if (request.method === 'POST') {
        response.setHeader('Cache-Control', 'no-store, max-age=0');
        return response.status(200).json(await recordAttendance(user.id));
      }
      return response.status(405).json({ error: 'method_not_allowed' });
    }

    if (action === 'points') {
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      if (request.method !== 'GET') return response.status(405).json({ error: 'method_not_allowed' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(await getPointOverview(user.id));
    }

    if (request.method === 'GET') {
      const posts = await listCommunityPosts(viewerToken);
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json({ posts, storage: getCommunityStorageMode() });
    }

    if (request.method === 'POST' && request.query?.action === 'image') {
      return uploadCommunityImage(request, response, user);
    }

    if (request.method === 'POST') {
      const { boardId, title, cardName, imageUrl, content, pinned } = request.body ?? {};
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      if (!boardId || !title || !content) return response.status(400).json({ error: 'invalid_request' });
      const isEventBoard = String(boardId).trim() === 'event';
      if (isEventBoard && !isAdminUser(user)) return response.status(403).json({ error: 'event_board_read_only' });

      const resolvedCardName = isEventBoard ? (pinned ? '__pinned__' : '') : cardName;
      const post = await createCommunityPost({ boardId, nickname: getUserNickname(user), title, cardName: resolvedCardName, imageUrl, content }, user.id, user.id);
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(201).json(post);
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    const errorCode = error?.message || 'server_error';
    if (errorCode === 'intro_post_already_exists') {
      return response.status(409).json({ error: errorCode });
    }
    return response.status(500).json({ error: errorCode });
  }
}
