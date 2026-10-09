// Builds the /guide/box-prices article from src/data/box-market-items.js and src/data/box-market-prices.json.
// The prices file is the daily SNKRDUNK listing minimum (USD) per apparelId, so the page refreshes with that data.
// Pure and deterministic: the same items + prices + today always give the same object.
// Plain ES module without browser or Node APIs; shared by the React app and the static pre-render script.
import { SERIES_GUIDE_USD_TO_KRW } from '../src/lib/series-guide-analysis.js';
import { withTopicParticle } from './release-schedule-editorial.js';

export const BOX_PRICES_PATH = '/guide/box-prices';
export const BOX_PRICES_USD_TO_KRW = SERIES_GUIDE_USD_TO_KRW;
export const BOX_PRICES_SEO = {
  title: '원피스카드 박스 가격 - 부스터 박스 시세 한눈에 (일본판) | Card Pone',
  description: '원피스카드 일본판 부스터·엑스트라·프리미엄 부스터 박스 가격을 한 표로 정리했습니다. 박스별 SNKRDUNK 등록 최저가(달러·원화 환산), 비싼 박스 순위, 한글판·일본판 1팩 정가를 매일 갱신합니다.',
  keywords: '원피스 카드 박스 가격, 원피스카드 박스 시세, 원피스 카드팩 가격, 원피스 카드 팩 가격, 원피스카드 정가, 원피스카드 박스 정가, 원피스카드 부스터 박스'
};

const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const TOP_COUNT = 5;
const STALE_DAYS = 3;
// Booster boxes only: OP-xx, EB-xx, PRB-xx (also the bot's OPC-TCG-OP-17 style codes).
// Special sets (EB-03-SP), precious boxes (-HPB) and DON!! cards end with another suffix and drop out here.
const BOX_CODE_PATTERN = /(?:^|-)(OP|EB|PRB)-(\d{2})$/i;
const FAMILY_LABELS = { OP: '부스터', EB: '엑스트라', PRB: '프리미엄' };

function toDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

// updatedAt is an ISO timestamp in UTC; the site shows dates in KST.
export function toKstDateKey(value) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return toDateKey(value);
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

function formatKoreanDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function formatUsd(value) {
  return `US$${Math.round(value).toLocaleString('en-US')}`;
}

// Rounded to 1,000 won: the rate is a fixed approximation, so smaller digits would suggest false precision.
export function formatKrw(usd) {
  return `₩${(Math.round((usd * BOX_PRICES_USD_TO_KRW) / 1000) * 1000).toLocaleString('ko-KR')}`;
}

export function getBoxCode(item) {
  const code = String(item?.code || '').toUpperCase();
  const match = code.match(BOX_CODE_PATTERN);
  if (!match || !/\bBox\b/i.test(String(item?.name || ''))) return null;
  return { family: match[1], code: `${match[1]}-${match[2]}` };
}

// One row per booster box code, newest release first. price is null until SNKRDUNK has a listing.
export function collectBoxRows(items, prices) {
  const snapshots = prices?.items || {};
  const rows = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const box = getBoxCode(item);
    if (!box) return;
    const snapshot = snapshots[String(item.apparelId)] || null;
    const usd = Number(snapshot?.minPrice);
    const row = {
      code: box.code,
      family: box.family,
      apparelId: item.apparelId,
      releaseDate: toDateKey(snapshot?.releaseDate) || toDateKey(item.releaseDate),
      price: Number.isFinite(usd) && usd > 0 ? usd : null,
      listingCount: Number(snapshot?.listingCount) || 0
    };
    const current = rows.get(box.code);
    if (!current || (current.price === null && row.price !== null)) rows.set(box.code, row);
  });
  return [...rows.values()].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.code.localeCompare(b.code));
}

function ratioText(high, low) {
  const ratio = high / low;
  return ratio >= 10 ? `${Math.round(ratio)}배` : `${Math.round(ratio * 10) / 10}배`;
}

export function buildBoxPricesEditorial(items, prices, today) {
  const dataDate = toKstDateKey(prices?.updatedAt) || toDateKey(today) || '1970-01-01';
  const todayKey = toDateKey(today) || dataDate;
  const allRows = collectBoxRows(items, prices);
  const priced = allRows.filter((row) => row.price !== null);
  const unpriced = allRows.filter((row) => row.price === null);
  const byPrice = [...priced].sort((a, b) => b.price - a.price || b.releaseDate.localeCompare(a.releaseDate));
  const top = byPrice.slice(0, TOP_COUNT);
  const highest = byPrice[0] || null;
  const lowest = byPrice[byPrice.length - 1] || null;
  const newest = priced[0] || null;
  const staleDays = daysBetween(dataDate, todayKey);
  const [year, month] = dataDate.split('-').map(Number);

  const tableSection = { heading: '1. 박스 시세 한눈에', links: [{ href: '/prices/boxes', label: '박스 시세 목록' }] };
  if (priced.length) {
    let lead = `일본판 박스 ${priced.length}종의 SNKRDUNK 등록 최저가를 최근 발매 순으로 정리했습니다.`;
    if (unpriced.length) lead += ` ${withTopicParticle(unpriced.map((row) => row.code).join('·'))} 아직 등록가가 없어 뺐습니다.`;
    tableSection.paragraphs = [lead];
    tableSection.table = {
      numeric: true,
      columns: ['박스', '종류', '발매일', '등록 최저가', '원화 환산(약)'],
      rows: priced.map((row) => [row.code, FAMILY_LABELS[row.family], row.releaseDate || '-', formatUsd(row.price), formatKrw(row.price)])
    };
  } else {
    tableSection.paragraphs = ['지금은 등록 최저가를 확인한 박스가 없습니다. 다음 갱신 때 다시 채워집니다.'];
  }

  const topSection = { heading: top.length > 1 ? `2. 비싼 박스 TOP ${top.length}` : '2. 비싼 박스' };
  if (top.length) {
    topSection.paragraphs = highest !== lowest
      ? [`가장 비싼 ${withTopicParticle(highest.code)} 가장 싼 ${lowest.code}의 약 ${ratioText(highest.price, lowest.price)}입니다.`]
      : ['등록 최저가 순서입니다.'];
    topSection.bars = top.map((row) => ({ label: row.releaseDate ? `${row.code} (${row.releaseDate.slice(0, 4)}년)` : row.code, value: row.price, display: `${formatUsd(row.price)} · 약 ${formatKrw(row.price)}` }));
  } else {
    topSection.paragraphs = ['가격을 확인한 박스가 생기면 순위를 보여 줍니다.'];
  }

  const sections = [
    tableSection,
    topSection,
    {
      heading: '3. 1팩 정가 (한글판·일본판)',
      paragraphs: ['공식 사이트에 나온 정가입니다. 실제 판매가는 매장마다 다릅니다.'],
      table: {
        columns: ['상품', '정가'],
        rows: [
          ['한글판 부스터·엑스트라 부스터', '1팩 2,000원 · 1박스(24팩) 48,000원'],
          ['일본판 부스터·엑스트라 부스터', '1팩 240엔 (6장, 세금 포함)'],
          ['일본판 프리미엄 부스터 PRB-02', '1팩 550엔 (10장)']
        ]
      },
      links: [{ href: '/guide/shops', label: '구매처 가이드' }]
    },
    {
      heading: '4. 기준과 주의할 점',
      items: [
        '일본판 박스의 SNKRDUNK 등록 최저가입니다. 실제 거래가도, 한글판 가격도 아닙니다.',
        `원화는 1달러 약 ${Math.round(BOX_PRICES_USD_TO_KRW).toLocaleString('ko-KR')}원으로 환산한 대략값입니다. 배송비·관세 등 실제 구매 비용과 다를 수 있습니다.`,
        '가격은 매일 자동으로 갱신됩니다.',
        ...(staleDays > STALE_DAYS ? [`마지막 갱신이 ${staleDays}일 전이라 현재 가격과 차이가 있을 수 있습니다.`] : []),
        'EB-03 스페셜 세트·프리셔스 박스처럼 일반 박스가 아닌 상품은 뺐습니다.',
        '지금 가격일 뿐 앞으로의 가격이나 수익을 보장하지 않습니다.'
      ],
      links: [
        { href: '/guide/box-recommendation', label: '목적별 박스 비교' },
        { href: '/guide/release-schedule', label: '신작·발매 일정' }
      ]
    }
  ];

  const summary = [
    { value: `${priced.length}종`, label: '가격을 확인한 일본판 박스' },
    highest
      ? { value: formatUsd(highest.price), label: `가장 비싼 박스 ${highest.code} (약 ${formatKrw(highest.price)})` }
      : { value: '없음', label: '가장 비싼 박스' },
    newest
      ? { value: formatUsd(newest.price), label: `최신 박스 ${newest.code} (약 ${formatKrw(newest.price)})` }
      : { value: '없음', label: '최신 박스' },
    { value: `${month}월 ${Number(dataDate.slice(8, 10))}일`, label: '등록 최저가 기준일' }
  ];

  return {
    heading: `원피스카드 박스 가격 한눈에 (${year}년 ${month}월): 일본판 부스터 박스 등록 최저가`,
    reviewedAt: dataDate,
    dataDate,
    paragraphs: [
      '원피스카드 일본판 부스터 박스 가격을 한 표로 모았습니다.',
      `SNKRDUNK 등록 최저가 기준이며 ${formatKoreanDate(dataDate)} 값입니다.`
    ],
    summary,
    sections,
    checklist: [
      '등록 최저가는 실제 거래가가 아니라는 점 기억하기',
      '한글판 박스는 정가와 매장 판매가로 따로 확인하기',
      '사기 전에 SNKRDUNK 상품 페이지에서 현재 가격 다시 보기'
    ]
  };
}
