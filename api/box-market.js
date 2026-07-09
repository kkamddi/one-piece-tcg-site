import boxMarketItems from '../src/data/box-market-items.js';

const CACHE_SECONDS = 60 * 60 * 3;

function findFirstImage(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    return /^https:\/\/[^"'<>]+?\.(webp|png|jpg|jpeg)(\?[^"'<>]*)?$/i.test(value) ? value : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstImage(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const key of ['image', 'imageUrl', 'thumbnail', 'thumbnailUrl', 'url']) {
      const found = findFirstImage(value[key]);
      if (found) return found;
    }
    for (const item of Object.values(value)) {
      const found = findFirstImage(item);
      if (found) return found;
    }
  }
  return '';
}

function findPrice(value) {
  if (!value || typeof value !== 'object') return 0;
  for (const key of ['price', 'lowPrice', 'lowestPrice', 'minPrice', 'amount']) {
    const price = Number(value[key]);
    if (Number.isFinite(price) && price > 0) return price;
  }
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object') {
      const price = findPrice(item);
      if (price) return price;
    }
  }
  return 0;
}

function findListingCount(value) {
  if (!value || typeof value !== 'object') return 0;
  for (const key of ['listingCount', 'listingsCount', 'sellCount', 'availableCount', 'stockCount']) {
    const count = Number(value[key]);
    if (Number.isFinite(count) && count > 0) return count;
  }
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object') {
      const count = findListingCount(item);
      if (count) return count;
    }
  }
  return 0;
}

function normalizeReleaseDate(value) {
  if (!value) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const timestamp = value > 1000000000000 ? value : value * 1000;
    return new Date(timestamp).toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text) return '';
  const normalized = text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : text;
}

function findReleaseDate(value) {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReleaseDate(item);
      if (found) return found;
    }
    return '';
  }
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === 'releasedate'
      || normalizedKey === 'release_date'
      || normalizedKey === 'released_at'
      || normalizedKey === 'releasedat'
      || normalizedKey === 'release_date_text'
      || normalizedKey === 'releasedatetext'
      || normalizedKey === 'displayreleasedate'
      || normalizedKey === 'display_release_date'
      || normalizedKey === 'launchdate'
      || normalizedKey === 'salesstartdate'
      || normalizedKey === 'sale_start_date'
      || normalizedKey === 'datepublished'
    ) {
      const found = normalizeReleaseDate(item);
      if (found) return found;
    }
  }
  const label = String(value.label || value.name || value.title || value.key || '').toLowerCase();
  if (label.includes('release') && label.includes('date')) {
    for (const key of ['value', 'text', 'content', 'date']) {
      const found = normalizeReleaseDate(value[key]);
      if (found) return found;
    }
  }
  for (const item of Object.values(value)) {
    const found = findReleaseDate(item);
    if (found) return found;
  }
  return '';
}

function findReleaseDateInHtml(html) {
  const rawMatch = html.match(/Release Date[\s\S]{0,800}?([A-Z][a-z]{2,8}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4})/i);
  if (rawMatch?.[1]) return normalizeReleaseDate(rawMatch[1]);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const match = text.match(/Release Date\s+([A-Z][a-z]{2,8}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4})/i);
  return match?.[1] ? normalizeReleaseDate(match[1]) : '';
}

function parseJsonBlocks(html) {
  const blocks = [];
  const nextMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch?.[1]) blocks.push(nextMatch[1]);
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    if (match[1]) blocks.push(match[1]);
  }
  return blocks;
}

function parseProductHtml(html) {
  let imageUrl = '';
  let minPrice = 0;
  let listingCount = 0;
  let releaseDate = '';
  for (const block of parseJsonBlocks(html)) {
    try {
      const data = JSON.parse(block.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      imageUrl ||= findFirstImage(data);
      minPrice ||= findPrice(data);
      listingCount ||= findListingCount(data);
      releaseDate ||= findReleaseDate(data);
    } catch {
      // Ignore non-JSON script contents.
    }
  }
  releaseDate ||= findReleaseDateInHtml(html);
  imageUrl ||= html.match(/https:\/\/cdn\.snkrdunk\.com\/[^"'<>]+?\.(?:webp|png|jpg|jpeg)(?:\?[^"'<>]*)?/i)?.[0] || '';
  if (!minPrice) {
    const priceMatch = html.match(/(?:JPY|¥|price["':\s]+)([0-9][0-9,]*)/i);
    minPrice = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) || 0 : 0;
  }
  return { imageUrl, minPrice, listingCount, releaseDate };
}

async function fetchBox(item) {
  try {
    const response = await fetch(item.sourceUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 CardPoneBot/1.0'
      },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    });
    const html = await response.text();
    const parsed = response.ok ? parseProductHtml(html) : {};
    return {
      ...item,
      minPrice: parsed.minPrice || item.minPrice || 0,
      minPriceFormat: parsed.minPrice ? `$${Math.round(parsed.minPrice).toLocaleString('ko-KR')}` : '',
      listingCount: parsed.listingCount || item.listingCount || 0,
      previewImageUrl: parsed.imageUrl || item.previewImageUrl || '',
      releaseDate: parsed.releaseDate || item.releaseDate || ''
    };
  } catch {
    return item;
  }
}

export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const items = await Promise.all(boxMarketItems.map(fetchBox));
  response.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
  return response.status(200).json({ items });
}
