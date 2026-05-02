import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const topicsPath = path.join(rootDir, 'src/data/topics.json');

const OFFICIAL_BASE = 'https://onepiece-cardgame.kr';
const TOPICS_URL = `${OFFICIAL_BASE}/topics.do`;
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
  if (!href) return TOPICS_URL;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${OFFICIAL_BASE}/${href.replace(/^\//, '')}`;
}

function parseTopics(html) {
  const items = [...html.matchAll(/<a href="([^"]+)" class="item">([\s\S]*?)<\/a>/g)];

  return items.slice(0, 4).map((match, index) => {
    const href = match[1];
    const block = match[2];
    const category = decodeHtml(block.match(/<span class="cate">([\s\S]*?)<\/span>/)?.[1] ?? 'NOTICE');
    const title = decodeHtml(block.match(/<span class="tit">([\s\S]*?)<\/span>/)?.[1] ?? '공지사항');
    const date = decodeHtml(block.match(/<span class="date">([\s\S]*?)<\/span>/)?.[1] ?? '');

    return {
      id: `${date}-${index}-${title}`,
      category,
      title,
      date,
      url: toAbsoluteUrl(href)
    };
  });
}

async function main() {
  console.log('[sync:topics] starting official topics sync');
  const html = await fetchText(TOPICS_URL);
  const topics = parseTopics(html);
  await mkdir(path.dirname(topicsPath), { recursive: true });
  await writeFile(topicsPath, `${JSON.stringify(topics, null, 2)}\n`, 'utf8');
  console.log(`[sync:topics] wrote ${topics.length} topics`);
}

main().catch((error) => {
  console.error('[sync:topics] fatal:', error);
  process.exitCode = 1;
});
