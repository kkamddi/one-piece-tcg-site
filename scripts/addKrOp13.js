import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');
const countsPath = path.join(rootDir, 'src/data/series-card-counts.json');

const OFFICIAL_BASE = 'https://onepiece-cardgame.kr';
const CARD_LIST_URL = `${OFFICIAL_BASE}/cardlist.do`;
const SERIES_ID = 'KR-OP13';
const BASE_SERIES_ID = 'OP13';
const USER_AGENT = 'one-piece-tcg-site-op13-sync/1.0 (+internal tooling)';
const REQUEST_DELAY_MS = 800;

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
  '-': '-',
  '': '-'
};

const seriesMeta = {
  id: SERIES_ID,
  koName: '계승되는 의지',
  enName: 'CARRYING ON HIS WILL',
  kindKo: '부스터 팩',
  kindEn: 'BOOSTER PACK',
  queryLabel: '',
  officialSeriesKeyword: 'OP-13',
  description: '공식 한글 카드 리스트 기준 부스터 팩 시리즈',
  locale: 'KR',
  baseSeriesId: BASE_SERIES_ID
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOfficialText(url) {
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
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function decodeHtml(value = '') {
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
    .replace(/<br\s*\/?>/gi, '\n')
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

function findOp13QueryLabel(html) {
  const options = [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)/g)]
    .map((match) => ({ value: decodeHtml(match[1]).trim(), label: decodeHtml(match[2]).trim() }));
  const option = options.find((item) => item.value.includes('OPK-13') || item.label.includes('OPK-13'));
  if (!option?.value) {
    throw new Error('KR OP13 option was not found on official card list.');
  }
  return option.value;
}

function normalizeCardNo(cardNo) {
  return String(cardNo || '').replace(/_P(\d+)$/i, '_p$1');
}

function getOriginSeries(cardNo, seriesLookup) {
  const baseNo = String(cardNo || '').replace(/_p\d+$/i, '');
  const prefix = baseNo.match(/^([A-Z]+\d+)-/)?.[1];
  if (!prefix) return seriesMeta;
  return seriesLookup.get(`KR-${prefix}`) || seriesMeta;
}

function parseCardsFromHtml(html, seriesLookup, seen = new Map()) {
  const blocks = [...html.matchAll(/<button class="item">([\s\S]*?)<\/button>/g)].map((match) => match[1]);

  return blocks
    .map((block) => {
      const cardNo = normalizeCardNo(extractField(block, 'cardNumber').trim());
      if (!cardNo) return null;

      const baseId = `KR::${cardNo}`;
      const variantIndex = seen.get(cardNo) ?? 0;
      seen.set(cardNo, variantIndex + 1);
      const id = variantIndex === 0 ? baseId : `${baseId}_p${variantIndex}`;
      const originSeries = getOriginSeries(cardNo, seriesLookup);

      const imageMatch = block.match(/<img class="image" src="([^"]+)"/);
      const categoryKo = extractField(block, 'cardType');
      const colorKo = extractField(block, 'cardColor');
      const attributeKo = extractField(block, 'cardAttr') || '-';

      return {
        id,
        cardNo,
        name: extractField(block, 'cardName'),
        nameEn: null,
        series: SERIES_ID,
        seriesName: seriesMeta.koName,
        seriesNameEn: seriesMeta.enName,
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
        marketPrice: null,
        locale: 'KR',
        baseSeriesId: BASE_SERIES_ID,
        originBaseSeriesId: originSeries.baseSeriesId || BASE_SERIES_ID
      };
    })
    .filter(Boolean);
}

async function fetchOp13Cards(queryLabel, seriesLookup) {
  const seen = new Map();
  const firstUrl = `${CARD_LIST_URL}?page=0&size=20&series=${encodeURIComponent(queryLabel)}&search=true`;
  const firstHtml = await fetchOfficialText(firstUrl);
  await delay(REQUEST_DELAY_MS);

  const lastPageIndex = getLastPageIndex(firstHtml);
  const cards = parseCardsFromHtml(firstHtml, seriesLookup, seen);

  for (let page = 1; page <= lastPageIndex; page += 1) {
    const pageUrl = `${CARD_LIST_URL}?page=${page}&size=20&series=${encodeURIComponent(queryLabel)}&search=true`;
    const html = await fetchOfficialText(pageUrl);
    await delay(REQUEST_DELAY_MS);
    cards.push(...parseCardsFromHtml(html, seriesLookup, seen));
  }

  return cards;
}

function insertSeries(seriesList, nextSeries) {
  const filtered = seriesList.filter((item) => item.id !== nextSeries.id);
  const insertAfter = filtered.findIndex((item) => item.id === 'KR-OP12');
  if (insertAfter >= 0) {
    filtered.splice(insertAfter + 1, 0, nextSeries);
    return filtered;
  }
  const firstJp = filtered.findIndex((item) => item.locale === 'JP');
  if (firstJp >= 0) {
    filtered.splice(firstJp, 0, nextSeries);
    return filtered;
  }
  return [...filtered, nextSeries];
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const no = String(a.cardNo || '').localeCompare(String(b.cardNo || ''), 'en', { numeric: true });
    if (no !== 0) return no;
    return String(a.id || '').localeCompare(String(b.id || ''), 'en', { numeric: true });
  });
}

async function main() {
  const [seriesList, cardsList, counts] = await Promise.all([
    readJson(seriesPath),
    readJson(cardsPath),
    readJson(countsPath)
  ]);

  const indexHtml = await fetchOfficialText(CARD_LIST_URL);
  const queryLabel = findOp13QueryLabel(indexHtml);
  const op13Series = { ...seriesMeta, queryLabel };
  const seriesLookup = new Map([...seriesList, op13Series].map((item) => [item.id, item]));
  const op13Cards = await fetchOp13Cards(queryLabel, seriesLookup);

  if (op13Cards.length < 100) {
    throw new Error(`KR OP13 card count looks too low: ${op13Cards.length}`);
  }

  const nextSeries = insertSeries(seriesList, op13Series);
  const nextCards = [
    ...cardsList.filter((card) => !(card.locale === 'KR' && card.series === SERIES_ID)),
    ...sortCards(op13Cards)
  ];
  const krSeriesCounts = {
    ...(counts.KR?.series || {}),
    [SERIES_ID]: op13Cards.length
  };
  const { officialSeriesCounts, ...countsWithoutLegacyRoot } = counts;
  const nextCounts = {
    ...countsWithoutLegacyRoot,
    KR: {
      ...(counts.KR || {}),
      total: Object.values(krSeriesCounts).reduce((sum, value) => sum + Number(value || 0), 0),
      series: krSeriesCounts
    }
  };

  await writeFile(seriesPath, `${JSON.stringify(nextSeries, null, 2)}\n`, 'utf8');
  await writeFile(cardsPath, `${JSON.stringify(nextCards, null, 2)}\n`, 'utf8');
  await writeFile(countsPath, `${JSON.stringify(nextCounts, null, 2)}\n`, 'utf8');

  console.log(`[op13] queryLabel: ${queryLabel}`);
  console.log(`[op13] wrote ${op13Cards.length} KR OP13 cards`);
}

main().catch((error) => {
  console.error('[op13] fatal:', error);
  process.exitCode = 1;
});
