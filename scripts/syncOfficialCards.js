import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');

const OFFICIAL_BASE = 'https://en.onepiece-cardgame.com/cardlist/';
const USER_AGENT = 'one-piece-tcg-site-sync/0.1 (+internal tooling)';
const REQUEST_DELAY_MS = 1500;

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
  const robotsUrl = new URL('/robots.txt', OFFICIAL_BASE).toString();
  try {
    const robots = await fetchText(robotsUrl);
    console.log('[sync] robots.txt fetched');
    return robots;
  } catch (error) {
    console.warn('[sync] robots.txt check failed:', error.message);
    return null;
  }
}

function extractSeriesCandidates(html) {
  const ids = [...new Set([...html.matchAll(/\[(OP-\d+|ST-\d+|EB-\d+|PRB-\d+)\]/g)].map((match) => match[1]))];

  return ids.map((keyword) => ({
    id: keyword.replace('-', ''),
    officialSeriesKeyword: keyword,
    name: '',
    kind: 'UNKNOWN',
    description: '공식 사이트에서 동기화 예정'
  }));
}

function buildOfficialSearchUrl(cardNo) {
  return `https://en.onepiece-cardgame.com/cardlist/?freewords=${encodeURIComponent(cardNo)}&search=true`;
}

function normalizeCard(raw) {
  return {
    id: raw.cardNo,
    cardNo: raw.cardNo,
    name: raw.name,
    series: raw.series,
    seriesName: raw.seriesName,
    rarity: raw.rarity,
    category: raw.category,
    color: raw.color,
    cost: raw.cost,
    power: raw.power,
    counter: raw.counter,
    attribute: raw.attribute,
    type: raw.type,
    effect: raw.effect,
    imageUrl: raw.imageUrl ?? null,
    officialUrl: raw.officialUrl ?? buildOfficialSearchUrl(raw.cardNo),
    marketPrice: null
  };
}

async function fetchSeriesCards(series) {
  const url = `${OFFICIAL_BASE}?freewords=${encodeURIComponent(series.officialSeriesKeyword)}&search=true`;
  console.log(`[sync] fetch series ${series.id} -> ${url}`);
  await fetchText(url);
  await delay(REQUEST_DELAY_MS);

  // TODO: replace scaffold with real parser after selector mapping is finalized.
  const cards = [];

  if (cards.length === 0) {
    console.warn(`[sync] no parsed cards yet for ${series.id}; parser scaffold only`);
  }

  return cards.map(normalizeCard);
}

async function main() {
  console.log('[sync] starting official card sync scaffold');
  await checkRobotsTxt();

  const existingSeries = await readJson(seriesPath);
  const landingHtml = await fetchText(OFFICIAL_BASE);
  await delay(REQUEST_DELAY_MS);

  const discoveredSeries = extractSeriesCandidates(landingHtml);
  console.log(`[sync] discovered series candidates: ${discoveredSeries.length}`);

  const existingSeriesMap = new Map(existingSeries.map((item) => [item.officialSeriesKeyword, item]));
  const mergedSeries = discoveredSeries.map((item) => existingSeriesMap.get(item.officialSeriesKeyword) ?? item);
  const selectedSeries = mergedSeries.length ? mergedSeries : existingSeries;

  const collectedCards = [];
  for (const series of selectedSeries.slice(0, 3)) {
    try {
      const cards = await fetchSeriesCards(series);
      collectedCards.push(...cards);
    } catch (error) {
      console.warn(`[sync] failed for ${series.id}:`, error.message);
    }
  }

  await mkdir(path.dirname(cardsPath), { recursive: true });
  await writeFile(seriesPath, `${JSON.stringify(selectedSeries, null, 2)}\n`, 'utf8');

  if (collectedCards.length > 0) {
    await writeFile(cardsPath, `${JSON.stringify(collectedCards, null, 2)}\n`, 'utf8');
    console.log(`[sync] wrote ${collectedCards.length} cards`);
  } else {
    console.log('[sync] parser scaffold completed; existing cards.json kept as-is because no cards were parsed');
  }
}

main().catch((error) => {
  console.error('[sync] fatal:', error);
  process.exitCode = 1;
});
