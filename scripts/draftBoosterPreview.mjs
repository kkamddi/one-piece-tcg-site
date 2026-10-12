// Drafts a preview page for a newly announced JP booster (OP / EB / PRB) from its official product page.
// Daily in official-topics-sync.yml, right after the topic sync. New entries are written to
// src/data/booster-previews.auto.js as status 'draft'; nothing is shown on the site until a person
// reviews the draft and sets status to 'published'.
import { readFile, writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const AUTO_FILE = 'src/data/booster-previews.auto.js';
const OFFICIAL_ORIGIN = 'https://www.onepiece-cardgame.com';
const KINDS = {
  OP: { label: '정규 부스터', prefix: /^ブースターパック\s*/ },
  EB: { label: '엑스트라 부스터', prefix: /^エクストラブースター\s*/ },
  PRB: { label: '프리미엄 부스터', prefix: /^プレミアムブースター\s*/ }
};
const RARITY_COLUMNS = [['リーダーカード', '리더'], ['コモン', 'C'], ['アンコモン', 'UC'], ['レア', 'R'], ['スーパーレア', 'SR'], ['シークレットレア', 'SEC'], ['スペシャルカード', 'SP']];

const decode = (text) => String(text || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

// "/products/op19.html" -> { kind: 'OP', number: 19, code: 'OP-19', slug: 'op-19' }
export function parseProductUrl(url = '') {
  const match = String(url).match(/\/products\/(op|eb|prb)(\d{2})\.html/i);
  if (!match) return null;
  const kind = match[1].toUpperCase();
  const number = Number(match[2]);
  return { kind, number, code: `${kind}-${match[2]}`, slug: `${kind.toLowerCase()}-${match[2]}`, url: `${OFFICIAL_ORIGIN}/products/${match[1].toLowerCase()}${match[2]}.html` };
}

// Upcoming JP booster releases from the synced official topics that have no preview yet and no catalog set.
export function findNewReleases(topics = [], { series = [], previews = [], today }) {
  const known = new Set(previews.map((preview) => preview.slug));
  const released = new Set(series.filter((item) => item.locale === 'JP').map((item) => String(item.baseSeriesId || '').toUpperCase()));
  const found = new Map();
  for (const topic of topics) {
    if (topic.source !== 'JP_OFFICIAL') continue;
    const product = parseProductUrl(topic.url);
    if (!product || known.has(product.slug) || released.has(product.code.replace('-', ''))) continue;
    const date = topic.scheduleDate || topic.date || '';
    if (topic.calendarKind !== 'release' || date < today) continue;
    found.set(product.slug, { ...product, releaseDate: date, topicTitle: topic.title });
  }
  return [...found.values()].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
}

// Reads the product detail block: <h4>title</h4> followed by <dl><dt>label</dt><dd>value</dd></dl> rows.
export function parseProductPage(html = '') {
  const block = html.slice(Math.max(0, html.indexOf('detailColStatus')));
  const heading = decode((block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/) || [])[1]);
  const rows = Object.fromEntries([...block.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((match) => [decode(match[1]), decode(match[2])]));
  const date = (rows['発売日'] || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const price = (rows['メーカー希望小売価格'] || '').match(/([\d,]+)円/);
  const contents = (rows['内容'] || '').match(/カード(\d+)枚.*?全(\d+)種(?:\+(\d+)種)?/);
  const rarity = rows['レアリティ'] || '';
  const counts = RARITY_COLUMNS.map(([jp]) => (rarity.match(new RegExp(`${jp}：(\\d+)種`)) || [])[1] || '');
  // The features image is the box-and-pack shot the hand-made previews use; otherwise the first photo of
  // this product's own gallery (the slider just before the detail block, not the related-products list).
  const features = (html.match(/\/onepiececg\/bccard\/jp\/products\/[^"'\s)]+\/img_features_01\.(?:webp|png|jpg)/) || [])[0];
  const gallery = (html.slice(0, html.indexOf('detailColStatus')).match(/data-src="(\/onepiececg\/bccard\/jp\/products\/[^"]+)"/) || [])[1];
  const image = features || gallery || '';
  return {
    heading,
    releaseDate: date ? `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}` : '',
    priceYen: price ? Number(price[1].replace(/,/g, '')) : 0,
    cardsPerPack: contents ? Number(contents[1]) : 0,
    kinds: contents ? Number(contents[2]) : 0,
    extraKinds: contents?.[3] ? Number(contents[3]) : 0,
    rarityCounts: counts.some(Boolean) ? counts : null,
    image: image ? `${OFFICIAL_ORIGIN}${image}` : ''
  };
}

const monthDay = (date) => {
  const [, month, day] = String(date).split('-').map(Number);
  return month && day ? `${month}월 ${day}일` : '';
};

// Top cards of the previous set of the same kind, from the daily src/data/series-hit-cards.json.
export function getReferenceCards(product, hitCards) {
  const previousId = `${product.kind}${String(product.number - 1).padStart(2, '0')}`;
  const cards = (hitCards?.sets?.[previousId]?.hitCards || []).filter((card) => card.apparelId && card.singleJpy > 0)
    .sort((a, b) => b.singleJpy - a.singleJpy).slice(0, 4);
  return {
    previousCode: `${product.kind}-${previousId.slice(product.kind.length)}`,
    cards: cards.map((card) => ({ apparelId: card.apparelId, label: card.name, version: card.version, single: card.singleJpy, image: card.image })),
    dataDate: cards.map((card) => card.singleDate).sort().pop() || ''
  };
}

export function buildDraft(product, page, reference, today) {
  const kind = KINDS[product.kind];
  const setTitle = page.heading.replace(/【[^】]*】\s*$/, '').replace(kind.prefix, '').trim();
  const releaseDate = page.releaseDate || product.releaseDate;
  const date = monthDay(releaseDate);
  const kindLabel = product.kind === 'OP' ? `${product.number}번째 정규 부스터` : `${kind.label} ${product.number}탄`;
  const missing = [
    !setTitle && '세트 이름', !page.releaseDate && '발매일(공지 날짜로 대신함)', !page.priceYen && '가격', !page.kinds && '수록 종류',
    !page.image && '대표 이미지', reference.cards.length < 4 && `직전 ${reference.previousCode} 참고 카드`
  ].filter(Boolean);
  const composition = page.rarityCounts
    ? { columns: ['', ...RARITY_COLUMNS.filter((_, index) => page.rarityCounts[index]).map(([, label]) => label)], rows: [[product.code, ...page.rarityCounts.filter(Boolean)]] }
    : null;
  return {
    status: 'draft',
    autoDrafted: true,
    draftedAt: today,
    missing,
    slug: product.slug,
    code: product.code,
    setTitle,
    title: `${product.code} ${setTitle} 프리뷰`,
    lead: `${date} 발매 예정인 ${kindLabel}입니다. 공식 상품 정보와 직전 ${reference.previousCode} 시세를 모았습니다.`,
    seoTitle: `원피스카드 ${product.code} ${setTitle} 프리뷰 - 발매일·구성·공개 카드 | Card Pone`,
    seoDescription: `${date} 발매 ${product.code} ${setTitle}의 발매일·가격·수록 종류와 공개 카드, 직전 ${reference.previousCode}의 비싼 카드 시세를 정리합니다.`,
    seoKeywords: `원피스카드 ${product.code}, ${product.code.replace('-', '')}, ${setTitle}, 원피스카드 신작, 원피스카드 ${kind.label}`,
    reviewedAt: today,
    dataDate: reference.dataDate || today,
    image: page.image,
    officialUrl: product.url,
    setName: '',
    setPattern: [setTitle, product.code].filter(Boolean).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    codePattern: `^${product.code.replace('-', '')}-`,
    facts: [
      { value: date || '미정', label: '일본판 발매' },
      { value: page.priceYen ? `${page.priceYen.toLocaleString('ko-KR')}엔` : '미정', label: page.cardsPerPack ? `1팩 ${page.cardsPerPack}장` : '1팩 가격' },
      { value: page.kinds ? `${page.kinds}종` : '미정', label: page.extraKinds ? `수록 (+${page.extraKinds}종)` : '수록' },
      { value: kind.label, label: '상품 종류' }
    ],
    ...(composition ? { composition } : {}),
    reference: {
      title: `직전 ${reference.previousCode}에서 비싼 카드`,
      note: `${reference.dataDate ? `${monthDay(reference.dataDate)} 기준 ` : ''}Single 실거래 중앙값입니다.`,
      cards: reference.cards
    },
    notes: [
      '공개 카드는 SNKRDUNK 사전 등록 상품을 모은 것입니다. 공식 카드 리스트는 발매일에 공개됩니다.',
      '봉입률은 공식 자료가 없습니다. 직전 세트 시세는 참고일 뿐 가격을 보장하지 않습니다.'
    ],
    related: ['/guide/release-schedule', '/guide/booster-comparison', '/guide/box-prices'],
    revealed: []
  };
}

export function renderAutoModule(previews) {
  return `// Written by scripts/draftBoosterPreview.mjs when a new booster's official product page appears.\n// Entries start as status 'draft' and are not shown; set status to 'published' after review.\nexport const autoBoosterPreviews = ${JSON.stringify(previews, null, 2)};\n`;
}

async function importFresh(path) {
  return import(`${pathToFileURL(resolve(path)).href}?t=${Date.now()}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const readJson = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
  const [topics, series, hitCards, auto, manual] = await Promise.all([
    readJson('src/data/topics.json'),
    readJson('src/data/series.json'),
    readJson('src/data/series-hit-cards.json'),
    importFresh(AUTO_FILE).then((module) => module.autoBoosterPreviews || []),
    importFresh('lib/booster-preview.js').then((module) => module.BOOSTER_PREVIEWS || [])
  ]);
  const releases = findNewReleases(topics, { series, previews: [...manual, ...auto], today });
  const drafted = [];
  for (const product of releases) {
    const response = await fetch(product.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; CardPoneBot/1.0; +https://www.optcgkorea.com/about)' } });
    if (!response.ok) { console.log(`${product.code}: product page ${response.status}, skipped`); continue; }
    const page = parseProductPage(await response.text());
    if (!page.heading) { console.log(`${product.code}: no product block, skipped`); continue; }
    const draft = buildDraft(product, page, getReferenceCards(product, hitCards), today);
    drafted.push(draft);
    console.log(`${product.code}: drafted "${draft.title}"${draft.missing.length ? ` (missing: ${draft.missing.join(', ')})` : ''}`);
  }
  if (drafted.length) {
    await writeFile(resolve(AUTO_FILE), renderAutoModule([...auto, ...drafted]));
    if (process.env.GITHUB_OUTPUT) {
      const summary = drafted.map((draft) => `${draft.code} ${draft.setTitle} (${draft.facts[0].value} 발매)${draft.missing.length ? ` - 비어 있음: ${draft.missing.join(', ')}` : ''}`).join('\n');
      appendFileSync(process.env.GITHUB_OUTPUT, `drafted<<EOF\n${summary}\nEOF\n`);
    }
  } else {
    console.log('no new booster to draft');
  }
}
