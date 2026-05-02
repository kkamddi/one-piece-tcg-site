import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');

const OFFICIAL_BASE = 'https://onepiece-cardgame.kr';
const CARD_LIST_URL = `${OFFICIAL_BASE}/cardlist.do`;
const USER_AGENT = 'one-piece-tcg-site-sync/0.2 (+internal tooling)';
const REQUEST_DELAY_MS = 1200;

const colorMap = {
  적색: 'Red',
  녹색: 'Green',
  청색: 'Blue',
  자색: 'Purple',
  흑색: 'Black',
  황색: 'Yellow',
  다색: 'Multicolor'
};

const categoryMap = {
  리더: 'LEADER',
  캐릭터: 'CHARACTER',
  스테이지: 'STAGE',
  이벤트: 'EVENT'
};

const attributeMap = {
  특수: 'Special',
  사격: 'Ranged',
  참격: 'Slash',
  타격: 'Strike',
  지혜: 'Wisdom',
  '': '-',
  '-': '-'
};

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function checkRobotsTxt() {
  const robotsUrl = `${OFFICIAL_BASE}/robots.txt`;
  try {
    const robots = await fetchText(robotsUrl);
    console.log('[sync] robots.txt fetched');
    return robots;
  } catch (error) {
    console.warn('[sync] robots.txt check failed:', error.message);
    return null;
  }
}

function decodeHtml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function extractField(block, className) {
  const regex = new RegExp(`<p class="${className}">([\\s\\S]*?)(?=<p class=|</button>)`);
  const match = block.match(regex);
  if (!match) return '';

  return decodeHtml(match[1])
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/ +/g, ' ')
    .trim();
}

function parseCardsFromHtml(html, sourceSeries, seriesMap, seen = new Set()) {
  const blocks = [...html.matchAll(/<button class="item">([\s\S]*?)<\/button>/g)].map((match) => match[1]);

  return blocks
    .map((block) => {
      const cardNo = extractField(block, 'cardNumber').trim();
      if (!cardNo || seen.has(cardNo)) return null;
      seen.add(cardNo);

      const prefixMatch = cardNo.match(/^([A-Z]+\d+)-/);
      const targetSeriesId = prefixMatch?.[1] ?? sourceSeries.id;
      const targetSeries = seriesMap.get(targetSeriesId) ?? sourceSeries;

      const imageMatch = block.match(/<img class="image" src="([^"]+)"/);
      const categoryKo = extractField(block, 'cardType');
      const colorKo = extractField(block, 'cardColor');
      const attributeKo = extractField(block, 'cardAttr') || '-';

      return {
        id: cardNo,
        cardNo,
        name: extractField(block, 'cardName'),
        nameEn: null,
        series: targetSeries.id,
        seriesName: targetSeries.koName,
        seriesNameEn: targetSeries.enName,
        rarity: extractField(block, 'rarity'),
        category: categoryMap[categoryKo] ?? categoryKo.toUpperCase(),
        categoryKo,
        color: colorMap[colorKo] ?? colorKo,
        colorKo,
        cost: extractField(block, 'life') || '-',
        power: extractField(block, 'power') || '-',
        counter: extractField(block, 'cardCounter') || '-',
        attribute: attributeMap[attributeKo] ?? attributeKo,
        attributeKo,
        type: extractField(block, 'cardPoint') || '-',
        effect: extractField(block, 'cardText') || '효과 정보 준비 중',
        imageUrl: imageMatch ? `${OFFICIAL_BASE}${imageMatch[1]}` : null,
        officialUrl: `${CARD_LIST_URL}?freewords=${encodeURIComponent(cardNo)}&search=true`,
        marketPrice: null
      };
    })
    .filter(Boolean);
}

function getLastPageIndex(html) {
  const matches = [...html.matchAll(/page=(\d+)/g)].map((match) => Number(match[1]));
  if (!matches.length) return 0;
  return Math.max(...matches.filter((value) => Number.isFinite(value)));
}

async function fetchSeriesCards(series, seriesMap) {
  console.log(`[sync] fetch series ${series.id}`);
  const seen = new Set();
  const firstUrl = `${CARD_LIST_URL}?page=0&size=20&series=${encodeURIComponent(series.queryLabel)}&search=true`;
  const firstHtml = await fetchText(firstUrl);
  await delay(REQUEST_DELAY_MS);

  const lastPageIndex = getLastPageIndex(firstHtml);
  const cards = parseCardsFromHtml(firstHtml, series, seriesMap, seen);

  for (let page = 1; page <= lastPageIndex; page += 1) {
    const pageUrl = `${CARD_LIST_URL}?page=${page}&size=20&series=${encodeURIComponent(series.queryLabel)}&search=true`;
    const html = await fetchText(pageUrl);
    await delay(REQUEST_DELAY_MS);
    cards.push(...parseCardsFromHtml(html, series, seriesMap, seen));
  }

  return cards;
}

async function main() {
  console.log('[sync] starting official card sync');
  await checkRobotsTxt();

  const series = await readJson(seriesPath);
  const seriesMap = new Map(series.map((item) => [item.id, item]));
  const collectedCards = [];
  const uniqueCards = new Map();

  for (const item of series) {
    if (!item.queryLabel) continue;
    try {
      const cards = await fetchSeriesCards(item, seriesMap);
      collectedCards.push(...cards);
      console.log(`[sync] ${item.id}: ${cards.length} cards`);
    } catch (error) {
      console.warn(`[sync] failed for ${item.id}:`, error.message);
    }
  }

  for (const card of collectedCards) {
    uniqueCards.set(card.cardNo, card);
  }

  const finalCards = [...uniqueCards.values()];

  await mkdir(path.dirname(cardsPath), { recursive: true });
  await writeFile(cardsPath, `${JSON.stringify(finalCards, null, 2)}\n`, 'utf8');
  console.log(`[sync] wrote ${finalCards.length} cards`);
}

main().catch((error) => {
  console.error('[sync] fatal:', error);
  process.exitCode = 1;
});
