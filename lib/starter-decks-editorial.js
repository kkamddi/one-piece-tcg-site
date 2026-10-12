// Builds the /guide/starter-decks article from src/data/series.json (deck names), src/data/cards.json (leaders:
// color, life, power, Korean names) and src/data/topics.json (official JP/KR release calendar).
// series.json and cards.json stop before the newest Korean decks, so the calendar decides which decks exist and when;
// a reprinted leader (ST-23 uses OP09-001) is still found through the deck's series id in cards.json.
// Pure and deterministic: the same inputs + today always give the same object.
// Plain ES module without browser or Node APIs; shared by the React app and the static pre-render script.
import { extractReleaseItems, toDateKey, withTopicParticle } from './release-schedule-editorial.js';

export const STARTER_DECKS_PATH = '/guide/starter-decks';
export const STARTER_DECKS_REVIEWED_AT = '2026-10-12';
// Official list prices, same as lib/getting-started-editorial.js (product table) and lib/guide-article-faq.js (shops).
export const STARTER_DECK_LIST_PRICE = { krWon: 12000, jpYen: 1430 };

const RECENT_DATE_GROUPS = 3;
const COLOR_ORDER = ['red', 'green', 'blue', 'purple', 'black', 'yellow'];
const COLOR_LABELS = { red: '빨강', green: '초록', blue: '파랑', purple: '보라', black: '검정', yellow: '노랑' };
// EN 'Color Red/Purple', JP '色 赤, 자색', KR '녹색,청색,다색' and the one-character JP/KR title prefixes (赤黒, 적).
const COLOR_TOKENS = {
  red: 'red', '赤': 'red', '적색': 'red', '적': 'red',
  green: 'green', '緑': 'green', '녹색': 'green', '녹': 'green',
  blue: 'blue', '青': 'blue', '청색': 'blue', '청': 'blue',
  purple: 'purple', '紫': 'purple', '자색': 'purple', '자': 'purple',
  black: 'black', '黒': 'black', '흑색': 'black', '흑': 'black',
  yellow: 'yellow', '黄': 'yellow', '황색': 'yellow', '황': 'yellow'
};
const JP_COLOR_PREFIX = /^[赤緑青紫黒黄]+$/;
const DECK_SERIES_PATTERN = /^(KR|JP|EN)-ST(\d{2})$/;
const DECK_PREFIX_PATTERN = /^(스타트 덱|얼티밋 덱|울트라 덱)\s*(EX\s+)?/;

const pad = (number) => String(number).padStart(2, '0');
const krCode = (number) => `STK-${number}`;
const jpCode = (number) => `ST-${number}`;
const baseCardNo = (cardNo) => String(cardNo || '').replace(/_p\d+$/i, '').toUpperCase();
const digits = (value) => {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
};
const normalizeJpName = (name) => String(name || '').normalize('NFKC').replace(/[\s・.]/g, '');

function formatKoreanDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function parseColors(value) {
  const found = new Set();
  String(value || '')
    .replace(/^(Color|色)\s*/i, '')
    .split(/[\s,/、]+/)
    .forEach((token) => {
      const color = COLOR_TOKENS[token.toLowerCase()] || COLOR_TOKENS[token];
      if (color) found.add(color);
    });
  return COLOR_ORDER.filter((color) => found.has(color));
}

export function colorLabel(colors) {
  return colors.length ? colors.map((color) => COLOR_LABELS[color]).join('/') : '-';
}

// Japanese leader names → Korean names through cards printed in both languages (same card number).
function buildNameTranslator(cards) {
  const krByNo = new Map();
  cards.forEach((card) => {
    if (card?.locale === 'KR' && card.name && !krByNo.has(baseCardNo(card.cardNo))) krByNo.set(baseCardNo(card.cardNo), card.name);
  });
  const full = new Map();
  const short = new Map();
  cards.forEach((card) => {
    if (card?.locale !== 'JP' || !card.name) return;
    const krName = krByNo.get(baseCardNo(card.cardNo));
    if (!krName) return;
    const key = normalizeJpName(card.name);
    if (!full.has(key)) full.set(key, krName);
    // ポートガス・D・エース → 포트거스 D. 에이스 also teaches エース → 에이스 for names such as ルフィ＆エース.
    const jpLast = String(card.name).normalize('NFKC').split('・').pop();
    const krLast = krName.split(' ').pop();
    if (/・/.test(card.name) && jpLast && krLast && !short.has(normalizeJpName(jpLast))) short.set(normalizeJpName(jpLast), krLast);
  });
  const one = (name) => full.get(normalizeJpName(name)) || short.get(normalizeJpName(name)) || null;
  return { krByNo, translate(name) {
    const direct = one(name);
    if (direct) return direct;
    const parts = String(name || '').normalize('NFKC').split(/\s*&\s*/);
    if (parts.length > 1) {
      const translated = parts.map(one);
      if (translated.every(Boolean)) return translated.join(' & ');
    }
    return null;
  } };
}

// Leader cards per deck number ('01'…), from every printing whose series is that deck (any language).
export function collectDeckLeaders(cards) {
  const list = Array.isArray(cards) ? cards : [];
  const { krByNo, translate } = buildNameTranslator(list);
  const byNo = new Map();
  const decks = new Map();
  list.forEach((card) => {
    if (!card || card.category !== 'LEADER') return;
    const match = String(card.series || '').match(DECK_SERIES_PATTERN);
    if (!match) return;
    const cardNo = baseCardNo(card.cardNo);
    const entry = byNo.get(cardNo) || { cardNo, colorsBy: {}, life: null, power: null, jpName: '', enName: '', locales: new Set() };
    entry.colorsBy[card.locale] = entry.colorsBy[card.locale]?.length ? entry.colorsBy[card.locale] : parseColors(card.locale === 'KR' ? card.colorKo || card.color : card.color);
    entry.life = entry.life ?? digits(card.cost);
    entry.power = entry.power ?? digits(card.power);
    if (card.locale === 'JP' && !entry.jpName) entry.jpName = card.name;
    if (card.locale === 'EN' && !entry.enName) entry.enName = card.name;
    entry.locales.add(card.locale);
    byNo.set(cardNo, entry);
    const deck = decks.get(match[2]) || new Set();
    deck.add(cardNo);
    decks.set(match[2], deck);
  });
  const result = new Map();
  decks.forEach((cardNos, number) => {
    result.set(number, [...cardNos].sort().map((cardNo) => {
      const entry = byNo.get(cardNo);
      // KR multi-color leaders in cards.json share one color list (ST13-002 shows 적색·황색), so EN and JP come first.
      const colors = [entry.colorsBy.EN, entry.colorsBy.JP, entry.colorsBy.KR].find((value) => value?.length) || [];
      const name = krByNo.get(cardNo) || translate(entry.jpName) || entry.enName || entry.jpName || cardNo;
      return { cardNo, name, colors, life: entry.life, power: entry.power, krPrinted: entry.locales.has('KR') && krByNo.has(cardNo) };
    }));
  });
  return { leaders: result, translate };
}

// 'スタートデッキ 紫黒 モンキー・D・ルフィ【ST-26】' → colors + leader name, for decks the card list does not have yet.
function leaderFromJpTitle(title, translate) {
  const rest = String(title || '')
    .replace(/【[^】]*】/g, ' ')
    .replace(/^\s*(スタートデッキ\s*EX|スタートデッキ|アルティメットデッキ)\s*/, '')
    .trim();
  const [first, ...others] = rest.split(/\s+/);
  if (!first || !JP_COLOR_PREFIX.test(first) || !others.length) return null;
  const jpName = others.join(' ');
  return { cardNo: '', name: translate(jpName) || jpName, colors: parseColors([...first].join(' ')), life: null, power: null, krPrinted: false };
}

function krDeckName(seriesEntry, topicTitle) {
  const fromSeries = String(seriesEntry?.koName || '').replace(DECK_PREFIX_PATTERN, '').trim();
  if (fromSeries) return fromSeries;
  return String(topicTitle || '').replace(/\[[^\]]*\]/g, ' ').trim().replace(DECK_PREFIX_PATTERN, '').trim();
}

// One entry per deck number with Korean and Japanese editions, leaders and release dates.
export function collectStarterDecks(series, cards, topics) {
  const seriesList = Array.isArray(series) ? series : [];
  const releases = extractReleaseItems(topics).filter((item) => item.code?.family === 'ST');
  const firstRelease = (locale) => {
    const map = new Map();
    releases.filter((item) => item.locale === locale).forEach((item) => {
      const current = map.get(item.code.number);
      if (!current || item.date < current.date) map.set(item.code.number, item);
    });
    return map;
  };
  const krReleases = firstRelease('KR');
  const jpReleases = firstRelease('JP');
  const seriesBy = (locale) => new Map(seriesList
    .map((entry) => [String(entry?.id || '').match(new RegExp(`^${locale}-ST(\\d{2})$`))?.[1], entry])
    .filter(([number]) => number));
  const krSeries = seriesBy('KR');
  const jpSeries = seriesBy('JP');
  const { leaders, translate } = collectDeckLeaders(cards);
  const numbers = new Set([...krReleases.keys(), ...jpReleases.keys(), ...krSeries.keys(), ...jpSeries.keys()]);
  return [...numbers].sort().map((number) => {
    const kr = krReleases.get(number);
    const jp = jpReleases.get(number);
    const jpTitle = jp?.title || jpSeries.get(number)?.queryLabel || '';
    const titleLeader = leaderFromJpTitle(jpTitle, translate);
    return {
      number,
      krCode: krCode(number),
      jpCode: jpCode(number),
      hasKr: Boolean(kr || krSeries.has(number)),
      hasJp: Boolean(jp || jpSeries.has(number)),
      krName: kr || krSeries.has(number) ? krDeckName(krSeries.get(number), kr?.title) : '',
      krDate: kr?.date || '',
      jpDate: jp?.date || '',
      leaders: leaders.get(number) || (titleLeader ? [titleLeader] : [])
    };
  });
}

// STK-23·STK-24·STK-25 → STK-23~25 (consecutive numbers only).
export function compressCodes(numbers, toCode = krCode) {
  const sorted = [...new Set(numbers)].map(Number).sort((a, b) => a - b);
  const groups = [];
  sorted.forEach((value) => {
    const last = groups[groups.length - 1];
    if (last && value === last[1] + 1) last[1] = value;
    else groups.push([value, value]);
  });
  return groups.map(([from, to]) => (from === to ? toCode(pad(from)) : `${toCode(pad(from))}~${pad(to)}`)).join('·');
}

const leaderNames = (deck) => (deck.leaders.length ? deck.leaders.map((leader) => leader.name).join('·') : '-');
const deckColors = (deck) => {
  const labels = [...new Set(deck.leaders.map((leader) => colorLabel(leader.colors)).filter((label) => label !== '-'))];
  return labels.length ? labels.join(', ') : '-';
};
const isSingleColor = (deck) => deck.leaders.length > 0 && deck.leaders.every((leader) => leader.colors.length === 1);
const isMultiColor = (deck) => deck.leaders.length > 0 && deck.leaders.every((leader) => leader.colors.length > 1);

// Most common value as [value, count, total]; null for an empty list.
function mode(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return top ? [top[0], top[1], values.length] : null;
}

// '대부분' only when the most common life is held by more than half of the leaders.
const mostly = (entry) => (entry[1] * 2 > entry[2] ? '대부분' : '주로');

function resolveToday(today) {
  return toDateKey(today) || '1970-01-01';
}

// Numbers shared by the article, SEO copy and FAQ.
export function getStarterDeckStats(series, cards, today, topics) {
  const todayKey = resolveToday(today);
  const decks = collectStarterDecks(series, cards, topics);
  const krDecks = decks.filter((deck) => deck.hasKr && (!deck.krDate || deck.krDate <= todayKey));
  const krUpcoming = decks.filter((deck) => deck.hasKr && deck.krDate > todayKey).sort((a, b) => a.krDate.localeCompare(b.krDate) || a.number.localeCompare(b.number));
  const jpDecks = decks.filter((deck) => deck.hasJp && (!deck.jpDate || deck.jpDate <= todayKey));
  const jpOnly = jpDecks.filter((deck) => !deck.hasKr);
  const krByDate = krDecks.filter((deck) => deck.krDate).sort((a, b) => b.krDate.localeCompare(a.krDate) || b.number.localeCompare(a.number));
  const latestKr = krByDate[0] || null;
  const maxKr = krDecks.length ? Math.max(...krDecks.map((deck) => Number(deck.number))) : 0;
  const krNumbers = new Set(krDecks.map((deck) => Number(deck.number)));
  const krSkipped = Array.from({ length: maxKr }, (_, index) => index + 1).filter((value) => !krNumbers.has(value));

  // Leaders of Korean decks, once per card number.
  const krLeaders = [...new Map(krDecks.flatMap((deck) => deck.leaders).filter((leader) => leader.life !== null).map((leader) => [leader.cardNo || leader.name, leader])).values()];
  const singleLeaders = krLeaders.filter((leader) => leader.colors.length === 1);
  const multiLeaders = krLeaders.filter((leader) => leader.colors.length > 1);
  return {
    todayKey,
    decks,
    krDecks,
    krUpcoming,
    jpDecks,
    jpOnly,
    krByDate,
    latestKr,
    krSkipped,
    singleLeaders,
    multiLeaders,
    singleLifeMode: mode(singleLeaders.map((leader) => leader.life)),
    multiLifeMode: mode(multiLeaders.map((leader) => leader.life)),
    multiLeaderDecks: krDecks.filter((deck) => deck.leaders.length > 1),
    reprintLeaderDecks: krDecks.filter((deck) => deck.leaders.length && deck.leaders.every((leader) => /^(OP|EB|PRB)\d/.test(leader.cardNo))),
    maxLife: krLeaders.length ? Math.max(...krLeaders.map((leader) => leader.life)) : null
  };
}

function recentItems(stats) {
  const groups = new Map();
  stats.krByDate.forEach((deck) => {
    const list = groups.get(deck.krDate) || [];
    list.push(deck);
    groups.set(deck.krDate, list);
  });
  const items = stats.krUpcoming.slice(0, 2).map((deck) => `${deck.krDate} 예정: ${deck.krCode} ${deck.krName}`);
  [...groups.entries()].slice(0, RECENT_DATE_GROUPS).forEach(([date, list]) => {
    if (items.length >= 5) return;
    if (list.length === 1) {
      const [deck] = list;
      const life = deck.leaders.length === 1 && deck.leaders[0].life !== null ? `, 라이프 ${deck.leaders[0].life}` : '';
      const leader = deck.krName.includes(leaderNames(deck)) ? '' : `${leaderNames(deck)}, `;
      items.push(`${date} ${deck.krCode} ${deck.krName}: ${leader}${deckColors(deck)}${life}`);
      return;
    }
    const single = list.filter(isSingleColor).length;
    const multi = list.filter(isMultiColor).length;
    const split = [single ? `단색 ${single}종` : '', multi ? `두 색 ${multi}종` : ''].filter(Boolean).join('·');
    items.push(`${date} ${compressCodes(list.map((deck) => deck.number))} ${list.length}종 동시 발매${split ? `: ${split}` : ''}`);
  });
  return items;
}

export function buildStarterDecksEditorial(series, cards, today, topics) {
  const stats = getStarterDeckStats(series, cards, today, topics);
  const { todayKey, krDecks, jpDecks, jpOnly, latestKr } = stats;
  const krCount = krDecks.length;
  const won = STARTER_DECK_LIST_PRICE.krWon.toLocaleString('ko-KR');
  const yen = STARTER_DECK_LIST_PRICE.jpYen.toLocaleString('ko-KR');

  const listSection = { heading: '1. 한글판 스타트 덱 목록' };
  if (krCount) {
    listSection.paragraphs = [`한글판(STK)으로 나온 스타트 덱 ${krCount}종을 번호 순으로 모았습니다.`];
    listSection.table = {
      numeric: false,
      columns: ['덱', '이름', '리더', '색', '한글판 발매일'],
      rows: krDecks.map((deck) => [deck.krCode, deck.krName || '-', leaderNames(deck), deckColors(deck), deck.krDate || '-'])
    };
  } else {
    listSection.paragraphs = ['지금은 확인한 한글판 스타트 덱이 없습니다.'];
    listSection.items = ['한국 공식 일정이 갱신되면 이 목록도 다시 채워집니다.'];
  }
  listSection.links = [{ href: '/guide/release-schedule', label: '신작·발매 일정' }];

  const colorRows = COLOR_ORDER
    .map((color) => [COLOR_LABELS[color], krDecks.filter((deck) => isSingleColor(deck) && deck.leaders.every((leader) => leader.colors[0] === color))])
    .filter(([, list]) => list.length)
    .map(([label, list]) => [label, `${list.length}종`, compressCodes(list.map((deck) => deck.number))]);
  const multiDecks = krDecks.filter((deck) => deck.leaders.length && !isSingleColor(deck));
  if (multiDecks.length) colorRows.push(['두 색', `${multiDecks.length}종`, compressCodes(multiDecks.map((deck) => deck.number))]);
  const colorSection = { heading: '2. 색으로 고르기', paragraphs: ['덱에는 리더와 같은 색 카드만 넣습니다. 좋아하는 색부터 고르세요.'] };
  if (colorRows.length) colorSection.table = { numeric: false, columns: ['리더 색', '덱 수', '한글판 덱'], rows: colorRows };
  else colorSection.items = ['리더 정보를 불러오면 색별 목록을 보여 줍니다.'];

  const recent = recentItems(stats);
  const recentSection = {
    heading: '3. 최근 나온 한글판 덱',
    paragraphs: [latestKr ? `가장 최근 한글판 덱은 ${latestKr.krCode} ${latestKr.krName}입니다.` : '발매일을 확인한 한글판 덱이 아직 없습니다.'],
    items: recent.length ? recent : ['한국 공식 일정에 새 덱이 올라오면 여기에 추가됩니다.'],
    links: [{ href: '/guide/release-schedule', label: '한글판 발매 일정' }]
  };

  const jpSection = { heading: '4. 일본판에만 있는 덱' };
  if (jpOnly.length) {
    jpSection.paragraphs = [`일본판(ST)에는 있지만 한국 공식 일정에 없는 덱 ${jpOnly.length}종입니다.`];
    jpSection.table = {
      numeric: false,
      columns: ['덱', '리더', '색', '일본판 발매일'],
      rows: jpOnly.map((deck) => [deck.jpCode, leaderNames(deck), deckColors(deck), deck.jpDate || '-'])
    };
  } else {
    jpSection.paragraphs = ['지금은 일본판에만 있는 스타트 덱이 없습니다.'];
    jpSection.items = ['일본판 덱은 모두 한글판으로도 나왔습니다.'];
  }

  const criteria = [];
  if (stats.singleLifeMode && stats.multiLifeMode) {
    criteria.push(`라이프: 단색 리더는 ${mostly(stats.singleLifeMode)} ${stats.singleLifeMode[0]}, 두 색 리더는 ${mostly(stats.multiLifeMode)} ${stats.multiLifeMode[0]}입니다.`);
  }
  if (stats.maxLife !== null && stats.singleLifeMode && stats.maxLife > stats.singleLifeMode[0]) {
    const decks = krDecks.filter((deck) => deck.leaders.some((leader) => leader.life === stats.maxLife));
    criteria.push(`라이프 ${stats.maxLife} 리더 덱: ${compressCodes(decks.map((deck) => deck.number))}`);
  }
  if (stats.multiLeaderDecks.length) {
    criteria.push(`리더가 여러 장: ${stats.multiLeaderDecks.map((deck) => `${deck.krCode}(${deck.leaders.length}장)`).join('·')}`);
  }
  if (stats.reprintLeaderDecks.length) {
    criteria.push(`부스터 리더를 다시 담은 덱: ${compressCodes(stats.reprintLeaderDecks.map((deck) => deck.number))}`);
  }
  criteria.push(`정가: 한글판 ${won}원, 일본판 ${yen}엔. 판매가는 매장마다 다릅니다.`);

  const sections = [
    listSection,
    colorSection,
    recentSection,
    jpSection,
    {
      heading: '5. 고르는 기준',
      paragraphs: ['색을 정했다면 리더 카드에서 아래를 확인하세요.'],
      items: criteria.slice(0, 5),
      links: [{ href: '/guide/card-types', label: '카드 종류와 레어도' }]
    },
    {
      heading: '6. 다음 단계',
      paragraphs: ['덱을 골랐다면 아래 순서로 이어 보세요.'],
      items: [
        '룰: 턴 순서와 두웅!!(돈!!) 쓰는 법을 익힙니다.',
        '구매: 가까운 공인점이나 판매처를 찾습니다.',
        '새 덱: 한글판 발매 일정을 확인합니다.',
        '전체 흐름: 입문 가이드에서 상품 종류를 봅니다.'
      ],
      links: [
        { href: '/guide/rules', label: '룰 가이드' },
        { href: '/guide/shops', label: '구매처 가이드' },
        { href: '/guide/release-schedule', label: '신작·발매 일정' },
        { href: '/guide/getting-started', label: '입문 가이드' }
      ]
    }
  ];

  const summary = [
    { value: `${krCount}종`, label: '한글판 스타트 덱 (STK)' },
    { value: `${jpDecks.length}종`, label: '일본판 스타트 덱 (ST)' },
    latestKr
      ? { value: latestKr.krCode, label: `최신 한글판 덱 (${latestKr.krDate})` }
      : { value: '없음', label: '최신 한글판 덱' },
    { value: `${won}원`, label: `한글판 정가 (일본판 ${yen}엔)` }
  ];

  return {
    heading: `원피스카드 스타트 덱 추천·종류 정리 (한글판 ${krCount}종)`,
    reviewedAt: STARTER_DECKS_REVIEWED_AT,
    dataDate: todayKey,
    paragraphs: [
      '스타트 덱은 사서 바로 대전할 수 있는 완성 덱입니다. 한글판 덱을 리더·색별로 모았습니다.',
      `${formatKoreanDate(todayKey)} 기준 한국·일본 공식 발매 일정과 Card Pone 도감을 바탕으로 합니다.`
    ],
    summary,
    sections,
    checklist: [
      '리더 색과 라이프 먼저 확인하기',
      '한글판 STK·일본판 ST 코드 구분하기',
      '발매일은 공식 사이트에서 다시 보기'
    ]
  };
}

export function getStarterDecksSeo(series, cards, today, topics) {
  const { krDecks, jpOnly } = getStarterDeckStats(series, cards, today, topics);
  return {
    title: `원피스카드 스타트 덱 추천·종류 정리 (한글판 ${krDecks.length}종) | Card Pone`,
    description: `원피스카드 한글판 스타트 덱 ${krDecks.length}종의 리더·색·발매일을 한 표로 정리했습니다. 색으로 고르는 법, 최근 덱, 일본판에만 있는 덱 ${jpOnly.length}종과 입문 덱 고르는 기준을 담았습니다.`,
    keywords: '원피스카드 스타트덱 추천, 원피스카드 스타트덱 종류, 원피스 카드게임 입문 덱, 원피스카드 스타트 덱, 원피스카드 한글판 스타트 덱, 원피스카드 덱 추천'
  };
}

// Exactly two [question, answer] pairs; every number comes from the same stats as the article.
export function getStarterDecksFaq(series, cards, today, topics) {
  const stats = getStarterDeckStats(series, cards, today, topics);
  const { todayKey, krDecks, jpDecks, latestKr, krSkipped } = stats;
  const won = STARTER_DECK_LIST_PRICE.krWon.toLocaleString('ko-KR');
  const yen = STARTER_DECK_LIST_PRICE.jpYen.toLocaleString('ko-KR');
  const skipped = krSkipped.length ? ` ${withTopicParticle(compressCodes(krSkipped.map(pad)))} 한글판 일정에 없어 번호가 이어지지 않습니다.` : '';
  const countAnswer = `${formatKoreanDate(todayKey)} 기준 한글판은 ${krDecks.length}종, 일본판은 ${jpDecks.length}종입니다.${skipped} 정가는 한글판 ${won}원, 일본판 ${yen}엔입니다.`;
  const life = stats.singleLifeMode && stats.multiLifeMode
    ? ` 한글판 단색 리더 ${stats.singleLifeMode[2]}장 중 ${stats.singleLifeMode[1]}장이 라이프 ${stats.singleLifeMode[0]}, 두 색 리더 ${stats.multiLifeMode[2]}장 중 ${stats.multiLifeMode[1]}장이 라이프 ${stats.multiLifeMode[0]}입니다.`
    : '';
  const latest = latestKr ? ` 가장 최근 한글판 덱은 ${latestKr.krDate}에 나온 ${latestKr.krCode} ${latestKr.krName}입니다.` : '';
  return [
    ['원피스카드 스타트 덱은 몇 종류인가요?', countAnswer],
    ['원피스 카드게임 입문 덱은 어떻게 고르나요?', `덱에 넣을 수 있는 카드 색이 리더 색으로 정해지므로, 좋아하는 색의 리더가 든 덱을 먼저 고르세요.${life}${latest}`]
  ];
}
