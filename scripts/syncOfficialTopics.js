import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const topicsPath = path.join(rootDir, 'src/data/topics.json');

const KR_OFFICIAL_BASE = 'https://onepiece-cardgame.kr';
const JP_OFFICIAL_BASE = 'https://www.onepiece-cardgame.com';
const KR_TOPICS_URL = `${KR_OFFICIAL_BASE}/topics.do`;
const JP_TOPICS_URL = `${JP_OFFICIAL_BASE}/`;
const USER_AGENT = 'one-piece-tcg-site-sync/0.2 (+internal tooling)';

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();
}

function toAbsoluteUrl(href) {
  if (!href) return KR_TOPICS_URL;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${KR_OFFICIAL_BASE}/${href.replace(/^\//, '')}`;
}

function toAbsoluteJpUrl(href) {
  if (!href) return JP_OFFICIAL_BASE;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${JP_OFFICIAL_BASE}/${href.replace(/^\//, '')}`;
}

function toAbsoluteJpImage(src) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  return `${JP_OFFICIAL_BASE}/${src.replace(/^\//, '')}`;
}

function toAbsoluteKrImage(src) {
  if (!src) return '';
  if (/\/image\/dummy\//i.test(src)) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  return `${KR_OFFICIAL_BASE}/${src.replace(/^(?:\.\/|\/)+/, '')}`;
}

function extractMetaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
  return html.match(propertyFirst)?.[1] ?? html.match(contentFirst)?.[1] ?? '';
}

function extractKrTopicImage(html) {
  const metaImage =
    extractMetaContent(html, 'og:image') ||
    extractMetaContent(html, 'twitter:image');
  if (metaImage) return toAbsoluteKrImage(decodeHtml(metaImage));

  const contentBlock =
    html.match(/<div[^>]+class=["'][^"']*(?:view|content|board|bbs)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html;
  const inlineImage = contentBlock.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1] ?? '';
  return toAbsoluteKrImage(decodeHtml(inlineImage));
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
  if (!match) return text;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseKrTopics(html) {
  const items = [...html.matchAll(/<a href="([^"]+)" class="item">([\s\S]*?)<\/a>/g)];

  return items.slice(0, 8).map((match, index) => {
    const href = match[1];
    const block = match[2];
    const category = decodeHtml(block.match(/<span class="cate">([\s\S]*?)<\/span>/)?.[1] ?? 'NOTICE');
    const title = decodeHtml(block.match(/<span class="tit">([\s\S]*?)<\/span>/)?.[1] ?? '공지사항');
    const date = normalizeDate(decodeHtml(block.match(/<span class="date">([\s\S]*?)<\/span>/)?.[1] ?? ''));
    const imageUrl = toAbsoluteKrImage(block.match(/data-src="([^"]+)"/)?.[1] ?? block.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? '');

    return {
      id: `kr-${date}-${index}-${title}`,
      locale: 'KR',
      source: 'KR_OFFICIAL',
      category,
      title,
      date,
      url: toAbsoluteUrl(href),
      ...(imageUrl ? { imageUrl } : {})
    };
  });
}

async function enrichKrTopics(topics) {
  return Promise.all(topics.map(async (topic) => {
    if (topic.imageUrl || !topic.url) return topic;

    try {
      const html = await fetchText(topic.url);
      const imageUrl = extractKrTopicImage(html);
      return imageUrl ? { ...topic, imageUrl } : topic;
    } catch (error) {
      console.warn(`[sync:topics] failed to enrich KR topic image: ${topic.url} (${error.message})`);
      return topic;
    }
  }));
}

function parseJpTopics(html) {
  const section = html.match(/<section class="newsCol">([\s\S]*?)<\/section>/)?.[1] ?? html;
  const items = [...section.matchAll(/<li class="newsListItem">([\s\S]*?)<\/li>/g)];

  return items.slice(0, 8).map((match, index) => {
    const block = match[1];
    const href = block.match(/<a href="([^"]+)"/)?.[1] ?? '';
    const date = normalizeDate(block.match(/<time[^>]*datetime="([^"]+)"/)?.[1] ?? block.match(/<time[^>]*>([\s\S]*?)<\/time>/)?.[1] ?? '');
    const category = decodeHtml(block.match(/<div class="newscategory[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? 'NEWS');
    const title = decodeHtml(block.match(/<h3 class="newsTitle">([\s\S]*?)<\/h3>/)?.[1] ?? 'NEWS');
    const imageUrl = toAbsoluteJpImage(block.match(/data-src="([^"]+)"/)?.[1] ?? block.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? '');

    return {
      id: `jp-${date}-${index}-${title}`,
      locale: 'JP',
      source: 'JP_OFFICIAL',
      category,
      title,
      date,
      url: toAbsoluteJpUrl(href),
      imageUrl
    };
  }).filter((item) => item.title && item.url);
}

async function main() {
  console.log('[sync:topics] starting official topics sync');
  const [krHtml, jpHtml] = await Promise.all([
    fetchText(KR_TOPICS_URL),
    fetchText(JP_TOPICS_URL)
  ]);
  const krTopics = await enrichKrTopics(parseKrTopics(krHtml));
  const topics = [...krTopics, ...parseJpTopics(jpHtml)]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  await mkdir(path.dirname(topicsPath), { recursive: true });
  await writeFile(topicsPath, `${JSON.stringify(topics, null, 2)}\n`, 'utf8');
  console.log(`[sync:topics] wrote ${topics.length} topics`);
}

main().catch((error) => {
  console.error('[sync:topics] fatal:', error);
  process.exitCode = 1;
});
