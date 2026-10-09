// Regional "where to buy" guides (/guide/shops/<slug>), shared by the page and its pre-rendered HTML.
// Every number and store row is computed from src/data/shops.json (official ONE PIECE CARD GAME Korea store lists:
// 공인/공식 점포 = sourceType 'official', 공식 취급 점포 = sourceType 'general', same split as lib/shop-guide-editorial.js).
// No opening hours, phone numbers or stock claims: the official lists do not carry them.
// Only regions with 5 or more official stores get a page.

export const REGION_SHOP_DATA_DATE = '2026-10-09';

export const REGION_SHOP_PAGES = [
  { slug: 'seoul', sido: '서울특별시', label: '서울' },
  { slug: 'gyeonggi', sido: '경기도', label: '경기' },
  { slug: 'busan', sido: '부산광역시', label: '부산' },
  { slug: 'gyeongnam', sido: '경상남도', label: '경남' }
];

// Official list typos for a 구 name ('부산광역시 진구' is 부산진구; 부산 has no other 진구).
const GUNGU_ALIASES = {
  부산광역시: { 진구: '부산진구' }
};

// 용산역 (for the Seoul FAQ: 「용산 원피스 카드」 searches). Distances are straight-line.
const YONGSAN_STATION = { lat: 37.5298, lng: 126.9648 };

const DATE_LABEL = '2026년 10월 9일';
const compact = (value) => String(value || '').replace(/\s+/g, '');
const byKo = (a, b) => a.localeCompare(b, 'ko');

function findPage(slug) {
  return REGION_SHOP_PAGES.find((page) => page.slug === slug) || null;
}

function isMetro(sido) {
  return /(특별시|광역시)$/.test(sido);
}

// 특별시·광역시 are grouped by 구; 도 by 시·군 (경기도 'gungu' mixes 시 and 구, e.g. 분당구 = 성남시).
function areaOf(shop) {
  if (isMetro(shop.sido)) return GUNGU_ALIASES[shop.sido]?.[shop.gungu] || shop.gungu;
  const token = String(shop.address || '').trim().split(/\s+/).slice(1).find((part) => /[시군]$/.test(part));
  return token || shop.gungu;
}

function shortAddress(shop, page) {
  const tokens = String(shop.address || '').trim().split(/\s+/);
  if (tokens.length > 1 && (page.sido.startsWith(tokens[0]) || tokens[0].startsWith(page.label))) tokens.shift();
  return tokens.join(' ');
}

// One row per store. The official site lists a few stores in both lists (same name and address); merge them.
export function getRegionShopStores(shops, slug) {
  const page = findPage(slug);
  if (!page) return [];
  const merged = new Map();
  for (const shop of shops) {
    if (shop.sido !== page.sido) continue;
    const key = `${compact(shop.name)}|${compact(shop.address)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.types.add(shop.sourceType);
      existing.ids.push(shop.id);
      continue;
    }
    merged.set(key, {
      ids: [shop.id],
      name: shop.name,
      sido: shop.sido,
      area: areaOf(shop),
      address: shortAddress(shop, page),
      lat: shop.lat,
      lng: shop.lng,
      types: new Set([shop.sourceType])
    });
  }
  return [...merged.values()]
    .map((store) => ({ ...store, official: store.types.has('official'), general: store.types.has('general') }))
    .sort((a, b) => byKo(a.area, b.area) || byKo(a.name, b.name));
}

function typeLabel(store) {
  if (store.official && store.general) return '공인·취급';
  return store.official ? '공인' : '취급';
}

function countAreas(stores) {
  const counts = new Map();
  for (const store of stores) {
    const row = counts.get(store.area) || { area: store.area, total: 0, official: 0, general: 0 };
    row.total += 1;
    if (store.official) row.official += 1;
    else row.general += 1;
    counts.set(store.area, row);
  }
  return [...counts.values()].sort((a, b) => b.total - a.total || byKo(a.area, b.area));
}

// Areas for the heading: all of them when there are 4 or fewer, otherwise the top ones without splitting a tie.
function headingAreas(areas) {
  if (areas.length <= 4) return { names: areas.map((row) => row.area), more: false };
  const names = [];
  let index = 0;
  while (index < areas.length) {
    const group = areas.filter((row) => row.total === areas[index].total);
    if (names.length + group.length > 3) break;
    names.push(...group.map((row) => row.area));
    index += group.length;
  }
  if (!names.length) names.push(areas[0].area);
  return { names, more: names.length < areas.length };
}

// '부천시' -> '부천' for short labels; 구 names stay whole ('남구' must not become '남').
function stripUnit(area) {
  return /[시군]$/.test(area) && area.length > 2 ? area.slice(0, -1) : area;
}

// 'A 3곳, B·C 각 1곳'
function groupedCounts(rows) {
  const groups = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.total === row.total) last.names.push(row.area);
    else groups.push({ total: row.total, names: [row.area] });
  }
  return groups.map((group) => `${group.names.join('·')} ${group.names.length > 1 ? '각 ' : ''}${group.total}곳`).join(', ');
}

function topAreas(areas) {
  const top = areas.filter((row) => row.total === areas[0].total);
  return { top, value: top.length === 1 ? top[0].area : top.map((row) => stripUnit(row.area)).join('·') };
}

function distanceKm(a, b) {
  const rad = (degree) => (degree * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function regionFacts(shops, slug) {
  const page = findPage(slug);
  if (!page) return null;
  const stores = getRegionShopStores(shops, slug);
  const areas = countAreas(stores);
  const official = stores.filter((store) => store.official).length;
  const unit = isMetro(page.sido) ? '구' : '시';
  return { page, stores, areas, official, general: stores.length - official, unit, merged: stores.some((s) => s.official && s.general) };
}

export function buildRegionShopEditorial(shops, slug) {
  const facts = regionFacts(shops, slug);
  if (!facts || !facts.stores.length) return null;
  const { page, stores, areas, official, general, unit, merged } = facts;
  const { names, more } = headingAreas(areas);
  const { top, value: topValue } = topAreas(areas);
  const topCount = top[0].total;

  return {
    heading: `${page.label} 원피스카드 파는 곳: 공식 매장 ${stores.length}곳 (${names.join('·')}${more ? ' 등' : ''})`,
    reviewedAt: REGION_SHOP_DATA_DATE,
    dataDate: REGION_SHOP_DATA_DATE,
    paragraphs: [`${DATE_LABEL} 공식 홈페이지 점포 목록에서 ${page.label} 매장만 모았습니다.`],
    summary: [
      { value: `${stores.length}곳`, label: `${page.label} 공식 목록 매장` },
      { value: `${official}곳`, label: '공인/공식 점포' },
      { value: `${general}곳`, label: '공식 취급 점포' },
      { value: topValue, label: `매장이 가장 많은 ${unit} (${top.length > 1 ? '각 ' : ''}${topCount}곳)` }
    ],
    sections: [
      {
        heading: `1. ${page.label} 매장 목록`,
        paragraphs: [merged
          ? `${unit} 이름순이며, 두 공식 목록에 모두 있는 매장은 한 줄로 합쳤습니다.`
          : `${unit} 이름순이며, 주소는 공식 목록 표기 기준입니다.`],
        table: {
          columns: ['매장', unit, '구분', '주소'],
          rows: stores.map((store) => [store.name, store.area, typeLabel(store), store.address])
        }
      },
      {
        heading: `2. ${unit}별 매장 수`,
        paragraphs: [`${top.map((row) => row.area).join('·')}${top.length > 1 ? '가 각' : '가'} ${topCount}곳으로 가장 많습니다.`],
        table: {
          numeric: true,
          columns: [unit, '전체', '공인', '취급'],
          rows: areas.map((row) => [row.area, String(row.total), String(row.official), String(row.general)])
        }
      },
      {
        heading: '3. 방문 전 확인',
        paragraphs: ['공식 목록에는 재고와 영업시간이 없으니 가기 전에 확인하세요.'],
        items: [
          '재고·영업시간·예약 방식은 매장마다 다릅니다.',
          '공식 목록 기준이라 등록·폐점에 따라 바뀝니다.',
          '구매처 찾기의 지도 바로가기로 위치를 확인합니다.'
        ],
        links: [
          { href: '/shops', label: '구매처 찾기 (지도·내 주변순)' },
          { href: '/guide/shops', label: '원피스카드 구매처 가이드' }
        ]
      }
    ],
    checklist: [
      `가까운 ${unit}의 매장 고르기`,
      '공인점포·취급점포 구분 보기',
      '방문 전 재고·영업시간 확인하기'
    ]
  };
}

export function getRegionShopSeo(shops, slug) {
  const facts = regionFacts(shops, slug);
  if (!facts || !facts.stores.length) return null;
  const { page, stores, areas, official, general, unit } = facts;
  const { names, more } = headingAreas(areas);
  const shown = areas.filter((row) => names.includes(row.area));
  const areaKeywords = shown.slice(0, 3).map((row) => `${stripUnit(row.area)} 원피스카드`);
  const extra = slug === 'seoul' ? ['용산 원피스카드'] : [];
  return {
    title: `${page.label} 원피스카드 파는 곳 - 공식 공인점포·취급점포 ${stores.length}곳 | Card Pone`,
    description: `${page.label} 원피스카드 공식 매장 ${stores.length}곳(공인점포 ${official}·취급점포 ${general})을 ${unit}별로 정리했습니다. ${groupedCounts(shown)}${more ? ' 등' : ''}. ${DATE_LABEL} 공식 점포 목록 기준.`,
    keywords: [
      `${page.label} 원피스카드`,
      `${page.label} 원피스 카드`,
      `${page.label} 원피스카드 파는 곳`,
      `${page.label} 원피스카드 매장`,
      `${page.label} 원피스카드 공인점포`,
      ...areaKeywords,
      ...extra
    ].join(', ')
  };
}

function nearestTo(point, stores, limit) {
  return stores
    .map((store) => ({ store, km: distanceKm(point, store) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

// Two ['q', 'a'] pairs per region for lib/guide-article-faq.js.
export function getRegionShopFaq(shops, slug) {
  const facts = regionFacts(shops, slug);
  if (!facts || !facts.stores.length) return null;
  const { page, stores, areas, official, general } = facts;
  const { top } = topAreas(areas);
  const next = areas.filter((row) => row.total === areas[top.length]?.total);
  const topNames = `${top.map((row) => row.area).join('·')}${top.length > 1 ? '가 각' : '가'} ${top[0].total}곳으로 가장 많`;
  const nextNames = next.length > 3 ? `${next.slice(0, 2).map((row) => row.area).join('·')} 등이 각` : `${next.map((row) => row.area).join('·')}${next.length > 1 ? '가 각' : '가'}`;
  const topText = top.length === 1 && next.length
    ? `${topNames}고 ${nextNames} ${next[0].total}곳입니다.`
    : `${topNames}습니다.`;
  const where = [
    `${page.label}에서 원피스카드는 어디서 사나요?`,
    `${DATE_LABEL} 공식 점포 목록 기준 ${page.label}에는 ${stores.length}곳(공인점포 ${official}곳·취급점포 ${general}곳)이 있습니다. ${topText} 내 주변 매장은 구매처 찾기에서 거리순으로 볼 수 있습니다.`
  ];

  if (slug === 'seoul') {
    const yongsan = stores.filter((store) => store.area === '용산구');
    const answer = yongsan.length
      ? `공식 목록에 용산구 매장은 ${yongsan.map((store) => store.name).join('·')} ${yongsan.length}곳입니다.`
      : `${DATE_LABEL} 공식 목록에 용산구 매장은 없습니다. 용산역에서 직선거리로 가까운 곳은 `
        + nearestTo(YONGSAN_STATION, stores, 3).map(({ store, km }) => `${store.area} ${store.name}(약 ${km.toFixed(1)}km)`).join(', ')
        + '입니다.';
    return [where, ['용산에도 원피스카드 공식 매장이 있나요?', answer]];
  }

  return [
    where,
    [`${page.label} 매장에 가면 바로 살 수 있나요?`, '재고·영업시간·예약 방식은 매장마다 다르고 공식 목록에도 나오지 않습니다. 구매처 찾기의 지도 바로가기로 매장 안내를 확인한 뒤 방문하세요.']
  ];
}
