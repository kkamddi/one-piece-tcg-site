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
const KR_PRODUCTS_URL = `${KR_OFFICIAL_BASE}/products.do`;
const KR_EVENTS_URL = `${KR_OFFICIAL_BASE}/events.do`;
const JP_PRODUCTS_URL = `${JP_OFFICIAL_BASE}/products/`;
const JP_EVENTS_URL = `${JP_OFFICIAL_BASE}/events/index.php`;
const JP_PAST_EVENTS_URL = `${JP_OFFICIAL_BASE}/events/list_end.php`;
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

function getLastQueryPage(html) {
  const pages = [...String(html || '').matchAll(/[?&]page=(\d+)/g)].map((match) => Number(match[1]));
  return pages.length ? Math.max(...pages) : 0;
}

async function fetchPagedHtml(firstHtml, startPage, buildUrl) {
  const lastPage = getLastQueryPage(firstHtml);
  if (lastPage < startPage) return [firstHtml];
  const remaining = await Promise.all(
    Array.from({ length: lastPage - startPage + 1 }, (_, index) => fetchText(buildUrl(startPage + index)))
  );
  return [firstHtml, ...remaining];
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

function stripHtml(value) {
  return decodeHtml(String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' '));
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

function toIsoDate(year, month, day) {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) return '';
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function lastDayOfMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function parseOfficialDateRange(value) {
  const label = stripHtml(value).replaceAll('〜', '～');
  const start = label.match(/(\d{4})\s*(?:[.\/-]|년|年)\s*(\d{1,2})\s*(?:[.\/-]|월|月)(?:\s*(\d{1,2})\s*(?:일|日)?)?/);
  if (!start) return null;

  const startYear = Number(start[1]);
  const startMonth = Number(start[2]);
  const startDay = Number(start[3] || 1);
  const date = toIsoDate(startYear, startMonth, startDay);
  if (!date) return null;

  let endDate = start[3] ? '' : toIsoDate(startYear, startMonth, lastDayOfMonth(startYear, startMonth));
  const separatorIndex = label.search(/[~～–—・]/);
  if (separatorIndex >= 0) {
    const endText = label.slice(separatorIndex + 1);
    const fullEnd = endText.match(/(\d{4})\s*(?:[.\/-]|년|年)\s*(\d{1,2})\s*(?:[.\/-]|월|月)(?:\s*(\d{1,2})\s*(?:일|日)?)?/);
    const monthDayEnd = endText.match(/(\d{1,2})\s*(?:[.\/-]|월|月)\s*(\d{1,2})\s*(?:일|日)?/);
    const dayEnd = endText.match(/(\d{1,2})\s*(?:일|日)/);
    if (fullEnd) {
      const endYear = Number(fullEnd[1]);
      const endMonth = Number(fullEnd[2]);
      const endDay = Number(fullEnd[3] || lastDayOfMonth(endYear, endMonth));
      endDate = toIsoDate(endYear, endMonth, endDay);
    } else if (monthDayEnd) {
      endDate = toIsoDate(startYear, Number(monthDayEnd[1]), Number(monthDayEnd[2]));
    } else if (dayEnd) {
      endDate = toIsoDate(startYear, startMonth, Number(dayEnd[1]));
    }
  }

  return {
    date,
    ...(endDate && endDate !== date ? { endDate } : {}),
    scheduleLabel: label,
    precision: start[3] ? 'day' : 'month'
  };
}

function parseOfficialDateRanges(value) {
  const label = stripHtml(value);
  const parts = label.split('／').map((part) => part.trim()).filter(Boolean);
  let contextYear = Number(label.match(/(\d{4})\s*(?:년|年|[.\/-])/)?.[1] || 0);
  let contextMonth = Number(label.match(/(?:\d{4}\s*(?:년|年|[.\/-])\s*)?(\d{1,2})\s*(?:월|月)/)?.[1] || 0);

  return parts.map((part) => {
    let candidate = part;
    if (!/\d{4}\s*(?:년|年|[.\/-])/.test(candidate) && contextYear) {
      candidate = /^\d{1,2}\s*(?:월|月)/.test(candidate)
        ? `${contextYear}年${candidate}`
        : `${contextYear}年${contextMonth}月${candidate}`;
    }
    const schedule = parseOfficialDateRange(candidate);
    if (schedule) {
      const [year, month] = schedule.date.split('-').map(Number);
      contextYear = year;
      contextMonth = month;
    }
    return schedule;
  }).filter(Boolean);
}

function buildCalendarItem({ id, locale, kind, category, title, schedule, url, imageUrl }) {
  return {
    id: `calendar-${locale.toLowerCase()}-${kind}-${schedule.date}-${encodeURIComponent(id)}`,
    locale,
    source: locale === 'JP' ? 'JP_OFFICIAL' : 'KR_OFFICIAL',
    category,
    title,
    date: schedule.date,
    scheduleDate: schedule.date,
    ...(schedule.endDate ? { endDate: schedule.endDate } : {}),
    scheduleLabel: schedule.scheduleLabel,
    calendarKind: kind,
    calendarOnly: true,
    url,
    ...(imageUrl ? { imageUrl } : {})
  };
}

function parseKrCalendarProducts(html) {
  return [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match, index) => {
    const block = match[1];
    const href = block.match(/<a href="([^"]+)" class="desc_wrap">/)?.[1] ?? '';
    const title = stripHtml(block.match(/<span class="tit">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const category = stripHtml(block.match(/<span class="cate">([\s\S]*?)<\/span>/)?.[1] ?? 'PRODUCTS');
    const schedule = parseOfficialDateRange(block.match(/<span class="date">([\s\S]*?)<\/span>/)?.[1] ?? '');
    if (!href || !title || !schedule || schedule.precision !== 'day') return null;
    const imageUrl = toAbsoluteKrImage(block.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? '');
    return buildCalendarItem({ id: href || `${index}-${title}`, locale: 'KR', kind: 'release', category, title, schedule, url: toAbsoluteUrl(href), imageUrl });
  }).filter(Boolean);
}

function parseKrCalendarEvents(html) {
  return [...html.matchAll(/<a href="([^"]+)" class="item">([\s\S]*?)<\/a>/g)].flatMap((match, index) => {
    const href = match[1];
    const block = match[2];
    const title = stripHtml(block.match(/<span class="tit"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '');
    const schedules = parseOfficialDateRanges(block.match(/<span class="date">([\s\S]*?)<\/span>/)?.[1] ?? '');
    if (!href || !title || !schedules.length) return [];
    const category = stripHtml(block.match(/<span class="cate02">([\s\S]*?)<\/span>/)?.[1] ?? 'EVENTS');
    const imageUrl = toAbsoluteKrImage(block.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? '');
    return schedules.map((schedule, scheduleIndex) => buildCalendarItem({ id: `${href}-${scheduleIndex || index}`, locale: 'KR', kind: 'event', category, title, schedule, url: toAbsoluteUrl(href), imageUrl }));
  });
}

function parseJpCalendarProducts(html) {
  return [...html.matchAll(/<li class="linkListColBox"[^>]*>([\s\S]*?)<\/li>/g)].map((match, index) => {
    const block = match[1];
    const href = block.match(/<a href="([^"]+)" class="linkListColItem">/)?.[1] ?? '';
    const title = stripHtml(block.match(/<h4 class="linkListColTitle">([\s\S]*?)<\/h4>/)?.[1] ?? '');
    const category = stripHtml(block.match(/<span class="linkListColCat">([\s\S]*?)<\/span>/)?.[1] ?? 'PRODUCTS');
    const schedule = parseOfficialDateRange(block.match(/<time[^>]+datetime="([^"]+)"/)?.[1] ?? '');
    if (!href || !title || !schedule || schedule.precision !== 'day') return null;
    const imageUrl = toAbsoluteJpImage(block.match(/(?:data-src|src)="([^"]+)"/)?.[1] ?? '');
    return buildCalendarItem({ id: href || `${index}-${title}`, locale: 'JP', kind: 'release', category, title, schedule, url: toAbsoluteJpUrl(href), imageUrl });
  }).filter(Boolean);
}

function parseJpCalendarEvents(html) {
  return [...html.matchAll(/<li class="eventsColBox[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].flatMap((match, index) => {
    const block = match[1];
    const href = block.match(/<a href="([^"]+)" class="linkCard"/)?.[1] ?? '';
    const title = stripHtml(block.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] ?? '');
    const schedules = parseOfficialDateRanges(block.match(/<p class="linkCardDate">([\s\S]*?)<\/p>/)?.[1] ?? '');
    if (!href || !title || !schedules.length) return [];
    const imageUrl = toAbsoluteJpImage(block.match(/data-src="([^"]+)"/)?.[1] ?? block.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? '');
    return schedules.map((schedule, scheduleIndex) => buildCalendarItem({ id: `${href}-${scheduleIndex || index}`, locale: 'JP', kind: 'event', category: 'EVENTS', title, schedule, url: toAbsoluteJpUrl(href), imageUrl }));
  });
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
  const [krHtml, jpHtml, krProductsHtml, krEventsHtml, jpProductsHtml, jpEventsHtml, jpPastEventsHtml] = await Promise.all([
    fetchText(KR_TOPICS_URL),
    fetchText(JP_TOPICS_URL),
    fetchText(KR_PRODUCTS_URL),
    fetchText(KR_EVENTS_URL),
    fetchText(JP_PRODUCTS_URL),
    fetchText(JP_EVENTS_URL),
    fetchText(JP_PAST_EVENTS_URL)
  ]);
  const krTopics = await enrichKrTopics(parseKrTopics(krHtml));
  const [krProductPages, krEventPages, jpProductPages, jpPastEventPages] = await Promise.all([
    fetchPagedHtml(krProductsHtml, 1, (page) => `${KR_PRODUCTS_URL}?extraValue=&page=${page}&size=12`),
    fetchPagedHtml(krEventsHtml, 1, (page) => `${KR_EVENTS_URL}?extraValue=&page=${page}&size=5`),
    fetchPagedHtml(jpProductsHtml, 2, (page) => `${JP_PRODUCTS_URL}?page=${page}`),
    fetchPagedHtml(jpPastEventsHtml, 2, (page) => `${JP_PAST_EVENTS_URL}?page=${page}`)
  ]);
  const calendarCandidates = [
    ...krProductPages.flatMap(parseKrCalendarProducts),
    ...krEventPages.flatMap(parseKrCalendarEvents),
    ...jpProductPages.flatMap(parseJpCalendarProducts),
    ...parseJpCalendarEvents(jpEventsHtml),
    ...jpPastEventPages.flatMap(parseJpCalendarEvents)
  ];
  const calendarItems = calendarCandidates.filter((item, index, items) => (
    items.findIndex((candidate) => candidate.id === item.id) === index
  ));
  const topics = [...krTopics, ...parseJpTopics(jpHtml), ...calendarItems]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  await mkdir(path.dirname(topicsPath), { recursive: true });
  await writeFile(topicsPath, `${JSON.stringify(topics, null, 2)}\n`, 'utf8');
  console.log(`[sync:topics] wrote ${topics.length} items (${calendarItems.length} calendar schedules)`);
}

main().catch((error) => {
  console.error('[sync:topics] fatal:', error);
  process.exitCode = 1;
});
