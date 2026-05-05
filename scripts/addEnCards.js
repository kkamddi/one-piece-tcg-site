import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');

const EN_SITE = 'https://en.onepiece-cardgame.com';
const EN_CARD_LIST_URL = `${EN_SITE}/cardlist/`;
const USER_AGENT = 'one-piece-tcg-site-sync/0.5 (+internal tooling)';
const REQUEST_DELAY_MS = 350;

const colorMap = {
  Red: '적색',
  Green: '녹색',
  Blue: '청색',
  Purple: '자색',
  Black: '흑색',
  Yellow: '황색'
};

const attributeMap = {
  Special: '특수',
  Slash: '참격',
  Strike: '타격',
  Ranged: '사격',
  Wisdom: '지혜'
};

const categoryKoMap = {
  LEADER: '리더',
  CHARACTER: '캐릭터',
  EVENT: '이벤트',
  STAGE: '스테이지'
};

function decodeHtml(value = '') {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ');
}

function stripTags(value = '') {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeSeriesId(code = '') {
  const match = String(code).match(/^([A-Z]+)-(\d+)$/);
  if (!match) return code.replace(/[^A-Z0-9]/g, '').toUpperCase();
  return `${match[1]}${match[2].padStart(2, '0')}`;
}

function buildSeriesKey(locale, baseSeriesId) {
  return `${locale}-${baseSeriesId}`;
}

function buildCardKey(locale, cardNo, variantId = '') {
  return `${locale}::${variantId || cardNo}`;
}

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

  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  return response.text();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function parseEnSeriesOptions(html) {
  const options = [...html.matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)]
    .map((match) => ({ value: decodeHtml(match[1]).trim(), label: stripTags(match[2]) }))
    .filter((item) => item.value && item.value !== 'ALL');

  return options.map((option) => {
    const codeMatch = option.label.match(/\[([^\]]+)\]/);
    const baseSeriesId = codeMatch ? normalizeSeriesId(codeMatch[1]) : option.label.includes('PROMOTION') ? 'PROMO' : `ETC${option.value}`;
    const cleanedName = option.label.replace(/\[[^\]]+\]/g, '').replace(/^-+|-+$/g, '').trim();

    let kindKo = '기타';
    let kindEn = 'OTHER';
    if (option.label.includes('PREMIUM BOOSTER')) {
      kindKo = '프리미엄 부스터'; kindEn = 'PREMIUM BOOSTER';
    } else if (option.label.includes('EXTRA BOOSTER')) {
      kindKo = '엑스트라 부스터'; kindEn = 'EXTRA BOOSTER';
    } else if (option.label.includes('BOOSTER PACK')) {
      kindKo = '부스터 팩'; kindEn = 'BOOSTER PACK';
    } else if (option.label.includes('STARTER DECK EX')) {
      kindKo = '스타트 덱 EX'; kindEn = 'STARTER DECK EX';
    } else if (option.label.includes('STARTER DECK')) {
      kindKo = '스타트 덱'; kindEn = 'STARTER DECK';
    } else if (option.label.includes('ULTIMATE DECK')) {
      kindKo = '얼티밋 덱'; kindEn = 'ULTIMATE DECK';
    } else if (option.label.includes('PROMOTION')) {
      kindKo = '프로모션'; kindEn = 'PROMOTION';
    }

    return {
      id: buildSeriesKey('EN', baseSeriesId),
      locale: 'EN',
      baseSeriesId,
      koName: cleanedName,
      enName: cleanedName,
      kindKo,
      kindEn,
      queryLabel: option.label,
      officialSeriesKeyword: option.value,
      description: '영문 공식 카드 리스트 기준 카드 라인'
    };
  });
}

function normalizeEnColor(colorText = '') {
  return colorText.split('/').map((item) => colorMap[item.trim()] ?? item.trim()).filter(Boolean).join(', ');
}

function extractField(block, className) {
  const match = block.match(new RegExp(`<div class="${className}">([\\s\\S]*?)<\\/div>`));
  return match ? stripTags(match[1]) : '';
}

function parseEnCardsFromHtml(html, series, seriesMap) {
  const blocks = [...html.matchAll(/<dl class="modalCol" id="([^"]+)">([\s\S]*?)<\/dl>/g)];
  const cards = [];

  for (const [, modalId, block] of blocks) {
    const infoMatch = block.match(/<div class="infoCol">\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>/);
    if (!infoMatch) continue;

    const cardNo = stripTags(infoMatch[1]);
    const rarity = stripTags(infoMatch[2]);
    const category = stripTags(infoMatch[3]).toUpperCase();
    const basePrefixMatch = cardNo.match(/^([A-Z]+\d+)-/);
    const originBaseSeriesId = basePrefixMatch ? basePrefixMatch[1] : series.baseSeriesId;
    const originSeries = seriesMap.get(buildSeriesKey('EN', originBaseSeriesId)) ?? series;
    const imageMatch = block.match(/data-src="([^"]+card\/[^"?]+(?:\?[^\"]*)?)"/);
    const attributeMatch = block.match(/<div class="attribute">[\s\S]*?alt="([^"]*)"/);
    const nameMatch = block.match(/<div class="cardName">([\s\S]*?)<\/div>/);
    const normalizedAttribute = (attributeMap[stripTags(attributeMatch?.[1] ?? '')] ?? stripTags(attributeMatch?.[1] ?? '-')) || '-';

    cards.push({
      id: buildCardKey('EN', cardNo, modalId),
      locale: 'EN',
      cardNo,
      name: nameMatch ? stripTags(nameMatch[1]) : cardNo,
      nameEn: nameMatch ? stripTags(nameMatch[1]) : cardNo,
      series: series.id,
      baseSeriesId: series.baseSeriesId,
      seriesName: series.koName,
      seriesNameEn: series.enName,
      originSeries: originSeries.id,
      originBaseSeriesId,
      originSeriesName: originSeries.koName,
      originSeriesNameEn: originSeries.enName,
      rarity,
      category,
      categoryKo: categoryKoMap[category] ?? category,
      color: extractField(block, 'color') || '-',
      colorKo: normalizeEnColor(extractField(block, 'color')),
      cost: extractField(block, 'cost') || '-',
      power: extractField(block, 'power') || '-',
      counter: extractField(block, 'counter') || '-',
      attribute: stripTags(attributeMatch?.[1] ?? '-') || '-',
      attributeKo: normalizedAttribute,
      type: extractField(block, 'feature') || '-',
      effect: extractField(block, 'text') || '효과 정보 준비 중',
      imageUrl: imageMatch ? `${EN_SITE}${imageMatch[1].replace(/^\.\./, '')}` : null,
      officialUrl: `${EN_CARD_LIST_URL}?freewords=${encodeURIComponent(cardNo)}`,
      marketPrice: null
    });
  }

  return cards;
}

async function fetchEnglishSeriesAndCards() {
  const dropdownHtml = await fetchText(EN_CARD_LIST_URL);
  const parsedSeries = parseEnSeriesOptions(dropdownHtml);
  const filteredSeries = parsedSeries.filter((series) => /^OP\d+/.test(series.baseSeriesId)
    || /^(EB|PRB)\d+/.test(series.baseSeriesId)
    || /^ST\d+/.test(series.baseSeriesId)
    || series.baseSeriesId === 'PROMO');
  const seriesMap = new Map(filteredSeries.map((series) => [series.id, series]));
  const cards = [];

  for (const series of filteredSeries) {
    const url = `${EN_CARD_LIST_URL}?series=${encodeURIComponent(series.officialSeriesKeyword)}`;
    const html = await fetchText(url);
    const seriesCards = parseEnCardsFromHtml(html, series, seriesMap);
    cards.push(...seriesCards);
    console.log(`[add-en] EN ${series.baseSeriesId}: ${seriesCards.length} cards`);
    await delay(REQUEST_DELAY_MS);
  }

  return { series: filteredSeries, cards };
}

function sortSeries(items) {
  const localeOrder = { KR: 0, JP: 1, EN: 2 };
  const weight = (baseSeriesId) => {
    if (/^OP\d+/.test(baseSeriesId)) return 1;
    if (/^(EB|PRB)\d+/.test(baseSeriesId)) return 2;
    if (/^ST\d+/.test(baseSeriesId)) return 3;
    if (baseSeriesId === 'PROMO') return 4;
    return 9;
  };
  return [...items].sort((a, b) => {
    const localeDiff = (localeOrder[a.locale] ?? 9) - (localeOrder[b.locale] ?? 9);
    if (localeDiff !== 0) return localeDiff;
    const diff = weight(a.baseSeriesId) - weight(b.baseSeriesId);
    if (diff !== 0) return diff;
    return a.baseSeriesId.localeCompare(b.baseSeriesId, 'en', { numeric: true });
  });
}

async function main() {
  const existingSeries = await readJson(seriesPath);
  const existingCards = await readJson(cardsPath);
  const en = await fetchEnglishSeriesAndCards();

  const mergedSeries = sortSeries([...existingSeries.filter((item) => item.locale !== 'EN'), ...en.series]);
  const mergedCards = [...existingCards.filter((item) => item.locale !== 'EN'), ...en.cards];

  await writeFile(seriesPath, `${JSON.stringify(mergedSeries, null, 2)}\n`, 'utf8');
  await writeFile(cardsPath, `${JSON.stringify(mergedCards, null, 2)}\n`, 'utf8');
  console.log(`[add-en] wrote ${mergedSeries.length} series / ${mergedCards.length} cards`);
}

main().catch((error) => {
  console.error('[add-en] fatal:', error);
  process.exitCode = 1;
});
