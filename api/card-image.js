export default async function handler(request, response) {
  const { url } = request.query ?? {};

  if (!url || typeof url !== 'string') {
    response.status(400).json({ error: 'missing_url' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    response.status(400).json({ error: 'invalid_url' });
    return;
  }

  if (!/^https:$/.test(parsed.protocol)) {
    response.status(400).json({ error: 'invalid_protocol' });
    return;
  }

  if (!['www.onepiece-cardgame.com', 'onepiece-cardgame.kr'].includes(parsed.hostname)) {
    response.status(403).json({ error: 'forbidden_host' });
    return;
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'one-piece-tcg-site-image-proxy/1.0',
        referer: `${parsed.origin}/`
      }
    });

    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'upstream_failed' });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, immutable');
    response.setHeader('CDN-Cache-Control', 'public, max-age=2592000, stale-while-revalidate=604800');
    response.status(200).send(buffer);
  } catch (error) {
    response.status(502).json({ error: 'proxy_failed', detail: error?.message ?? 'unknown' });
  }
}
