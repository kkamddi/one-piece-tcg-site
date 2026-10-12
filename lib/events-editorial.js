// Builds the /guide/events article: official Korean event kinds and how to join (static, verified on reviewedAt),
// the official event notices still running or upcoming (src/data/topics.json, calendarKind 'event'),
// upcoming card shows (src/data/card-show-events.js) and prize card counts (src/data/collection-guide.js).
// Facts checked on 2026-10-12 against the Korean official event notices (October/November 2026), e.g.
// https://onepiece-cardgame.kr/events/view.do?brdno=6550 (교류회), 6551 (스탠다드 배틀), 6552 (플래그쉽 배틀),
// 6553 (챔피언십 점포 예선), 6592–6594 (November), the list https://onepiece-cardgame.kr/events.do
// and the PLAYGO guide https://playgo.bandainamcokorea.co.kr/ (use02.html, use04.html).
// Pure and deterministic: callers pass the data, the same inputs + today always give the same object.
// Plain ES module without browser or Node APIs; shared by the React app and the static pre-render script.
export const EVENTS_PATH = '/guide/events';
export const EVENTS_REVIEWED_AT = '2026-10-12';

export const EVENTS_OFFICIAL_URLS = {
  events: 'https://onepiece-cardgame.kr/events.do',
  officialShops: 'https://onepiece-cardgame.kr/officialshoplist.do',
  shops: 'https://onepiece-cardgame.kr/shoplist.do',
  playgo: 'https://playgo.bandainamcokorea.co.kr/'
};

export const EVENTS_SEO = {
  title: '원피스카드 대회·이벤트 정리 - 플래그십 배틀·참가 방법·카드쇼 일정 | Card Pone',
  description: '원피스카드 한국 공식 대회(교류회·스탠다드 배틀·플래그십 배틀·챔피언십 점포 예선)의 대상과 참가 조건, PLAYGO 앱 응모 방법, 진행 중인 공식 이벤트와 다가오는 카드쇼 일정을 정리했습니다.',
  keywords: '원피스카드 대회, 원피스카드 플래그십 배틀, 원피스카드 대회 참가 방법, 원피스카드 카드쇼, 원피스카드 스탠다드 배틀, 원피스카드 교류회, 원피스카드 챔피언십, 원피스 카드게임 이벤트'
};

const OFFICIAL_EVENT_URL = /^https:\/\/onepiece-cardgame\.kr\/events\/view\.do\?brdno=\d+$/;
const OFFICIAL_EVENT_ROWS = 8;
const CARD_SHOW_ROWS = 5;
const NOTICE_LINKS = 3;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function isValidDateKey(value) {
  const key = toDateKey(value);
  if (!key || key !== value) return false;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parts(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day, weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] };
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatKoreanDate(dateKey) {
  const { year, month, day } = parts(dateKey);
  return `${year}년 ${month}월 ${day}일`;
}

function monthDay(dateKey, todayKey, withWeekday = false) {
  const { year, month, day, weekday } = parts(dateKey);
  const prefix = todayKey && todayKey.slice(0, 4) === dateKey.slice(0, 4) ? '' : `${year}년 `;
  return `${prefix}${month}월 ${day}일${withWeekday ? ` (${weekday})` : ''}`;
}

// Whole calendar month → '11월 한 달'; otherwise a short range.
function formatPeriod(start, end, todayKey) {
  const from = parts(start);
  if (!end || end === start) return monthDay(start, todayKey);
  const to = parts(end);
  if (from.year === to.year && from.month === to.month && from.day === 1 && to.day === lastDayOfMonth(to.year, to.month)) {
    return `${todayKey.slice(0, 4) === start.slice(0, 4) ? '' : `${from.year}년 `}${from.month}월 한 달`;
  }
  const endText = from.year === to.year && from.month === to.month ? `${to.day}일` : monthDay(end, todayKey);
  return `${monthDay(start, todayKey)}~${endText}`;
}

function formatShowDate(start, end, todayKey) {
  const first = monthDay(start, todayKey, true);
  if (!end || end === start) return first;
  const from = parts(start);
  const to = parts(end);
  const last = from.year === to.year && from.month === to.month ? `${to.day}일 (${to.weekday})` : monthDay(end, todayKey, true);
  return `${first}~${last}`;
}

function uniqueFirstCells(rows, dates) {
  const used = new Set();
  return rows.map((row, index) => {
    let label = row[0];
    if (used.has(label)) label = `${label} (${dates[index]})`;
    used.add(label);
    return [label, ...row.slice(1)];
  });
}

// '[11월] 원피스 카드게임 플래그쉽 배틀' → '11월 플래그쉽 배틀'.
function eventName(title) {
  return String(title || '')
    .replace(/^\s*\[([^\]]+)\]\s*/, '$1 ')
    .replace(/원피스 카드게임\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Official KR event notices that are running or upcoming on today (endDate, or date, on/after today).
export function extractOfficialEvents(topics, todayKey) {
  const seen = new Set();
  return (Array.isArray(topics) ? topics : [])
    .filter((topic) => topic && topic.calendarKind === 'event' && String(topic.locale || '').toUpperCase() === 'KR' && OFFICIAL_EVENT_URL.test(String(topic.url || '')))
    .map((topic) => {
      const start = toDateKey(topic.scheduleDate || topic.date);
      const endKey = toDateKey(topic.endDate);
      return {
        name: eventName(topic.title),
        start,
        end: endKey && endKey >= start ? endKey : start,
        level: String(topic.category || '').trim(),
        url: topic.url
      };
    })
    .filter((event) => event.name && event.start && event.end >= todayKey)
    .filter((event) => {
      if (seen.has(event.url)) return false;
      seen.add(event.url);
      return true;
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

// Same checks as confirmedCardShows in src/data/card-show-events.js, plus the date filter: events whose last day is before today drop off.
export function upcomingCardShows(cardShowEvents, todayKey) {
  return (Array.isArray(cardShowEvents) ? cardShowEvents : [])
    .filter((event) => event && event.status === 'confirmed' && event.id && event.title && event.venue && event.sourceLabel
      && isValidDateKey(event.date) && isValidDateKey(event.verifiedAt)
      && (!event.endDate || (isValidDateKey(event.endDate) && event.endDate >= event.date))
      && ['KR', 'JP'].includes(event.locale) && /^https:\/\//.test(event.url || ''))
    .filter((event) => (event.endDate || event.date) >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.title).localeCompare(String(b.title)));
}

function groupCards(groups) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => (Array.isArray(group?.cards) ? group.cards : []));
}

// Prize cards listed on /guide/collection/flagship (JP tab) and /guide/collection/championship (JP + KR tabs).
export function countPrizeCards(collectionGroups) {
  const flagshipGroups = Array.isArray(collectionGroups?.flagship?.JP) ? collectionGroups.flagship.JP : [];
  const flagshipCards = groupCards(flagshipGroups).length;
  const championshipIds = [...new Set(Object.values(collectionGroups?.championship || {}).flatMap((groups) => groupCards(groups).map((card) => card.cardId)).filter(Boolean))];
  return {
    flagshipCards,
    flagshipPeriods: flagshipGroups.length,
    championshipCards: championshipIds.length,
    championshipKrCards: championshipIds.filter((id) => String(id).startsWith('KR::')).length
  };
}

function resolveToday(today) {
  return toDateKey(today) || EVENTS_REVIEWED_AT;
}

function getEventsData(cardShowEvents, topics, collectionGroups, today) {
  const todayKey = resolveToday(today);
  return {
    todayKey,
    officialEvents: extractOfficialEvents(topics, todayKey),
    cardShows: upcomingCardShows(cardShowEvents, todayKey),
    prizes: countPrizeCards(collectionGroups)
  };
}

export function buildEventsEditorial(cardShowEvents, topics, collectionGroups, today) {
  const { todayKey, officialEvents, cardShows, prizes } = getEventsData(cardShowEvents, topics, collectionGroups, today);
  const { year, month } = parts(todayKey);

  const officialSection = { heading: '4. 진행 중이거나 예정된 공식 이벤트' };
  if (officialEvents.length) {
    const shown = officialEvents.slice(0, OFFICIAL_EVENT_ROWS);
    officialSection.paragraphs = [`${monthDay(todayKey, '')} 기준 한국 공식 사이트에 공지된 이벤트입니다.`];
    officialSection.table = {
      numeric: false,
      columns: ['이벤트', '기간', '대상'],
      rows: uniqueFirstCells(shown.map((event) => [event.name, formatPeriod(event.start, event.end, todayKey), event.level || '-']), shown.map((event) => event.start))
    };
    const noticeLinks = [];
    shown.forEach((event) => {
      if (noticeLinks.length < NOTICE_LINKS && /플래그|챔피언십/.test(event.name)) noticeLinks.push({ href: event.url, label: `${event.name} 공지` });
    });
    officialSection.links = [...noticeLinks, { href: EVENTS_OFFICIAL_URLS.events, label: '공식 이벤트 목록' }];
  } else {
    officialSection.paragraphs = [`${monthDay(todayKey, '')} 기준으로 새로 확인된 공식 공지가 없습니다.`];
    officialSection.items = ['현재 확인된 일정 없음. 공식 이벤트 목록을 확인하세요.'];
    officialSection.links = [{ href: EVENTS_OFFICIAL_URLS.events, label: '공식 이벤트 목록' }];
  }

  const showSection = { heading: '5. 다가오는 카드쇼', paragraphs: ['주최 측이 날짜를 공지한 카드쇼만 모았습니다. 공식 대회와는 별개입니다.'] };
  if (cardShows.length) {
    const shown = cardShows.slice(0, CARD_SHOW_ROWS);
    showSection.table = {
      numeric: false,
      columns: ['카드쇼', '날짜', '장소'],
      rows: uniqueFirstCells(shown.map((event) => [event.titleKo || event.title, formatShowDate(event.date, event.endDate, todayKey), event.venue]), shown.map((event) => event.date))
    };
    const organizerLinks = [];
    shown.forEach((event) => {
      if (!organizerLinks.some((link) => link.href === event.url)) organizerLinks.push({ href: event.url, label: `${event.sourceLabel} 안내` });
    });
    showSection.links = [...organizerLinks, { href: '/news?section=cardshows', label: '카드쇼 일정' }];
  } else {
    showSection.items = ['현재 확인된 일정 없음. 새 공지가 확인되면 추가됩니다.'];
    showSection.links = [{ href: '/news?section=cardshows', label: '카드쇼 일정' }];
  }

  const sections = [
    {
      heading: '1. 공식 이벤트 종류',
      paragraphs: ['한국 공식 사이트에 매달 올라오는 대회입니다. 2026년 10·11월 공지 기준입니다.'],
      table: {
        numeric: false,
        columns: ['이벤트', '공식 분류', '여는 곳', '참가 조건'],
        rows: [
          ['교류회', '초보자', '공인·취급 점포', '무료, 덱 지참'],
          ['스탠다드 배틀', '초보자', '공인·취급 점포', '관련 상품 4,000원 이상 구매'],
          ['플래그십 배틀 (공식 표기 플래그쉽)', '숙련자', '공인 점포', '관련 상품 6,000원 이상 구매'],
          ['챔피언십 점포 예선', '숙련자', '개최 점포', '관련 상품 4,000원 이상 구매']
        ]
      },
      links: [
        { href: EVENTS_OFFICIAL_URLS.officialShops, label: '공인 점포 찾기' },
        { href: EVENTS_OFFICIAL_URLS.shops, label: '취급 점포 찾기' }
      ]
    },
    {
      heading: '2. 참가하면 받는 것',
      paragraphs: ['기념품은 달마다 공지에서 바뀝니다. 종류별로 받는 범위는 이렇습니다.'],
      items: [
        '교류회: 참가자 모두 참가 기념품',
        '스탠다드 배틀: 우승 프로모 카드, 입상·참가 기념 팩',
        '플래그십 배틀: 우승·8위 입상 프로모 카드, 참가 기념 팩',
        '챔피언십 점포 예선: 상위 4명에게 시즌 대회 진출권',
        `역대 상품 카드: 플래그십 ${prizes.flagshipCards}장(일본판)·챔피언십 ${prizes.championshipCards}장`
      ],
      links: [
        { href: '/guide/collection/flagship', label: '플래그십 상품 카드 목록' },
        { href: '/guide/collection/championship', label: '챔피언십 상품 카드 목록' }
      ]
    },
    {
      heading: '3. 대회 참가 방법',
      paragraphs: ['한국 공식 이벤트는 PLAYGO 앱 사전 응모가 필요합니다.'],
      items: [
        '공식 사이트 이벤트 메뉴에서 이번 달 공지를 봅니다.',
        '반다이남코코리아 PLAYGO 앱에서 원피스 카드게임을 고릅니다.',
        '응모 기간에 원하는 점포 일정에 지원하고 당첨을 확인합니다.',
        '개최 점포에서 참가 조건을 채우고, 당일 앱 QR로 체크인합니다.',
        '정원이 남으면 당일 선착순 현장 접수도 받습니다.'
      ],
      links: [
        { href: EVENTS_OFFICIAL_URLS.events, label: '공식 이벤트 목록' },
        { href: EVENTS_OFFICIAL_URLS.playgo, label: 'PLAYGO 사용 방법' }
      ]
    },
    officialSection,
    showSection,
    {
      heading: '6. 참가 전에 확인할 것',
      paragraphs: ['공식 공지의 주의사항 중 자주 놓치는 것만 골랐습니다.'],
      items: [
        '두웅!! 카드를 빼면 한글판 카드만 쓸 수 있습니다.',
        '이벤트 중에는 덱을 바꿀 수 없습니다.',
        '플래그십 배틀·챔피언십 예선은 신분증을 지참하세요.',
        '배틀 이벤트는 시작 10분 전에 접수가 마감됩니다.',
        '대리 응모와 여러 계정으로 응모하는 것은 금지입니다.'
      ],
      links: [
        { href: '/guide/rules', label: '룰 가이드' },
        { href: '/guide/starter-decks', label: '스타트 덱 고르기' },
        { href: '/guide/shops', label: '구매처 가이드' }
      ]
    }
  ];

  const nextShow = cardShows[0] || null;
  const summary = [
    { value: `${officialEvents.length}건`, label: '진행 중·예정 공식 이벤트 공지' },
    nextShow
      ? { value: monthDay(nextShow.date, todayKey), label: `다음 카드쇼 (${nextShow.titleKo || nextShow.title})` }
      : { value: '없음', label: '다음 카드쇼 (확인된 일정)' },
    { value: `${prizes.flagshipCards}장`, label: `플래그십 상품 카드 (일본판 ${prizes.flagshipPeriods}회분)` },
    { value: `${prizes.championshipCards}장`, label: `챔피언십 상품 카드 (한글판 ${prizes.championshipKrCards}장 포함)` }
  ];

  return {
    heading: `원피스카드 대회·이벤트 정리 (${year}년 ${month}월): 플래그십 배틀·참가 방법·카드쇼`,
    reviewedAt: EVENTS_REVIEWED_AT,
    dataDate: todayKey,
    paragraphs: [
      '원피스카드 공식 대회의 종류와 참가 방법, 다가오는 카드쇼 일정을 모았습니다.',
      `${formatKoreanDate(todayKey)} 기준 한국 공식 사이트 공지와 카드쇼 주최 측 공지를 바탕으로 합니다.`
    ],
    summary,
    sections,
    checklist: [
      'PLAYGO 응모 기간 확인하기',
      '참가 조건(구매 금액) 미리 보기',
      '한글판 카드로 덱 맞추기'
    ]
  };
}

export function getEventsSeo() {
  return { ...EVENTS_SEO };
}

// Exactly two [question, answer] pairs; the second follows the same card-show data as the article.
export function getEventsFaq(cardShowEvents, topics, collectionGroups, today) {
  const { todayKey, cardShows } = getEventsData(cardShowEvents, topics, collectionGroups, today);
  const nextShow = cardShows[0] || null;
  const showAnswer = nextShow
    ? `${formatKoreanDate(todayKey)} 기준 다음 카드쇼는 ${formatShowDate(nextShow.date, nextShow.endDate, todayKey)} ${nextShow.venue}에서 열리는 ${nextShow.titleKo || nextShow.title}입니다. 시간과 입장 방법은 주최 측(${nextShow.sourceLabel}) 안내에서 확인하세요.`
    : `${formatKoreanDate(todayKey)} 기준으로 주최 측이 날짜를 공지한 카드쇼가 없습니다. 새 공지가 확인되면 이 페이지에 추가됩니다.`;
  return [
    ['원피스카드 대회는 어떻게 참가하나요?', '한국 공식 이벤트는 반다이남코코리아 PLAYGO 앱으로 사전 응모합니다. 2026년 10·11월 공지 기준 교류회는 무료이고, 스탠다드 배틀은 개최 점포에서 관련 상품 4,000원 이상, 플래그십 배틀은 6,000원 이상을 사면 참가할 수 있습니다. 정원이 남으면 당일 선착순 현장 접수도 받습니다.'],
    ['원피스카드 카드쇼는 언제 열리나요?', showAnswer]
  ];
}
