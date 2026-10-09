// Shared rules for reading SNKRDUNK card products against Card Pone's latest-trade summary
// (https://www.optcgkorea.com/api/market?summary=trade-latest).
// Used by scripts/buildSeriesHitCards.mjs and artifacts/content/price-ranking-analysis.mjs.
// Plain ES module without browser or Node APIs.

export const TRADE_LATEST_API = 'https://www.optcgkorea.com/api/market?summary=trade-latest';
export const TRADE_LATEST_BASIS = 'snkrdunk_latest_trade_day_median';
export const CARD_IMAGE_BASE = 'https://cards.optcgkorea.com/cards/JP/';

export const positivePrice = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);
const normalizeName = (name) => String(name || '').normalize('NFKC').replace(/[\s・･.]/g, '');

export function isJapaneseMarketItem(item) {
  return item?.locale === 'JP' && !/\[(EN|CN|CHN)\]|\bCN\)|\(CN\b|"CN|CHN/i.test(String(item.name || ''));
}

// DON!!/sealed out, tournament prizes and serial cards ('prize') and promotional cards ('promo') out.
export function classifyScope(item) {
  const name = String(item.name || '');
  const setName = String(item.setName || '');
  if (/DON!!|Unopened|set of \d+|:Participation/i.test(name)) return 'sealedOrDon';
  if (/Serial|Prize|Best \d+|Champion|Flagship|Winner|souvenir|Top \d+|Finalist|Numbered/i.test(`${name} ${setName}`)) return 'prize';
  if (/^Promotional Card/.test(setName) || /^P-\d/.test(String(item.code || ''))) return 'promo';
  return 'card';
}

// User-confirmed manga rule: "Manga Alt Art" / "Comic Parallel" (or the site manga list) = 망가,
// except leader super parallels (L-SP) and Pirate Crew Super Parallels, which are NOT manga.
export function classifyVersion(item, cardId, mangaIds = new Set()) {
  const name = String(item.name || '');
  const token = name.match(/\s(L|SEC|SR|R|UC|C|P|TR)(-[A-Z]+)?(?=[\s:[(]|$)/) || [];
  const rarity = token[1] || null;
  const suffix = token[2] || '';
  let version;
  if (/Pirate Crew Super Parallel/i.test(name)) version = '해적단 슈퍼 패러렐';
  else if (/\sL-SP\b/.test(name)) version = '리더 슈퍼 패러렐';
  else if (/Super Parallel/i.test(name)) version = '슈퍼 패러렐';
  else if (suffix === '-RSP') version = '망가 레드';
  else if (suffix === '-GSP') version = '망가 골드';
  else if (/Comic Parallel|Manga Alt Art/i.test(name) || (cardId && mangaIds.has(cardId))) version = '망가';
  else if (suffix === '-SPC' || suffix === '-SP') version = 'SP';
  else if (suffix === '-TR' || rarity === 'TR') version = '트레저 레어';
  else if (suffix === '-P' || suffix === '-RP' || / Parallel/i.test(name)) version = '패러렐';
  else version = '기본';
  return { rarity, version };
}

export function getVersionGroup(version, rarity) {
  if (version.startsWith('망가')) return '망가';
  if (version === 'SP') return 'SP';
  if (version.endsWith('슈퍼 패러렐')) return '슈퍼 패러렐';
  if (version === '패러렐') return '패러렐';
  if (rarity === 'SEC') return 'SEC';
  return '기본·기타';
}

const RARITY_KO = { L: '리더', SEC: 'SEC', SR: 'SR', R: 'R', UC: 'UC', C: 'C', P: 'P', TR: 'TR' };

// "SEC 망가 레드", "리더 슈퍼 패러렐", "SR SP 금색". withProduct adds the storage box / premium booster note.
export function formatVersionLabel(rarity, version, item, { withProduct = true } = {}) {
  const rarityLabel = RARITY_KO[rarity] || '';
  let label = version.endsWith('슈퍼 패러렐') ? version : version === '기본' ? rarityLabel || '기본' : `${rarityLabel} ${version}`.trim();
  const name = String(item?.name || '');
  if (/Gold Background/i.test(name)) label += ' 금색';
  else if (/Silver Background/i.test(name)) label += ' 은색';
  if (withProduct) {
    const setName = String(item?.setName || '');
    if (/Storage Box Set/i.test(setName)) label += ' (스토리지 박스)';
    else if (/^Premium Booster/i.test(setName)) label += ' (프리미엄 부스터)';
  }
  return label;
}

export function getSetKind(setName) {
  const value = String(setName || '');
  if (/^Booster Pack/i.test(value)) return 'booster';
  if (/^Extra Booster/i.test(value)) return 'extra';
  if (/^Premium Booster/i.test(value)) return 'premium';
  if (/^(Start Deck|Starter Deck|Ultimate Deck)/i.test(value)) return 'deck';
  return 'other';
}

// SNKRDUNK set name -> product (booster) id such as OP13 or PRB01, voted by the catalog series of
// approved links (x3), then by card-number prefix (x1, not for premium boosters that reprint old numbers).
// Spelling variants of one product ("Wings of Captain" / "Wings Of The Captain") land on the same id;
// set names without any vote (storage box sets, special sets) map to nothing.
export function buildSetProductMap(marketCards, linkByApparel, catalogById) {
  const votes = new Map();
  const vote = (setName, id, weight) => {
    const tally = votes.get(setName) || {};
    tally[id] = (tally[id] || 0) + weight;
    votes.set(setName, tally);
  };
  for (const item of marketCards) {
    const kind = getSetKind(item.setName);
    if (item.locale !== 'JP' || kind === 'other') continue;
    const cardId = linkByApparel.get(item.apparelId);
    const base = cardId && catalogById.get(cardId)?.baseSeriesId;
    if (base && base !== 'PROMO') vote(item.setName, base, 3);
    const prefix = (String(item.code || '').match(/^((?:OP|EB|ST|PRB)\d{2})-/) || [])[1];
    if (prefix && kind !== 'premium') vote(item.setName, prefix, 1);
  }
  return new Map([...votes].map(([setName, tally]) => [setName, Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]]));
}

// Korean display names: the KR catalog name of the same card number, otherwise the most common KR name
// for the same JP name (disguise names folded), otherwise null (callers fall back to the JP name).
const NAME_ALIASES = {
  [normalizeName('ルフィ太郎')]: normalizeName('モンキー・D・ルフィ'),
  [normalizeName('ゾロ十郎')]: normalizeName('ロロノア・ゾロ'),
  [normalizeName('おナミ')]: normalizeName('ナミ'),
  [normalizeName('ソゲキング')]: normalizeName('ウソップ')
};
const KR_NAME_FALLBACK = { [normalizeName('ロックス・D・ジーベック')]: '록스 D. 지벡' };

export function buildKoreanNameResolver(catalog) {
  const jpNameByNo = new Map();
  const krNameByNo = new Map();
  for (const card of catalog) {
    const no = String(card.cardNo || '').split('_')[0];
    if (card.locale === 'JP' && !jpNameByNo.has(no)) jpNameByNo.set(no, card.name);
    if (card.locale === 'KR' && !krNameByNo.has(no)) krNameByNo.set(no, card.name);
  }
  const krByJp = new Map();
  for (const [no, jp] of jpNameByNo) {
    const kr = krNameByNo.get(no);
    if (!kr) continue;
    const key = normalizeName(jp);
    const tally = krByJp.get(key) || new Map();
    tally.set(kr, (tally.get(kr) || 0) + 1);
    krByJp.set(key, tally);
  }
  const bestKr = (key) => {
    const tally = krByJp.get(key);
    return tally ? [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  };
  return (code) => {
    const jp = jpNameByNo.get(code);
    const key = jp ? NAME_ALIASES[normalizeName(jp)] || normalizeName(jp) : null;
    return { kr: krNameByNo.get(code) || (key && (bestKr(key) || KR_NAME_FALLBACK[key])) || null, jp: jp || null, key };
  };
}

// Approved catalog link id "JP::OP13-118_p3" -> https://cards.optcgkorea.com/cards/JP/OP13-118_p3.webp
export function getCardImageUrl(cardId) {
  const match = /^JP::([A-Z0-9]+-\d{3}(?:_p\d+)?)$/.exec(String(cardId || ''));
  return match ? `${CARD_IMAGE_BASE}${match[1]}.webp` : null;
}
