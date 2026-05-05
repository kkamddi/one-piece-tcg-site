import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');

const KR_SITE = 'https://onepiece-cardgame.kr';
const JP_SITE = 'https://www.onepiece-cardgame.com';
const JP_CARD_LIST_URL = `${JP_SITE}/cardlist/`;
const USER_AGENT = 'one-piece-tcg-site-sync/0.4 (+internal tooling)';
const REQUEST_DELAY_MS = 350;

const jpColorMap = {
  '赤': '적색',
  '緑': '녹색',
  '青': '청색',
  '紫': '자색',
  '黒': '흑색',
  '黃': '황색',
  '黄': '황색'
};

const jpAttributeMap = {
  '特': '특수',
  '斬': '참격',
  '打': '타격',
  '射': '사격',
  '知': '지혜'
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

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function convertKrSeries(series) {
  const baseSeriesId = series.baseSeriesId ?? series.id;
  return {
    ...series,
    id: buildSeriesKey('KR', baseSeriesId),
    locale: 'KR',
    baseSeriesId
  };
}

function convertKrCard(card) {
  const baseSeriesId = card.baseSeriesId ?? card.series;
  const originBaseSeriesId = card.originBaseSeriesId ?? card.originSeries ?? baseSeriesId;
  return {
    ...card,
    id: buildCardKey('KR', card.cardNo, card.cardNo),
    locale: 'KR',
    baseSeriesId,
    originBaseSeriesId,
    series: buildSeriesKey('KR', baseSeriesId),
    originSeries: buildSeriesKey('KR', originBaseSeriesId)
  };
}

function parseJpSeriesOptions(html) {
  const options = [...html.matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)]
    .map((match) => ({ value: decodeHtml(match[1]).trim(), label: stripTags(match[2]) }))
    .filter((item) => item.value && item.value !== 'ALL');

  return options.map((option) => {
    const codeMatch = option.label.match(/【([A-Z]+-\d+)】/);
    const baseSeriesId = codeMatch ? normalizeSeriesId(codeMatch[1]) : option.label.includes('プロモーション') ? 'PROMO' : option.label.includes('ファミリーデッキ') ? 'FAMILY' : `ETC${option.value}`;
    const cleanedName = option.label.replace(/【[^】]+】/g, '').trim();

    let kindKo = '기타';
    let kindEn = 'OTHER';
    if (option.label.includes('プレミアムブースター')) {
      kindKo = '프리미엄 부스터'; kindEn = 'PREMIUM BOOSTER';
    } else if (option.label.includes('エクストラブースター')) {
      kindKo = '엑스트라 부스터'; kindEn = 'EXTRA BOOSTER';
    } else if (option.label.includes('ブースターパック')) {
      kindKo = '부스터 팩'; kindEn = 'BOOSTER PACK';
    } else if (option.label.includes('スタートデッキEX')) {
      kindKo = '스타트 덱 EX'; kindEn = 'STARTER DECK EX';
    } else if (option.label.includes('スタートデッキ')) {
      kindKo = '스타트 덱'; kindEn = 'STARTER DECK';
    } else if (option.label.includes('アルティメットデッキ')) {
      kindKo = '얼티밋 덱'; kindEn = 'ULTIMATE DECK';
    } else if (option.label.includes('プロモーション')) {
      kindKo = '프로모션'; kindEn = 'PROMOTION';
    } else if (option.label.includes('ファミリーデッキ')) {
      kindKo = '패밀리 덱'; kindEn = 'FAMILY DECK';
    }

    return {
      id: buildSeriesKey('JP', baseSeriesId),
      locale: 'JP',
      baseSeriesId,
      koName: cleanedName,
      enName: cleanedName,
      kindKo,
      kindEn,
      queryLabel: option.label,
      officialSeriesKeyword: option.value,
      description: '일본 공식 카드 리스트 기준 카드 라인'
    };
  });
}

function normalizeJpColor(colorText = '') {
  return colorText.split('/').map((item) => jpColorMap[item.trim()] ?? item.trim()).filter(Boolean).join(', ');
}

function extractJpField(block, className) {
  const match = block.match(new RegExp(`<div class="${className}">([\\s\\S]*?)<\\/div>`));
  return match ? stripTags(match[1]) : '';
}

function parseJpCardsFromHtml(html, series, seriesMap) {
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
    const originSeries = seriesMap.get(buildSeriesKey('JP', originBaseSeriesId)) ?? series;
    const imageMatch = block.match(/data-src="([^"]+card\/[^"?]+(?:\?[^\"]*)?)"/);
    const attributeMatch = block.match(/<div class="attribute">[\s\S]*?alt="([^"]*)"/);
    const nameMatch = block.match(/<div class="cardName">([\s\S]*?)<\/div>/);

    const normalizedAttribute = (jpAttributeMap[attributeMatch?.[1] ?? ''] ?? stripTags(attributeMatch?.[1] ?? '-')) || '-';

    cards.push({
      id: buildCardKey('JP', cardNo, modalId),
      locale: 'JP',
      cardNo,
      name: nameMatch ? stripTags(nameMatch[1]) : cardNo,
      nameEn: null,
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
      color: normalizeJpColor(extractJpField(block, 'color')),
      colorKo: normalizeJpColor(extractJpField(block, 'color')),
      cost: extractJpField(block, 'cost') || '-',
      power: extractJpField(block, 'power') || '-',
      counter: extractJpField(block, 'counter') || '-',
      attribute: normalizedAttribute,
      attributeKo: normalizedAttribute,
      type: extractJpField(block, 'feature') || '-',
      effect: extractJpField(block, 'text') || '효과 정보 준비 중',
      imageUrl: imageMatch ? `${JP_SITE}${imageMatch[1].replace(/^\.\./, '')}` : null,
      officialUrl: `${JP_CARD_LIST_URL}?freewords=${encodeURIComponent(cardNo)}`,
      marketPrice: null
    });
  }

  return cards;
}

function sortSeries(items) {
  const weight = (baseSeriesId) => {
    if (/^OP\d+/.test(baseSeriesId)) return 1;
    if (/^(EB|PRB)\d+/.test(baseSeriesId)) return 2;
    if (/^ST\d+/.test(baseSeriesId)) return 3;
    if (baseSeriesId === 'PROMO') return 4;
    if (baseSeriesId === 'FAMILY') return 5;
    return 9;
  };

  return [...items].sort((a, b) => {
    if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
    const diff = weight(a.baseSeriesId) - weight(b.baseSeriesId);
    if (diff !== 0) return diff;
    return a.baseSeriesId.localeCompare(b.baseSeriesId, 'en', { numeric: true });
  });
}

async function fetchJapaneseSeriesAndCards() {
  const dropdownHtml = await fetchText(JP_CARD_LIST_URL);
  const parsedSeries = parseJpSeriesOptions(dropdownHtml);
  const filteredSeries = parsedSeries.filter((series) => {
    return /^OP\d+/.test(series.baseSeriesId)
      || /^(EB|PRB)\d+/.test(series.baseSeriesId)
      || /^ST\d+/.test(series.baseSeriesId)
      || series.baseSeriesId === 'PROMO';
  });
  const seriesMap = new Map(filteredSeries.map((series) => [series.id, series]));
  const cards = [];

  for (const series of filteredSeries) {
    const url = `${JP_CARD_LIST_URL}?series=${encodeURIComponent(series.officialSeriesKeyword)}`;
    const html = await fetchText(url);
    const seriesCards = parseJpCardsFromHtml(html, series, seriesMap);
    cards.push(...seriesCards);
    console.log(`[merge] JP ${series.baseSeriesId}: ${seriesCards.length} cards`);
    await delay(REQUEST_DELAY_MS);
  }

  return { series: filteredSeries, cards };
}

async function main() {
  const existingSeries = await readJson(seriesPath);
  const existingCards = await readJson(cardsPath);

  const krSeries = existingSeries.filter((item) => item.locale !== 'JP').map(convertKrSeries);
  const krCards = existingCards.filter((item) => item.locale !== 'JP').map(convertKrCard);
  const jp = await fetchJapaneseSeriesAndCards();

  const mergedSeries = sortSeries([...krSeries, ...jp.series]);
  const mergedCards = [...krCards, ...jp.cards];

  await mkdir(path.dirname(seriesPath), { recursive: true });
  await writeFile(seriesPath, `${JSON.stringify(mergedSeries, null, 2)}\n`, 'utf8');
  await writeFile(cardsPath, `${JSON.stringify(mergedCards, null, 2)}\n`, 'utf8');
  console.log(`[merge] wrote ${mergedSeries.length} series / ${mergedCards.length} cards`);
}

main().catch((error) => {
  console.error('[merge] fatal:', error);
  process.exitCode = 1;
});
