// Builds the /guide/release-schedule article from src/data/topics.json (official JP/KR release calendar).
// Pure and deterministic: the same topics + today always give the same object, so the daily data refresh keeps it current.
// Plain ES module without browser or Node APIs; shared by the React app and the Pages Functions middleware.

export const RELEASE_SCHEDULE_REVIEWED_AT = '2026-10-07';

const DAY_MS = 86400000;
const AVERAGE_MONTH_DAYS = 30.44;
const UPCOMING_ROW_LIMIT = 12;
const RECENT_GAP_COUNT = 6;
const GAP_TABLE_ROWS = 8;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const BOOSTER_FAMILIES = new Set(['OP', 'EB', 'PRB']);
const FAMILY_ORDER = { OP: 0, EB: 1, PRB: 2, ST: 3 };
// JP codes look like 【OP-18】/【EB-05】/【ST-29】/【PRB-02】; KR codes add K: [OPK-14]/[EBK-04]/[STK-29].
const RELEASE_CODE_PATTERN = /(?<![A-Z])(PRB|OP|EB|ST)(K)?-?(\d{2})(?!\d)/;
const GENERIC_IMAGE_PATTERN = /\/common\/thumbnail\/|\/images\/mainImg\.png/i;

export function toDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function toUtcTime(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function daysBetween(fromKey, toKey) {
  return Math.round((toUtcTime(toKey) - toUtcTime(fromKey)) / DAY_MS);
}

export function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function toMonths(days) {
  return Math.round((days / AVERAGE_MONTH_DAYS) * 10) / 10;
}

function formatDays(days) {
  return `${Math.round(days)}일`;
}

function formatDaysWithMonths(days) {
  return `${formatDays(days)} (약 ${toMonths(days)}개월)`;
}

function formatTableDate(dateKey) {
  return `${dateKey} (${WEEKDAYS[new Date(toUtcTime(dateKey)).getUTCDay()]})`;
}

function formatKoreanDate(dateKey, todayKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const monthDay = `${month}월 ${day}일`;
  return todayKey && todayKey.slice(0, 4) === dateKey.slice(0, 4) ? monthDay : `${year}년 ${monthDay}`;
}

// Same idea as getCalendarProductCode in src/RenewApp.jsx, but folds the Korean K suffix so OPK-14 pairs with OP-14.
export function getReleaseCode(title) {
  const match = String(title || '').toUpperCase().match(RELEASE_CODE_PATTERN);
  if (!match) return null;
  const [, family, krSuffix, number] = match;
  return { family, number, key: `${family}${number}`, display: `${family}${krSuffix ? 'K' : ''}-${number}`, base: `${family}-${number}` };
}

function getKindLabel(item) {
  const title = String(item.title || '');
  const family = item.code?.family;
  if (family === 'OP') return '정규 부스터';
  if (family === 'EB') return '엑스트라 부스터';
  if (family === 'PRB') return '프리미엄 부스터';
  if (family === 'ST') {
    if (/アルティメットデッキ|얼티밋 덱/.test(title)) return '얼티밋 덱';
    if (/スタートデッキ\s*EX|스타트 덱 EX/i.test(title)) return '스타트 덱 EX';
    return '스타트 덱';
  }
  if (/デッキ|DECK/i.test(String(item.category || '')) || /デッキ|덱/.test(title)) return '덱';
  if (/カードコレクション|카드 컬렉션|カードセット|카드 세트|PRECIOUS BOX|ブースター/i.test(title)) return '카드 수록 상품';
  return '공식 굿즈';
}

function isCardProduct(item) {
  return item.kind !== '공식 굿즈';
}

function getProductName(item) {
  let title = String(item.title || '').replace(/\s+/g, ' ').trim();
  if (item.code) {
    title = title
      .replace(/【[^】]*】|\[[^\]]*\]/g, ' ')
      .replace(/^(ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ\s*EX|スタートデッキ|アルティメットデッキ)/, '')
      .replace(/^\s*(엑스트라 부스터 팩|프리미엄 부스터 팩|부스터 팩|스타트 덱|얼티밋 덱)/, '')
      .trim();
    return `${item.code.display} ${title}`.trim();
  }
  return title.replace(/^(ONE PIECEカードゲーム|원피스 카드게임)\s*/, '').trim() || title;
}

function getPriorityRank(item) {
  return { high: 0, medium: 1, low: 2 }[item.priority] ?? 1;
}

function compareByDate(a, b) {
  return a.date.localeCompare(b.date)
    || Number(isCardProduct(b)) - Number(isCardProduct(a))
    || getPriorityRank(a) - getPriorityRank(b)
    || (FAMILY_ORDER[a.code?.family] ?? 9) - (FAMILY_ORDER[b.code?.family] ?? 9)
    || a.name.localeCompare(b.name);
}

// Release rows from the official calendar: calendarKind 'release' with a scheduleDate (or date).
export function extractReleaseItems(topics) {
  const seen = new Set();
  return (Array.isArray(topics) ? topics : [])
    .filter((topic) => topic && topic.calendarKind === 'release')
    .map((topic) => {
      const locale = String(topic.locale || '').toUpperCase() === 'JP' ? 'JP' : 'KR';
      const code = getReleaseCode(topic.title);
      const base = {
        locale,
        date: toDateKey(topic.scheduleDate || topic.date),
        title: String(topic.title || ''),
        category: String(topic.category || ''),
        priority: topic.calendarPriority || '',
        url: typeof topic.url === 'string' ? topic.url : '',
        imageUrl: typeof topic.imageUrl === 'string' && topic.imageUrl && !GENERIC_IMAGE_PATTERN.test(topic.imageUrl) ? topic.imageUrl : '',
        code
      };
      const item = { ...base, kind: getKindLabel(base) };
      return { ...item, name: getProductName(item) };
    })
    .filter((item) => item.date && item.title)
    .filter((item) => {
      const key = `${item.locale}|${item.date}|${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareByDate);
}

function firstByCode(items, locale) {
  const map = new Map();
  items.filter((item) => item.locale === locale && item.code).forEach((item) => {
    const current = map.get(item.code.key);
    if (!current || item.date < current.date) map.set(item.code.key, item);
  });
  return map;
}

// Pairs JP and KR releases that share a product code (OP-14 ↔ OPK-14, EB-04 ↔ EBK-04, ST-29 ↔ STK-29).
export function pairReleases(items, todayKey) {
  const jp = firstByCode(items, 'JP');
  const kr = firstByCode(items, 'KR');
  const pairs = [...jp.values()]
    .filter((jpItem) => kr.has(jpItem.code.key))
    .map((jpItem) => {
      const krItem = kr.get(jpItem.code.key);
      return {
        key: jpItem.code.key,
        family: jpItem.code.family,
        jpCode: jpItem.code.display,
        krCode: krItem.code.display,
        jpDate: jpItem.date,
        krDate: krItem.date,
        gapDays: daysBetween(jpItem.date, krItem.date),
        krReleased: krItem.date <= todayKey
      };
    })
    .sort((a, b) => a.jpDate.localeCompare(b.jpDate) || a.key.localeCompare(b.key));
  const jpOnly = [...jp.values()].filter((item) => !kr.has(item.code.key)).sort(compareByDate);
  const krOnly = [...kr.values()].filter((item) => !jp.has(item.code.key)).sort(compareByDate);
  return { pairs, jpOnly, krOnly };
}

// Intervals between consecutive numbered main boosters (OP-n → OP-n+1) for one locale.
export function mainBoosterIntervals(items, locale) {
  const boosters = [...firstByCode(items, locale).values()]
    .filter((item) => item.code.family === 'OP')
    .sort((a, b) => Number(a.code.number) - Number(b.code.number));
  const intervals = [];
  for (let index = 1; index < boosters.length; index += 1) {
    const previous = boosters[index - 1];
    const current = boosters[index];
    if (Number(current.code.number) !== Number(previous.code.number) + 1) continue;
    intervals.push({ from: previous.code.display, to: current.code.display, fromDate: previous.date, toDate: current.date, days: daysBetween(previous.date, current.date) });
  }
  return intervals;
}

function uniqueRows(items) {
  const used = new Set();
  return items.map((item) => {
    let label = item.name;
    if (used.has(label)) label = `${label} (${item.date})`;
    used.add(label);
    return [label, formatTableDate(item.date), item.kind];
  });
}

function joinCodes(codes) {
  return codes.join('·');
}

// Topic particle after a product code read aloud in Korean (01 → 일은, 04 → 사는).
export function withTopicParticle(code) {
  const lastDigit = String(code).match(/(\d)\D*$/)?.[1];
  return `${code}${lastDigit && '013678'.includes(lastDigit) ? '은' : '는'}`;
}

function resolveToday(topics, today) {
  const key = toDateKey(today);
  if (key) return key;
  const newsDates = (Array.isArray(topics) ? topics : []).filter((topic) => topic && !topic.calendarOnly).map((topic) => toDateKey(topic.date)).filter(Boolean).sort();
  return newsDates[newsDates.length - 1] || '1970-01-01';
}

function buildUpcomingSection({ heading, items, todayKey, siteLabel, localeLabel }) {
  const todayText = formatKoreanDate(todayKey, '');
  if (!items.length) {
    return {
      heading,
      paragraphs: [`${todayText} 기준으로 ${siteLabel}에 새로 공지된 ${localeLabel} 발매 일정이 없습니다. 새 공지가 나오면 이 목록에 추가됩니다.`],
      links: [{ href: '/calendar', label: '발매 캘린더' }]
    };
  }
  const shown = items.slice(0, UPCOMING_ROW_LIMIT);
  const cardCount = items.filter(isCardProduct).length;
  const paragraphs = [`${todayText} 이후 ${siteLabel}에 발매일이 공지된 상품은 ${items.length}건이며, 그중 카드가 들어 있는 상품은 ${cardCount}건입니다.`];
  if (items.length > shown.length) paragraphs.push(`표에는 가까운 ${shown.length}건만 넣었습니다. 나머지는 발매 캘린더에서 확인하세요.`);
  const officialLinks = [];
  items.filter((item) => isCardProduct(item) && item.url).forEach((item) => {
    if (officialLinks.length < 3 && !officialLinks.some((link) => link.href === item.url)) officialLinks.push({ href: item.url, label: `${item.code ? item.code.display : item.name} 공식 상품 페이지` });
  });
  const images = items
    .filter((item) => isCardProduct(item) && item.imageUrl)
    .slice(0, 2)
    .map((item) => ({ src: item.imageUrl, alt: `${item.name} 상품 이미지`, caption: `${item.name} · ${formatKoreanDate(item.date, todayKey)} 발매` }));
  const section = {
    heading,
    paragraphs,
    table: { columns: ['제품', '발매일', '종류'], rows: uniqueRows(shown) },
    links: [...officialLinks, { href: '/calendar', label: '발매 캘린더' }]
  };
  if (images.length) section.images = images;
  return section;
}

export function buildReleaseScheduleEditorial(topics, today) {
  const todayKey = resolveToday(topics, today);
  const todayText = formatKoreanDate(todayKey, '');
  const items = extractReleaseItems(topics);
  const upcomingJp = items.filter((item) => item.locale === 'JP' && item.date >= todayKey);
  const upcomingKr = items.filter((item) => item.locale === 'KR' && item.date >= todayKey);
  const nextJp = upcomingJp.find(isCardProduct) || upcomingJp[0] || null;
  const nextKr = upcomingKr.find(isCardProduct) || upcomingKr[0] || null;

  const { pairs, jpOnly } = pairReleases(items, todayKey);
  const boosterPairs = pairs.filter((pair) => BOOSTER_FAMILIES.has(pair.family));
  const releasedBoosterPairs = boosterPairs.filter((pair) => pair.krReleased).sort((a, b) => a.krDate.localeCompare(b.krDate));
  const recentReleased = releasedBoosterPairs.slice(-RECENT_GAP_COUNT);
  const recentGapMedian = median(recentReleased.map((pair) => pair.gapDays));
  const firstPair = releasedBoosterPairs[0] || null;
  const lastPair = releasedBoosterPairs[releasedBoosterPairs.length - 1] || null;
  const announcedKrPairs = boosterPairs.filter((pair) => !pair.krReleased);
  const deckPairs = pairs.filter((pair) => pair.family === 'ST' && pair.krReleased).sort((a, b) => a.krDate.localeCompare(b.krDate));
  const latestDeckPair = deckPairs[deckPairs.length - 1] || null;
  const pendingKrBoosters = jpOnly.filter((item) => BOOSTER_FAMILIES.has(item.code.family));

  const jpIntervals = mainBoosterIntervals(items, 'JP');
  const krIntervals = mainBoosterIntervals(items, 'KR');
  const jpIntervalMedian = median(jpIntervals.map((interval) => interval.days));
  const krIntervalMedian = median(krIntervals.map((interval) => interval.days));
  const recentJpIntervals = jpIntervals.slice(-4);

  const gapSection = { heading: '3. 한국판은 일본판보다 얼마나 늦게 나오나' };
  if (!boosterPairs.length) {
    gapSection.paragraphs = ['일본판과 한국판의 제품 코드가 함께 확인되는 부스터가 아직 없어 간격을 계산하지 않았습니다.'];
  } else {
    const shownPairs = boosterPairs.slice(-GAP_TABLE_ROWS);
    const paragraphs = [`같은 제품 코드끼리 일본판과 한국판 발매일을 비교했습니다. 한국판은 OPK·EBK·STK처럼 코드에 K가 붙습니다. 두 판의 일정이 모두 확인된 부스터는 ${boosterPairs.length}종입니다.`];
    if (recentReleased.length) {
      paragraphs.push(`한국판이 이미 나온 최근 ${recentReleased.length}종을 보면 한국판은 일본판보다 중앙값 ${formatDaysWithMonths(recentGapMedian)} 늦게 나왔습니다.`);
    }
    if (firstPair && lastPair && firstPair !== lastPair) {
      const trend = lastPair.gapDays < firstPair.gapDays ? '처음보다 간격이 줄었습니다.' : lastPair.gapDays > firstPair.gapDays ? '처음보다 간격이 늘었습니다.' : '처음과 간격이 비슷합니다.';
      paragraphs.push(`한국판 첫 부스터 ${withTopicParticle(firstPair.krCode)} ${formatDaysWithMonths(firstPair.gapDays)}, 가장 최근 ${withTopicParticle(lastPair.krCode)} ${formatDaysWithMonths(lastPair.gapDays)} 늦었습니다. ${trend}`);
    }
    const firstKrItem = items.find((item) => item.locale === 'KR' && item.code);
    const krMainDates = [...firstByCode(items, 'KR').values()].filter((item) => item.code.family === 'OP').sort((a, b) => Number(a.code.number) - Number(b.code.number)).map((item) => item.date);
    const krInNumberOrder = krMainDates.length > 1 && krMainDates.every((date, index) => !index || date >= krMainDates[index - 1]);
    if (firstKrItem && krInNumberOrder && firstPair && firstPair.gapDays > 365) {
      paragraphs.push(`한국 공식 일정의 첫 상품은 ${formatKoreanDate(firstKrItem.date, '')}에 나온 ${firstKrItem.kind}입니다. 그 뒤 일본판에서 이미 나온 정규 부스터를 번호 순서대로 내 왔기 때문에 초기 간격이 길었습니다.`);
    }
    gapSection.paragraphs = paragraphs;
    gapSection.table = {
      numeric: true,
      columns: ['제품', '일본판', '한국판', '간격'],
      rows: shownPairs.map((pair) => [pair.jpCode, pair.jpDate, pair.krReleased ? pair.krDate : `${pair.krDate} 예정`, formatDaysWithMonths(pair.gapDays)])
    };
    gapSection.bars = shownPairs.map((pair) => ({ label: pair.krReleased ? pair.jpCode : `${pair.jpCode} (한국판 예정)`, value: pair.gapDays, display: formatDays(pair.gapDays) }));
    const sectionItems = [];
    announcedKrPairs.forEach((pair) => sectionItems.push(`${withTopicParticle(pair.krCode)} 공지된 발매일 기준으로 일본판보다 ${formatDays(pair.gapDays)} 늦습니다.`));
    if (latestDeckPair) sectionItems.push(`덱은 한국판이 나온 ${deckPairs.length}종의 일본판 일정이 함께 확인됩니다. 가장 최근 ${withTopicParticle(latestDeckPair.krCode)} 일본판보다 ${formatDaysWithMonths(latestDeckPair.gapDays)} 늦었습니다.`);
    if (pendingKrBoosters.length) sectionItems.push(`${withTopicParticle(joinCodes(pendingKrBoosters.map((item) => item.code.display)))} Card Pone이 확인한 한국 공식 일정에 아직 없습니다. 한국판 발매 여부와 날짜는 한국 공식 발표를 기다려야 합니다.`);
    if (sectionItems.length) gapSection.items = sectionItems;
  }

  const cadenceSection = { heading: '4. 정규 부스터는 몇 달마다 나오나' };
  if (!jpIntervals.length) {
    cadenceSection.paragraphs = ['연속된 번호의 정규 부스터 일정이 부족해 발매 간격을 계산하지 않았습니다.'];
  } else {
    const minDays = Math.min(...jpIntervals.map((interval) => interval.days));
    const maxDays = Math.max(...jpIntervals.map((interval) => interval.days));
    const announcedLast = jpIntervals[jpIntervals.length - 1].toDate > todayKey ? `(발매일이 공지된 ${jpIntervals[jpIntervals.length - 1].to} 포함) ` : '';
    const paragraphs = [`일본판 정규 부스터(OP) ${jpIntervals.length + 1}종 ${announcedLast}사이의 발매 간격은 중앙값 ${formatDaysWithMonths(jpIntervalMedian)}입니다. 가장 짧은 간격은 ${formatDays(minDays)}, 가장 긴 간격은 ${formatDays(maxDays)}입니다.`];
    if (krIntervalMedian !== null && krIntervalMedian < jpIntervalMedian && firstPair && lastPair && lastPair.gapDays < firstPair.gapDays) {
      paragraphs.push(`한국판 정규 부스터는 중앙값 ${formatDays(krIntervalMedian)} 간격으로 일본판보다 자주 나왔습니다. 그래서 두 판의 발매 차이가 줄어 왔습니다.`);
    }
    paragraphs.push('이 간격은 지난 기록입니다. 다음 발매일을 알려 주는 값이 아니며, 공식 발표 전 일정은 이 페이지에 넣지 않습니다.');
    cadenceSection.paragraphs = paragraphs;
    const stats = [{ value: formatDays(jpIntervalMedian), label: '일본판 정규 부스터 간격 중앙값' }];
    if (krIntervalMedian !== null) stats.push({ value: formatDays(krIntervalMedian), label: '한국판 정규 부스터 간격 중앙값' });
    cadenceSection.stats = stats;
    cadenceSection.items = recentJpIntervals.map((interval) => `${interval.from} → ${interval.to}: ${formatDays(interval.days)}${interval.toDate > todayKey ? ' (공지된 발매일 기준)' : ''}`);
  }

  const roadmap = (Array.isArray(topics) ? topics : [])
    .filter((topic) => topic && String(topic.locale || '').toUpperCase() === 'KR' && !topic.calendarKind && /로드맵/.test(String(topic.title || '')) && /상품|발매/.test(String(topic.title || '')) && typeof topic.url === 'string' && topic.url)
    .sort((a, b) => toDateKey(b.date).localeCompare(toDateKey(a.date)))[0];
  const cautionLinks = [
    { href: '/calendar', label: '발매 캘린더' },
    { href: '/news', label: '공식 소식' },
    { href: '/prices/boxes', label: '박스 시세' },
    { href: '/guide/booster-comparison', label: '부스터별 히트 카드 비교' },
    { href: '/guide/box-recommendation', label: '목적별 박스 비교' }
  ];
  if (roadmap) cautionLinks.splice(2, 0, { href: roadmap.url, label: '한국 공식 상품 발매 로드맵' });

  const summary = [
    nextJp
      ? { value: formatKoreanDate(nextJp.date, todayKey), label: `다음 일본판 신작 (${nextJp.code ? nextJp.code.display : nextJp.kind})` }
      : { value: '공지 없음', label: '다음 일본판 신작' },
    nextKr
      ? { value: formatKoreanDate(nextKr.date, todayKey), label: `다음 한국판 신작 (${nextKr.code ? nextKr.code.display : nextKr.kind})` }
      : { value: '공지 없음', label: '다음 한국판 신작' },
    recentGapMedian !== null
      ? { value: `약 ${Math.round(toMonths(recentGapMedian))}개월`, label: `한·일 발매 간격 중앙값 (최근 ${recentReleased.length}종)` }
      : { value: '계산 불가', label: '한·일 발매 간격 중앙값' },
    jpIntervalMedian !== null
      ? { value: formatDays(jpIntervalMedian), label: '일본판 정규 부스터 간격 중앙값' }
      : { value: '계산 불가', label: '일본판 정규 부스터 간격 중앙값' }
  ];

  const [year, month] = todayKey.split('-').map(Number);
  return {
    heading: `원피스카드 신작 발매 일정 (${year}년 ${month}월): 일본판·한국판 예정과 한국판 발매 시차`,
    reviewedAt: RELEASE_SCHEDULE_REVIEWED_AT,
    dataDate: todayKey,
    paragraphs: [
      '곧 나올 원피스카드 일본판·한국판 신작과, 한국판이 일본판보다 얼마나 늦게 나오는지 정리했습니다.',
      `${todayText} 기준 원피스 카드게임 일본 공식 사이트와 한국 공식 사이트의 상품 일정을 바탕으로 합니다. 공식 일정이 바뀌면 다음 데이터 갱신 때 함께 바뀝니다.`
    ],
    summary,
    sections: [
      buildUpcomingSection({ heading: '1. 다가오는 발매 (일본판)', items: upcomingJp, todayKey, siteLabel: '일본 공식 사이트', localeLabel: '일본판' }),
      buildUpcomingSection({ heading: '2. 다가오는 발매 (한국판)', items: upcomingKr, todayKey, siteLabel: '한국 공식 사이트', localeLabel: '한국판' }),
      gapSection,
      cadenceSection,
      {
        heading: '5. 일정 확인 시 주의할 점',
        items: [
          '발매일은 공식 공지 기준이며 연기되거나 바뀔 수 있습니다. 구매 전에 공식 상품 페이지를 다시 확인하세요.',
          '한국판 발매일은 한국 공식 사이트 발표를 따릅니다. 일본판 일정이나 지난 간격만으로 한국판 날짜를 정할 수 없습니다.',
          '예약 시작일과 입고 수량은 판매처마다 다릅니다. 발매일에 바로 구할 수 있다는 뜻은 아닙니다.',
          ...([...upcomingJp, ...upcomingKr].some((item) => /BASE SHOP/i.test(item.title)) ? ['BASE SHOP 상품처럼 판매처가 정해진 상품도 있습니다. 상품 페이지의 판매 방법을 확인하세요.'] : [])
        ],
        links: cautionLinks
      }
    ],
    checklist: [
      '발매일은 공식 상품 페이지에서 다시 확인하기',
      '한국판 일정은 한국 공식 발표를 기준으로 보기',
      '지난 발매 간격은 참고용이며 예정일이 아니라는 점 기억하기',
      '예약·입고 수량은 판매처마다 다르다는 점 감안하기'
    ]
  };
}
