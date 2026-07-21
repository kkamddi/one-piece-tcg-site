import {
  addCommunityComment,
  deleteCommunityPost,
  incrementCommunityPostView,
  listCommunityComments,
  toggleCommunityPostLike,
  updateCommunityPost
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function awardLikePoint(postId, likerUserId, event) {
  const recipientUserId = event?.authorToken || '';
  if (!event?.liked || !isUuid(recipientUserId) || recipientUserId === likerUserId) return false;
  const { data, error } = await supabaseAdmin.rpc('award_community_post_like_point', {
    p_recipient_user_id: recipientUserId,
    p_liker_user_id: likerUserId,
    p_post_id: String(postId)
  });
  if (error) throw error;
  return Boolean(data);
}

export default async function handler(request, response) {
  const { id, action } = request.query ?? {};

  if (!id) return response.status(400).json({ error: 'missing_id' });

  try {
    const user = await getAuthenticatedUser(request);
    const viewerToken = user?.id || '';

    if (request.method === 'PATCH') {
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      const input = { ...(request.body ?? {}) };
      if (Object.prototype.hasOwnProperty.call(input, 'pinned')) {
        if (!isAdminUser(user)) return response.status(403).json({ error: 'forbidden' });
        input.cardName = input.pinned ? '__pinned__' : '';
        delete input.pinned;
      }
      const updated = await updateCommunityPost(id, input, viewerToken, viewerToken);
      if (!updated) return response.status(404).json({ error: 'not_found' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(updated);
    }

    if (request.method === 'DELETE') {
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      const deleted = await deleteCommunityPost(id, viewerToken, viewerToken);
      if (!deleted) return response.status(404).json({ error: 'not_found' });
      return response.status(204).end();
    }

    if (request.method === 'GET' && action === 'comments') {
      const comments = await listCommunityComments(id, viewerToken);
      if (!comments) return response.status(404).json({ error: 'not_found' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json({ comments });
    }

    if (request.method === 'POST' && action === 'view') {
      const updated = await incrementCommunityPostView(id, viewerToken);
      if (!updated) return response.status(404).json({ error: 'not_found' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(updated);
    }

    if (request.method === 'POST' && action === 'like') {
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      const result = await toggleCommunityPostLike(id, user.id, { includeEvent: true });
      if (!result?.post) return response.status(404).json({ error: 'not_found' });
      try {
        await awardLikePoint(id, user.id, result.event);
      } catch (error) {
        console.error('community_like_point_failed', error?.message || error);
      }
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(result.post);
    }

    if (request.method === 'POST' && action === 'comment') {
      if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
      const content = String(request.body?.content ?? '').trim();
      if (!content) return response.status(400).json({ error: 'invalid_request' });
      const comment = await addCommunityComment(id, { nickname: getUserNickname(user), content }, user.id, user.id);
      if (!comment) return response.status(404).json({ error: 'not_found' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(201).json(comment);
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    if (error?.message === 'forbidden') return response.status(403).json({ error: 'forbidden' });
    if (error?.message === 'token_required') return response.status(400).json({ error: 'token_required' });
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
