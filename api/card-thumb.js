const THUMBNAIL_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, immutable';

export default async function handler(request, response) {
  const key = String(request.query?.key || '').replace(/^\/+/, '');
  const isCardThumb = /^cards\/(KR|JP)\/[A-Za-z0-9_-]+\.webp$/.test(key);
  const isMarketImage = /^market\/listings\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.(webp|jpg|jpeg|png)$/.test(key);
  const isCommunityImage = /^community\/posts\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.(webp|jpg|jpeg|png)$/.test(key);
  if (!key || key.includes('..') || (!isCardThumb && !isMarketImage && !isCommunityImage)) {
    response.status(400).json({ error: 'invalid_key' });
    return;
  }

  const bucket = process.env?.CARD_THUMBNAILS;
  if (!bucket || typeof bucket.get !== 'function') {
    response.status(503).json({ error: 'thumbnail_bucket_unavailable' });
    return;
  }

  const object = await bucket.get(key);
  if (!object) {
    response.status(404).json({ error: 'thumbnail_not_found' });
    return;
  }

  response.setHeader('Content-Type', object.httpMetadata?.contentType || 'image/webp');
  response.setHeader('Cache-Control', THUMBNAIL_CACHE_CONTROL);
  response.setHeader('CDN-Cache-Control', THUMBNAIL_CACHE_CONTROL);
  response.status(200).send(object.body);
}
