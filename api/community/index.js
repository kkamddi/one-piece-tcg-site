import {
  createCommunityPost,
  getCommunityStorageMode,
  listCommunityPosts
} from '../../lib/community-store.js';

export default async function handler(request, response) {
  const viewerToken = request.headers['x-community-token'] ?? '';

  try {
    if (request.method === 'GET') {
      const posts = await listCommunityPosts(viewerToken);
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json({ posts, storage: getCommunityStorageMode() });
    }

    if (request.method === 'POST') {
      const { boardId, nickname, title, cardName, imageUrl, content } = request.body ?? {};
      if (!viewerToken || !boardId || !nickname || !title || !content) {
        return response.status(400).json({ error: 'invalid_request' });
      }

      const post = await createCommunityPost({ boardId, nickname, title, cardName, imageUrl, content }, viewerToken, viewerToken);
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(201).json(post);
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}
