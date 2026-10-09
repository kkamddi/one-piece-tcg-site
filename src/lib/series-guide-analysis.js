// Per-series facts computed from catalog data, shared by the series guide page
// and its pre-rendered HTML so both always show the same content.
import { extractReleaseItems } from '../../lib/release-schedule-editorial.js';

const COLOR_TOKENS = [
  ['red', /赤|Red|적색/i],
  ['green', /緑|Green|녹색/i],
  ['blue', /青|Blue|청색/i],
  ['purple', /紫|Purple|자색/i],
  ['black', /黒|Black|흑색/i],
  ['yellow', /黄|Yellow|황색/i]
];

const KEYWORDS = [
  ['onPlay', /【등장 시】|【登場時】|\[On Play\]/i],
  ['whenAttacking', /【어택 시】|【アタック時】|\[When Attacking\]/i],
  ['blocker', /【블로커】|【ブロッカー】|\[Blocker\]/i],
  ['onKo', /【KO 시】|【KO時】|\[On K\.O\.\]/i],
  ['counter', /【카운터】|【カウンター】|\[Counter\]/i],
  ['trigger', /【트리거】|【トリガー】|\[Trigger\]/i],
  ['rush', /【속공】|【速攻】|\[Rush\]/i]
];

const CATEGORY_ORDER = ['LEADER', 'CHARACTER', 'EVENT', 'STAGE'];
const RARITY_ORDER = ['L', 'SEC', 'SR', 'SP', 'R', 'UC', 'C', 'P', 'DON!!'];

export const SERIES_GUIDE_LABELS = {
  KR: {
    colors: { red: '적', green: '녹', blue: '청', purple: '자', black: '흑', yellow: '황' },
    categories: { LEADER: '리더', CHARACTER: '캐릭터', EVENT: '이벤트', STAGE: '스테이지' },
    keywords: { onPlay: '등장 시', whenAttacking: '어택 시', blocker: '블로커', onKo: 'KO 시', counter: '카운터', trigger: '트리거', rush: '속공' }
  },
  JP: {
    colors: { red: '赤', green: '緑', blue: '青', purple: '紫', black: '黒', yellow: '黄' },
    categories: { LEADER: 'リーダー', CHARACTER: 'キャラ', EVENT: 'イベント', STAGE: 'ステージ' },
    keywords: { onPlay: '登場時', whenAttacking: 'アタック時', blocker: 'ブロッカー', onKo: 'KO時', counter: 'カウンター', trigger: 'トリガー', rush: '速攻' }
  }
};

// Matches RenewApp's MARKET_USD_TO_KRW (155 JPY per USD x 9.4 KRW per JPY).
export const SERIES_GUIDE_USD_TO_KRW = 155 * 9.4;

const stripLabel = (value) => String(value ?? '').replace(/^(色|特徴|テキスト|コスト|カウンター|Color|Type|Effect|Cost|Counter)\s+/i, '').trim();
const baseCardNo = (card) => String(card.cardNo || '').replace(/_p\d+$/i, '');
const sortedEntries = (map) => [...map.entries()].sort((left, right) => right[1] - left[1]);

function add(map, key) {
  if (key !== undefined && key !== null && key !== '') map.set(key, (map.get(key) || 0) + 1);
}

export function getCardColors(card) {
  const text = String(card.colorKo || card.color || '');
  return COLOR_TOKENS.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
}

export function analyzeSeriesCards(cards = []) {
  const unique = new Map();
  for (const card of cards) {
    const cardNo = baseCardNo(card);
    if (cardNo && !unique.has(cardNo)) unique.set(cardNo, card);
  }
  const base = [...unique.values()];
  const colors = new Map();
  const categories = new Map();
  const costs = new Map();
  const counters = new Map();
  const traits = new Map();
  const keywords = new Map();
  const rarities = new Map();
  const leaders = [];

  for (const card of base) {
    const category = String(card.category || '').toUpperCase();
    add(categories, category);
    // The JP catalog spells SP as "SPカード".
    add(rarities, String(card.rarity || '').trim().replace(/^SPカード$/, 'SP') || '-');
    if (category === 'LEADER') {
      leaders.push({ cardNo: baseCardNo(card), name: card.name, colors: getCardColors(card) });
    } else {
      getCardColors(card).forEach((color) => add(colors, color));
    }
    if (category === 'CHARACTER') {
      const cost = Number.parseInt(stripLabel(card.cost), 10);
      if (Number.isFinite(cost)) add(costs, cost);
      const counter = Number.parseInt(stripLabel(card.counter), 10);
      add(counters, Number.isFinite(counter) && counter > 0 ? counter : 0);
    }
    stripLabel(card.type).split('/').map((trait) => trait.trim()).forEach((trait) => add(traits, trait));
    const effect = String(card.effect || '');
    KEYWORDS.forEach(([key, pattern]) => { if (pattern.test(effect)) add(keywords, key); });
  }

  return {
    baseCount: base.length,
    variantCount: Math.max(0, cards.length - base.length),
    leaders,
    colors: sortedEntries(colors),
    categories: [...categories.entries()].sort(([left], [right]) => CATEGORY_ORDER.indexOf(left) - CATEGORY_ORDER.indexOf(right)),
    costCurve: [...costs.entries()].sort(([left], [right]) => left - right),
    counters: [...counters.entries()].sort(([left], [right]) => right - left),
    traits: sortedEntries(traits).slice(0, 6),
    keywords: sortedEntries(keywords),
    rarities: [...rarities.entries()].sort(([left], [right]) => {
      const leftIndex = RARITY_ORDER.indexOf(left);
      const rightIndex = RARITY_ORDER.indexOf(right);
      if (leftIndex === -1 || rightIndex === -1) return (leftIndex === -1) - (rightIndex === -1) || left.localeCompare(right);
      return leftIndex - rightIndex;
    })
  };
}

// Highest SNKRDUNK listings from the series' own main product, so reprints,
// promos and overseas editions sharing the card number are left out.
export function getSeriesTopListings(series, marketItems = [], limit = 5) {
  const prefix = `${String(series?.baseSeriesId || '').toUpperCase()}-`;
  if (prefix === '-') return { locale: '', items: [] };
  const locale = series.locale === 'EN' ? 'EN' : 'JP';
  // SNKRDUNK spells one product several ways ("Wings of Captain" / "Wings Of The Captain").
  const setKey = (name) => String(name || '').toLowerCase().replace(/\bthe\b/g, '').replace(/[^a-z0-9]+/g, '');
  const candidates = marketItems.filter((item) => item.locale === locale && String(item.code || '').toUpperCase().startsWith(prefix) && setKey(item.setName));
  const setCounts = new Map();
  const setNames = new Map();
  candidates.forEach((item) => { add(setCounts, setKey(item.setName)); add(setNames, item.setName); });
  const mainKey = sortedEntries(setCounts)[0]?.[0];
  const mainSet = sortedEntries(setNames).find(([name]) => setKey(name) === mainKey)?.[0];
  const productItems = candidates.filter((item) => setKey(item.setName) === mainKey);
  const items = productItems
    .filter((item) => Number(item.minPrice) > 0)
    .sort((left, right) => Number(right.minPrice) - Number(left.minPrice))
    .slice(0, limit)
    .map((item) => ({ code: item.code, name: item.name, apparelId: item.apparelId, minPrice: Number(item.minPrice) }));
  return { locale, setName: mainSet || '', items, productItems };
}

const LISTING_BUCKETS = [[500, Infinity], [100, 500], [20, 100], [0, 20]];

// Box guide facts: the hit cards in a JP booster and how its SNKRDUNK listings are spread.
export function analyzeBoxSeries(seriesId, cards = [], marketItems = [], mangaGroups = []) {
  const isParallel = (card) => /_p\d*$/i.test(card.id || '');
  // The JP catalog labels SP cards "SPカード", so match the prefix.
  const isSpecial = (card) => /^SP/i.test(String(card.rarity || ''));
  const hits = cards.filter((card) => {
    if (card.locale !== 'JP' || String(card.series || '').replace(/^JP-/, '') !== seriesId) return false;
    return isParallel(card) || isSpecial(card) || String(card.rarity || '').toUpperCase() === 'SEC';
  });
  // Manga rares come from the curated collection list; SNKRDUNK product names miss several sets.
  const manga = mangaGroups.find((group) => String(group.set || '').replace('-', '') === seriesId)?.cards || [];
  const product = getSeriesTopListings({ baseSeriesId: seriesId, locale: 'JP' }, marketItems, 0);
  const prices = product.productItems.map((item) => Number(item.minPrice)).filter((price) => price > 0).sort((left, right) => left - right);
  const middle = Math.floor(prices.length / 2);
  // Korean names read better on the Korean guide; fall back to the JP catalog name.
  const koreanName = new Map(cards.filter((card) => card.locale === 'KR').map((card) => [card.cardNo, card.name]));
  // Premium boosters list some reprinted SECs twice under one card number.
  const secretCards = [...new Map(hits
    .filter((card) => !isParallel(card) && String(card.rarity).toUpperCase() === 'SEC')
    .map((card) => [card.cardNo, card])).values()];
  return {
    secret: secretCards.length,
    secretCards: secretCards.map((card) => ({ cardNo: card.cardNo, name: koreanName.get(card.cardNo) || card.name })),
    special: hits.filter(isSpecial).length,
    parallel: hits.filter((card) => isParallel(card) && !isSpecial(card)).length,
    manga: manga.length,
    mangaNames: manga.map((card) => (card.variant ? `${card.nameKo} (${card.variant})` : card.nameKo)),
    setName: product.setName,
    listed: product.productItems.length,
    priced: prices.length,
    median: prices.length ? (prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2) : 0,
    buckets: LISTING_BUCKETS.map(([low, high]) => [low, high, prices.filter((price) => price >= low && price < high).length])
  };
}

const formatCount = (value) => Number(value).toLocaleString('en-US');


const RANDOM_PACK_PATTERN = /^(OP|EB|PRB)\d{2}$/;
const DAY_MS = 86400000;

// OP / EB / PRB boosters are random packs with hit cards; starter decks (ST) and promos are not.
export function isRandomPackSeries(code) {
  return RANDOM_PACK_PATTERN.test(String(code || '').toUpperCase().replace(/^(KR|JP|EN)-/, '').replace(/-/g, ''));
}

// Korean booster number used in titles ("13탄").
// Korean pages name a set in Korean: an alias searchers use, else the Korean edition's official name,
// else the product kind (JP/EN-only sets have no official Korean name yet).
const KOREAN_SERIES_ALIASES = { EB03: '원피스 히로인즈 에디션' };
const seriesCodeKey = (item) => String(item?.baseSeriesId || item?.id || '').toUpperCase().replace(/^(KR|JP|EN)-/, '').replace(/-/g, '');
export function getKoreanSeriesName(series, allSeries = []) {
  const code = seriesCodeKey(series);
  if (KOREAN_SERIES_ALIASES[code]) return KOREAN_SERIES_ALIASES[code];
  if (series?.locale === 'KR') return series.koName || series.enName || code;
  const korean = allSeries.find((item) => item.locale === 'KR' && seriesCodeKey(item) === code);
  if (korean?.koName) return korean.koName;
  // Keep the Latin subtitle of a JP-only set (e.g. EGGHEAD CRISIS) so English-name searches still match.
  const latin = String(series?.enName || series?.koName || '').match(/[A-Za-z0-9][A-Za-z0-9 .'&-]*[A-Za-z0-9.]/)?.[0] || '';
  return [series?.kindKo || '카드 시리즈', latin].filter(Boolean).join(' ');
}

export function getBoosterNumberLabel(code) {
  const match = /^OP-?0*(\d+)$/i.exec(String(code || ''));
  return match ? `${match[1]}탄` : '';
}

// Today's date in Korea (YYYY-MM-DD), the reference for "발매 예정".
export function getKstDateKey(now = Date.now()) {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}

// Earliest official booster release per locale for one code (OP-13 ↔ OPK-13) from src/data/topics.json.
const releaseCache = new WeakMap();
export function getSeriesReleaseDates(code, topics) {
  if (!Array.isArray(topics)) return { jp: '', kr: '' };
  let dates = releaseCache.get(topics);
  if (!dates) {
    dates = new Map();
    extractReleaseItems(topics)
      .filter((item) => item.code && /ブースター|부스터/.test(item.title))
      .forEach((item) => {
        const key = `${item.locale}|${item.code.key}`;
        if (!dates.has(key) || item.date < dates.get(key)) dates.set(key, item.date);
      });
    releaseCache.set(topics, dates);
  }
  const key = String(code || '').toUpperCase().replace(/-/g, '');
  return { jp: dates.get(`JP|${key}`) || '', kr: dates.get(`KR|${key}`) || '' };
}

// Everything a random-pack guide needs beyond the catalog cards. The page and the pre-rendered HTML
// both build it here. KR and JP guides read the Japanese SNKRDUNK trades for the same code
// (src/data/series-hit-cards.json); English editions trade separately, so they keep listings only.
export function getSeriesGuideContext(series, { hitCards, topics, cardCount = 0, today = getKstDateKey() } = {}) {
  const code = String(series?.baseSeriesId || '').toUpperCase();
  if (!isRandomPackSeries(code)) return null;
  const locale = series.locale === 'EN' ? 'EN' : series.locale === 'KR' ? 'KR' : 'JP';
  return {
    code,
    locale,
    market: locale === 'EN' ? null : hitCards?.sets?.[code] || null,
    dataDate: hitCards?.updatedAt || '',
    release: getSeriesReleaseDates(code, topics),
    cardCount: Number(cardCount) || 0,
    today
  };
}

const hasTradeCards = (context) => Boolean(context?.market?.hitCards?.length);

// Meta description shared by the page SEO and the pre-rendered HTML.
export function getRandomPackGuideDescription(context, { name, cardCount, localeLabel, japanese = false }) {
  const trades = hasTradeCards(context);
  const box = Boolean(context?.market?.box);
  if (japanese) {
    return `ワンピースカード${localeLabel}${context.code} ${name}の発売日、${trades ? '高額カードTOP10の取引価格（日本版SNKRDUNK）' : '高額カード'}、${box ? 'BOX相場、' : ''}収録カード${cardCount}枚の構成。`;
  }
  const number = getBoosterNumberLabel(context.code);
  return `원피스카드 ${localeLabel} ${context.code} ${name}${number ? ` (${number})` : ''}의 발매일, ${trades ? `${localeLabel === '일본판' ? '' : '일본판 '}힛카드 TOP 10 실거래가` : '힛카드'}, ${box ? '박스 시세, ' : ''}수록 카드 ${cardCount}장 구성.`;
}

// One-line intro shared by the page hero and the pre-rendered HTML.
export function getRandomPackGuideIntro(context, { name, localeLabel, japanese = false }) {
  const trades = hasTradeCards(context);
  const box = Boolean(context?.market?.box);
  if (japanese) {
    return `${localeLabel}${context.code} ${name}の発売日、${trades ? '高額カードの取引価格、' : ''}${box ? 'BOX相場、' : ''}カード構成を1ページで確認できます。`;
  }
  return `${localeLabel} ${context.code} ${name}의 발매일, ${trades ? '힛카드 실거래가, ' : ''}${box ? '박스 시세, ' : ''}카드 구성을 한 페이지에서 확인합니다.`;
}

const JP_VERSION_WORDS = [
  ['해적단 슈퍼 패러렐', '海賊団スーパーパラレル'],
  ['리더 슈퍼 패러렐', 'リーダースーパーパラレル'],
  ['슈퍼 패러렐', 'スーパーパラレル'],
  ['망가 레드', 'コミパラ(赤)'],
  ['망가 골드', 'コミパラ(金)'],
  ['망가', 'コミパラ'],
  ['트레저 레어', 'トレジャーレア'],
  ['패러렐', 'パラレル'],
  ['리더', 'リーダー'],
  ['금색', '金'],
  ['은색', '銀']
];

export function getJapaneseVersionLabel(label) {
  return JP_VERSION_WORDS.reduce((text, [ko, ja]) => text.replaceAll(ko, ja), String(label || ''));
}

const formatDate = (key, jp = false) => (key ? key.replaceAll('-', jp ? '/' : '.') : '');
// Trade dates in the reference year drop the year, older ones keep it.
const formatTradeDate = (date, dataDate) => {
  if (!date) return '-';
  return date.slice(0, 4) === String(dataDate || '').slice(0, 4) ? date.slice(5) : date;
};
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

function getListingSection(listings, jp) {
  const edition = listings.locale === 'EN' ? (jp ? '英語版' : '영문판') : (jp ? '日本版' : '일본판');
  return {
    heading: jp ? `高額カード TOP ${listings.items.length}` : `힛카드(고가 카드) TOP ${listings.items.length}`,
    wide: true,
    paragraphs: [jp
      ? `${edition}SNKRDUNK「${listings.setName}」の出品最安値順です。出品価格のため実際の取引価格とは異なる場合があります。`
      : `${edition} SNKRDUNK '${listings.setName}' 상품의 등록 최저가 순입니다. 판매 등록가라 실제 거래가와 다를 수 있습니다.`],
    table: {
      numeric: true,
      columns: jp ? ['カード', '出品最安値', 'ウォン換算'] : ['카드', '등록 최저가', '원화'],
      rows: listings.items.map((item) => [item.name, `US $${formatCount(item.minPrice)}`, `₩${formatCount(Math.round(item.minPrice * SERIES_GUIDE_USD_TO_KRW))}`])
    }
  };
}

function getLeaderSection(analysis, jp) {
  const labels = SERIES_GUIDE_LABELS[jp ? 'JP' : 'KR'];
  const colorText = (keys) => keys.map((key) => labels.colors[key]).join(jp ? '' : '·') || '-';
  return {
    heading: jp ? `リーダー ${analysis.leaders.length}種` : `리더 ${analysis.leaders.length}종`,
    leaders: analysis.leaders.map((leader) => ({ cardNo: leader.cardNo, name: leader.name, colors: colorText(leader.colors) })),
    items: analysis.leaders.map((leader) => `${leader.cardNo} ${leader.name} (${colorText(leader.colors)})`)
  };
}

function getReleaseSection(analysis, jp, context) {
  const { release, today, cardCount } = context;
  if (!release.jp && !release.kr) return null;
  const upcoming = Boolean(release.kr && today && release.kr > today);
  const gap = release.jp && release.kr ? daysBetween(release.jp, release.kr) : null;
  let lead;
  if (jp) {
    if (!release.kr) lead = '韓国版の発売日は公式スケジュールにまだありません。';
    else if (gap === null) lead = `韓国版は${formatDate(release.kr, true)}に発売${upcoming ? '予定です' : 'されました'}。`;
    else lead = upcoming ? `韓国版は日本版の${gap}日後、${formatDate(release.kr, true)}に発売予定です。` : `韓国版は日本版の${gap}日後に発売されました。`;
  } else if (!release.kr) lead = '한글판 발매일은 공식 일정에 아직 없습니다.';
  else if (gap === null) lead = `한글판은 ${formatDate(release.kr)} 발매${upcoming ? ' 예정' : ''}입니다.`;
  else lead = upcoming ? `한글판은 일본판보다 ${gap}일 늦은 ${formatDate(release.kr)} 발매 예정입니다.` : `한글판은 일본판보다 ${gap}일 늦게 발매됐습니다.`;
  const count = cardCount || analysis.baseCount + analysis.variantCount;
  const countText = jp
    ? `${formatCount(count)}枚${analysis.baseCount ? `（基本${analysis.baseCount}種）` : ''}`
    : `${formatCount(count)}장${analysis.baseCount ? ` (기본 ${analysis.baseCount}종)` : ''}`;
  const krDate = release.kr ? `${formatDate(release.kr, jp)}${upcoming ? (jp ? ' 予定' : ' 예정') : ''}` : (jp ? '未定' : '미정');
  return {
    heading: jp ? '発売情報' : '발매 정보',
    paragraphs: [lead],
    table: {
      columns: jp ? ['日本版発売日', '韓国版発売日', '収録カード'] : ['일본판 발매일', '한글판 발매일', '수록 카드'],
      rows: [[formatDate(release.jp, jp) || '-', krDate, countText]]
    }
  };
}

function getHitCardSection(jp, context) {
  const { code, market, dataDate } = context;
  const hits = market.hitCards;
  const { manga = 0, sp = 0 } = market.counts || {};
  const parts = jp
    ? [manga ? `コミパラは${manga}種` : '', sp ? `SPは${sp}種` : ''].filter(Boolean).join('、')
    : [manga ? `망가는 ${manga}종` : '', sp ? `SP는 ${sp}종` : ''].filter(Boolean).join('·');
  const lead = jp
    ? `日本版SNKRDUNKの直近シングル取引価格順${parts ? `で、取引のある${parts}です` : 'です'}。`
    : `일본판 SNKRDUNK 최근 Single 거래가 순${parts ? `이며, 거래가 있는 ${parts}입니다` : '입니다'}.`;
  const name = (card) => (jp ? card.nameJp || card.name : card.name);
  const version = (card) => (jp ? getJapaneseVersionLabel(card.version) : card.version);
  return {
    heading: jp ? `${code} 高額カード TOP ${hits.length}` : `${code} 힛카드 TOP ${hits.length}`,
    wide: true,
    paragraphs: [lead],
    table: {
      numeric: true,
      columns: jp ? ['順位', 'カード', '番号', 'バージョン', 'シングル取引価格', '取引日'] : ['순위', '카드', '번호', '버전', 'Single 거래가', '거래일'],
      rows: hits.map((card, index) => [String(index + 1), name(card), card.code, version(card), `¥${formatCount(card.singleJpy)}`, formatTradeDate(card.singleDate, dataDate)])
    },
    images: hits.slice(0, 3)
      .map((card, index) => ({ card, rank: index + 1 }))
      .filter(({ card }) => card.image)
      .map(({ card, rank }) => ({
        src: card.image,
        alt: `${card.code} ${name(card)} ${version(card)}`,
        caption: jp ? `${rank}位 ${name(card)} ${version(card)}` : `${rank}위 ${name(card)} ${version(card)}`
      }))
  };
}

function getBoxSection(jp, context) {
  const { code, market } = context;
  const box = market.box;
  const trade = box.basis === 'trade';
  const price = trade ? `¥${formatCount(box.priceJpy)}` : `US $${formatCount(box.priceUsd)}`;
  const date = formatDate(box.date, jp);
  let lead;
  if (jp) lead = trade ? `日本版${code} BOXの直近取引価格は${price}です（${date}取引）。` : `日本版${code} BOXのSNKRDUNK最安出品価格は${price}です（${date}時点）。`;
  else lead = trade
    ? `일본판 ${code} 박스의 최근 거래가는 ${price}입니다(${date} 거래).`
    : `일본판 ${code} 박스의 SNKRDUNK 등록 최저가는 ${price}(약 ₩${formatCount(Math.round(box.priceUsd * SERIES_GUIDE_USD_TO_KRW))})입니다(${date} 기준).`;
  return {
    heading: jp ? 'BOX相場' : '박스 시세',
    paragraphs: [lead],
    links: jp ? [{ href: '/jp/prices', label: 'カード・BOX相場' }] : [{ href: '/guide/box-recommendation', label: '원피스카드 박스 추천 가이드' }]
  };
}

function getRaritySection(analysis, jp) {
  return {
    heading: jp ? 'レアリティ構成' : '레어도 구성',
    paragraphs: [jp
      ? `基本カード番号${analysis.baseCount}種の内訳で、パラレルなど${analysis.variantCount}枚は含みません。`
      : `기본 카드번호 ${analysis.baseCount}종 기준이며, 패러렐 등 추가 일러스트 ${analysis.variantCount}장은 뺀 수입니다.`],
    stats: analysis.rarities.map(([rarity, count]) => ({ label: rarity, value: `${formatCount(count)}${jp ? '種' : '종'}` }))
  };
}

// Card types and colors in one block; cost curve, traits and keywords are left to the card list.
function getCompositionSection(analysis, jp) {
  const labels = SERIES_GUIDE_LABELS[jp ? 'JP' : 'KR'];
  const unit = jp ? '枚' : '장';
  return {
    heading: jp ? 'カード種類と色' : '카드 종류와 색상',
    paragraphs: [jp ? '色はリーダーを除き、多色カードは各色に数えています。' : '색상은 리더를 빼고, 다색 카드는 각 색에 포함해 셌습니다.'],
    stats: [
      ...analysis.categories.filter(([key]) => key !== 'LEADER').map(([key, count]) => ({ label: labels.categories[key] || key, value: `${formatCount(count)}${unit}` })),
      ...analysis.colors.map(([key, count]) => ({ label: jp ? `${labels.colors[key]}` : `${labels.colors[key]}색`, value: `${formatCount(count)}${unit}` }))
    ]
  };
}

function getPriceNoteSection(jp, context) {
  const { market, dataDate } = context;
  const listingBox = market?.box?.basis === 'listing';
  const cards = hasTradeCards(context);
  const basis = jp
    ? (cards ? `取引価格${listingBox ? '（BOXは出品価格）' : ''}` : '出品価格')
    : (cards ? `거래가${listingBox ? '(박스는 등록가)' : ''}` : '등록가');
  return {
    heading: jp ? '価格の基準' : '가격 기준',
    paragraphs: [jp
      ? `価格は${formatDate(dataDate, true)}時点の日本版SNKRDUNK${basis}で、韓国版の価格とは異なり、利益を保証するものではありません。`
      : `가격은 ${formatDate(dataDate)} 기준 일본판 SNKRDUNK ${basis}로, 한국판 가격과 다르고 수익을 보장하지 않습니다.`]
  };
}

// Random-pack order: release → hit cards → box → leaders → rarity → types/colors → price note.
function getRandomPackSections(analysis, listings, jp, context) {
  const sections = [];
  const release = getReleaseSection(analysis, jp, context);
  if (release) sections.push(release);
  if (hasTradeCards(context)) sections.push(getHitCardSection(jp, context));
  else if (listings?.items?.length) sections.push(getListingSection(listings, jp));
  if (context.market?.box) sections.push(getBoxSection(jp, context));
  if (analysis.leaders.length) sections.push(getLeaderSection(analysis, jp));
  if (analysis.baseCount && analysis.rarities?.length) sections.push(getRaritySection(analysis, jp));
  if (analysis.categories.length) sections.push(getCompositionSection(analysis, jp));
  if (hasTradeCards(context) || context.market?.box) sections.push(getPriceNoteSection(jp, context));
  return sections;
}

// Sections for both the React guides and the pre-rendered HTML. Figures are
// structured (stats, bars, tables) so the page can chart them and the HTML
// can print the same values as text. Random-pack boosters pass a context from
// getSeriesGuideContext; starter decks and promos keep the catalog analysis below.
export function getSeriesGuideSections(analysis, listings, lang = 'KR', context = null) {
  const jp = lang === 'JP';
  if (context) return getRandomPackSections(analysis, listings, jp, context);
  const labels = SERIES_GUIDE_LABELS[jp ? 'JP' : 'KR'];
  const unit = jp ? '枚' : '장';
  const bar = (label, count) => ({ label, value: count, display: `${formatCount(count)}${unit}` });
  const sections = [];

  if (analysis.leaders.length) sections.push(getLeaderSection(analysis, jp));
  sections.push({
    heading: jp ? 'カード種類と色' : '카드 종류와 색상',
    stats: analysis.categories.map(([key, count]) => ({ label: labels.categories[key] || key, value: `${formatCount(count)}${unit}` })),
    ...(analysis.colors.length ? {
      paragraphs: [jp ? '色はリーダーを除き、多色カードは各色に数えています。' : '색상은 리더를 빼고, 다색 카드는 각 색에 포함해 셌습니다.'],
      bars: analysis.colors.map(([key, count]) => bar(labels.colors[key], count))
    } : {})
  });
  if (analysis.costCurve.length) {
    sections.push({
      heading: jp ? 'キャラのコストとカウンター' : '캐릭터 코스트와 카운터',
      stats: analysis.counters.map(([value, count]) => ({ label: `${jp ? 'カウンター' : '카운터'} ${value ? `+${value}` : (jp ? 'なし' : '없음')}`, value: `${formatCount(count)}${unit}` })),
      bars: analysis.costCurve.map(([cost, count]) => bar(jp ? `${cost}コスト` : `${cost}코스트`, count))
    });
  }
  if (analysis.traits.length) {
    sections.push({ heading: jp ? '主な特徴' : '주요 특징', bars: analysis.traits.map(([trait, count]) => bar(trait, count)) });
  }
  if (analysis.keywords.length) {
    sections.push({ heading: jp ? '効果キーワード' : '효과 키워드', bars: analysis.keywords.map(([key, count]) => bar(labels.keywords[key], count)) });
  }
  if (listings?.items?.length) sections.push(getListingSection(listings, jp));
  return sections;
}

const formatUsdKrw = (usd) => `US $${formatCount(Math.round(usd * 100) / 100)} / ₩${formatCount(Math.round(usd * SERIES_GUIDE_USD_TO_KRW))}`;

export function getBoxGuideSections(box) {
  const sections = [];
  if (box.secret || box.special || box.parallel) {
    sections.push({
      heading: '히트 카드 구성',
      paragraphs: ['일본판 도감 기준입니다. 망가 레어는 Card Pone 망가 카드 목록 기준입니다.'],
      stats: [
        { label: 'SEC', value: `${box.secret}종` },
        { label: 'SP', value: `${box.special}종` },
        { label: '패러렐', value: `${box.parallel}종` },
        { label: '망가 레어', value: `${box.manga || 0}종` }
      ],
      items: [
        box.secretCards?.length ? `SEC: ${box.secretCards.map((card) => `${card.cardNo} ${card.name}`).join(' · ')}` : '',
        box.manga ? `망가 레어: ${box.mangaNames.join(' · ')}` : ''
      ].filter(Boolean)
    });
  }
  // Too few listings (e.g. premium boosters reusing old card numbers) say nothing about the box.
  if (box.priced >= 10) {
    const label = ([low, high]) => (high === Infinity ? `US $${low} 이상` : low === 0 ? `US $${high} 미만` : `US $${low}~${high}`);
    sections.push({
      heading: 'SNKRDUNK 등록가 분포',
      paragraphs: [`'${box.setName}' 상품으로 등록된 카드 ${box.listed}종 중 가격이 있는 ${box.priced}종의 등록 최저가 분포입니다. 판매 등록가라 실제 거래가와 다를 수 있습니다.`],
      bars: box.buckets.map(([low, high, count]) => ({ label: label([low, high]), value: count, display: `${count}종` })),
      stats: [{ label: '등록가 중앙값', value: formatUsdKrw(box.median) }]
    });
  }
  return sections;
}
