// Per-series facts computed from catalog data, shared by the series guide page
// and its pre-rendered HTML so both always show the same content.

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
  const leaders = [];

  for (const card of base) {
    const category = String(card.category || '').toUpperCase();
    add(categories, category);
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
    keywords: sortedEntries(keywords)
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


// Sections for both the React guides and the pre-rendered HTML. Figures are
// structured (stats, bars, tables) so the page can chart them and the HTML
// can print the same values as text.
export function getSeriesGuideSections(analysis, listings, lang = 'KR') {
  const jp = lang === 'JP';
  const labels = SERIES_GUIDE_LABELS[jp ? 'JP' : 'KR'];
  const unit = jp ? '枚' : '장';
  const colorText = (keys) => keys.map((key) => labels.colors[key]).join(jp ? '' : '·') || '-';
  const bar = (label, count) => ({ label, value: count, display: `${formatCount(count)}${unit}` });
  const sections = [];

  if (analysis.leaders.length) {
    sections.push({
      heading: jp ? `リーダー ${analysis.leaders.length}種` : `리더 ${analysis.leaders.length}종`,
      leaders: analysis.leaders.map((leader) => ({ cardNo: leader.cardNo, name: leader.name, colors: colorText(leader.colors) })),
      items: analysis.leaders.map((leader) => `${leader.cardNo} ${leader.name} (${colorText(leader.colors)})`)
    });
  }
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
  if (listings?.items?.length) {
    const edition = listings.locale === 'EN' ? (jp ? '英語版' : '영문판') : (jp ? '日本版' : '일본판');
    sections.push({
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
    });
  }
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
