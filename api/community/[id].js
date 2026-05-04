import {
  addCommunityComment,
  deleteCommunityPost,
  incrementCommunityPostView,
  listCommunityComments,
  toggleCommunityPostLike,
  updateCommunityPost
} from '../../lib/community-store.js';

export default async function handler(request, response) {
  const { id, action } = request.query ?? {};
  const viewerToken = request.headers['x-community-token'] ?? '';

  if (!id) return response.status(400).json({ error: 'missing_id' });

  try {
    if (request.method === 'PATCH') {
      const updated = await updateCommunityPost(id, request.body ?? {}, viewerToken, viewerToken);
      if (!updated) return response.status(404).json({ error: 'not_found' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(updated);
    }

    if (request.method === 'DELETE') {
      const deleted = await deleteCommunityPost(id, viewerToken);
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
      const updated = await toggleCommunityPostLike(id, viewerToken);
      if (!updated) return response.status(404).json({ error: 'not_found' });
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(updated);
    }

    if (request.method === 'POST' && action === 'comment') {
      const nickname = String(request.body?.nickname ?? '').trim();
      const content = String(request.body?.content ?? '').trim();
      if (!viewerToken || !nickname || !content) return response.status(400).json({ error: 'invalid_request' });
      const comment = await addCommunityComment(id, { nickname, content }, viewerToken, viewerToken);
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
