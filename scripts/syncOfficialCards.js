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
const USER_AGENT = 'one-piece-tcg-site-sync/0.3 (+internal tooling)';
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

const manualSeriesMeta = {
  OP12: { enName: 'LEGACY OF THE MASTER', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP11: { enName: 'A FIST OF DIVINE SPEED', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP10: { enName: 'ROYAL BLOOD', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP09: { enName: 'EMPERORS IN THE NEW WORLD', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP08: { enName: 'TWO LEGENDS', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP07: { enName: '500 YEARS IN THE FUTURE', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP06: { enName: 'WINGS OF THE CAPTAIN', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP05: { enName: 'AWAKENING OF THE NEW ERA', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP04: { enName: 'KINGDOMS OF INTRIGUE', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP03: { enName: 'PILLARS OF STRENGTH', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP02: { enName: 'PARAMOUNT WAR', description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈' },
  OP01: { enName: 'ROMANCE DAWN', description: '공식 한글 카드 리스트 기준 첫 번째 메인 부스터 팩' },
  EB01: { enName: 'MEMORIAL COLLECTION', description: '엑스트라 부스터 계열 카드' },
  EB02: { enName: 'Anime 25th Collection', description: '엑스트라 부스터 계열 카드' },
  PRB02: { enName: 'ONE PIECE CARD THE BEST Vol.2', description: '패러렐/재수록 카드가 포함된 프리미엄 부스터' },
  PROMO: { koName: '프로모션', enName: 'PROMOTION', kindKo: '프로모션', kindEn: 'PROMOTION', description: '공식 한글 사이트 프로모션 카드 라인' }
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
  const regex = new RegExp(`<p class="${className}">([\\s\\S]*?)(?=<p class=|</button>|$)`);
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

function getLastPageIndex(html) {
  const matches = [...html.matchAll(/page=(\d+)/g)].map((match) => Number(match[1]));
  if (!matches.length) return 0;
  return Math.max(...matches.filter((value) => Number.isFinite(value)));
}

function parseDropdownOptions(html) {
  const options = [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<\n]*)/g)]
    .map((match) => ({ value: decodeHtml(match[1]).trim(), label: decodeHtml(match[2]).trim() }))
    .filter((item) => item.value && item.value !== 'all');

  const seen = new Set();
  return options.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}

function inferSeriesFromOption(option, existingMap) {
  if (option.value === '【프로모션】') {
    return {
      id: 'PROMO',
      koName: '프로모션',
      enName: manualSeriesMeta.PROMO.enName,
      kindKo: '프로모션',
      kindEn: 'PROMOTION',
      queryLabel: option.value,
      officialSeriesKeyword: 'PROMO',
      description: manualSeriesMeta.PROMO.description
    };
  }

  const codeMatch = option.value.match(/\[([A-Z]+)K-(\d+)\]/);
  if (!codeMatch) return null;

  const [, prefix, number] = codeMatch;
  const normalizedId = `${prefix}${number}`;
  const existing = existingMap.get(normalizedId);
  const rawName = option.label.replace(/^\[[^\]]+\]\s*/, '').trim();

  const meta = manualSeriesMeta[normalizedId] ?? {};
  const kindKo = option.label.includes('프리미엄')
    ? '프리미엄 부스터'
    : option.label.includes('엑스트라')
      ? '엑스트라 부스터'
      : option.label.includes('스타트 덱') || option.label.includes('얼티밋 덱') || option.label.includes('울트라 덱')
        ? option.label.includes('얼티밋 덱') ? '얼티밋 덱' : option.label.includes('울트라 덱') ? '울트라 덱' : '스타트 덱'
        : '부스터 팩';

  const kindEn = kindKo === '프리미엄 부스터'
    ? 'PREMIUM BOOSTER'
    : kindKo === '엑스트라 부스터'
      ? 'EXTRA BOOSTER'
      : kindKo === '얼티밋 덱'
        ? 'ULTIMATE DECK'
        : kindKo === '울트라 덱'
          ? 'ULTRA DECK'
          : kindKo === '스타트 덱'
            ? 'STARTER DECK'
            : 'BOOSTER PACK';

  return {
    id: normalizedId,
    koName: existing?.koName || meta.koName || rawName,
    enName: existing?.enName || meta.enName || rawName,
    kindKo: existing?.kindKo || kindKo,
    kindEn: existing?.kindEn || kindEn,
    queryLabel: option.value,
    officialSeriesKeyword: existing?.officialSeriesKeyword || `${prefix}-${number}`,
    description: existing?.description || meta.description || '공식 한글 카드 리스트 기준 카드 라인'
  };
}

function parseCardsFromHtml(html, sourceSeries, seriesMap, seen = new Set()) {
  const blocks = [...html.matchAll(/<button class="item">([\s\S]*?)<\/button>/g)].map((match) => match[1]);

  return blocks
    .map((block) => {
      const cardNo = extractField(block, 'cardNumber').trim();
      if (!cardNo || seen.has(cardNo)) return null;
      seen.add(cardNo);

      const prefixMatch = cardNo.match(/^([A-Z]+\d+)-/);
      const originSeriesId = prefixMatch?.[1] ?? sourceSeries.id;
      const originSeries = seriesMap.get(originSeriesId) ?? sourceSeries;

      const imageMatch = block.match(/<img class="image" src="([^"]+)"/);
      const categoryKo = extractField(block, 'cardType');
      const colorKo = extractField(block, 'cardColor');
      const attributeKo = extractField(block, 'cardAttr') || '-';

      return {
        id: `${sourceSeries.id}::${cardNo}`,
        cardNo,
        name: extractField(block, 'cardName'),
        nameEn: null,
        series: sourceSeries.id,
        seriesName: sourceSeries.koName,
        seriesNameEn: sourceSeries.enName,
        originSeries: originSeries.id,
        originSeriesName: originSeries.koName,
        originSeriesNameEn: originSeries.enName,
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

function sortSeries(series) {
  const weight = (item) => {
    if (/^OP\d+/.test(item.id)) return 1;
    if (/^(EB|PRB)\d+/.test(item.id)) return 2;
    if (/^ST\d+/.test(item.id)) return 3;
    if (item.id === 'PROMO') return 4;
    return 9;
  };

  return [...series].sort((a, b) => {
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}

async function main() {
  console.log('[sync] starting official card sync');
  await checkRobotsTxt();

  const existingSeries = await readJson(seriesPath);
  const existingMap = new Map(existingSeries.map((item) => [item.id, item]));
  const dropdownHtml = await fetchText(CARD_LIST_URL);
  const options = parseDropdownOptions(dropdownHtml);
  const parsedSeries = options.map((option) => inferSeriesFromOption(option, existingMap)).filter(Boolean);
  const finalSeries = sortSeries(parsedSeries);
  const seriesMap = new Map(finalSeries.map((item) => [item.id, item]));

  const collectedCards = [];
  const uniqueCards = new Map();

  for (const item of finalSeries) {
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
    uniqueCards.set(card.id, card);
  }

  const finalCards = [...uniqueCards.values()];

  await mkdir(path.dirname(cardsPath), { recursive: true });
  await writeFile(seriesPath, `${JSON.stringify(finalSeries, null, 2)}\n`, 'utf8');
  await writeFile(cardsPath, `${JSON.stringify(finalCards, null, 2)}\n`, 'utf8');
  console.log(`[sync] wrote ${finalSeries.length} series / ${finalCards.length} cards`);
}

main().catch((error) => {
  console.error('[sync] fatal:', error);
  process.exitCode = 1;
});
