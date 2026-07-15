import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import existingLinks from '../src/data/card-market-links.js';
import marketCards from '../src/data/market-cards.js';
import existingCards from '../src/data/cards.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const linksPath = path.join(rootDir, 'src/data/card-market-links.js');
const auditArg = process.argv.find((arg) => arg.startsWith('--audit='));
const auditPath = auditArg?.slice('--audit='.length)
  || 'tmp/card-pone-promo-image-audit-manual-final.json';
const applyChanges = process.argv.includes('--apply');

// These matches were visually checked against the SNKRDUNK image and official card image.
const reviewedOfficialMappings = new Map(Object.entries({
  105504: 'JP::ST03-008_p1',
  110718: 'JP::ST01-006_p2',
  117171: 'JP::OP03-001_p2',
  118013: 'JP::ST07-008_p1',
  129619: 'JP::P-041',
  129628: 'JP::ST07-008_p3',
  134319: 'JP::ST01-007_p5',
  134321: 'JP::ST01-006_p4',
  138421: 'JP::P-053',
  138423: 'JP::P-055',
  161041: 'JP::ST01-015_p3',
  171995: 'JP::ST01-001_p4',
  229662: 'JP::ST04-008_p1',
  229663: 'JP::ST06-006_p1',
  229664: 'JP::OP03-102_p1',
  229666: 'JP::OP01-035_p1',
  229668: 'JP::ST04-011_p1',
  250565: 'JP::P-078',
  252660: 'JP::ST02-010_p2',
  277359: 'JP::OP03-114_p2',
  348126: 'JP::OP07-109_p2',
  362048: 'JP::OP07-109_p3',
  397092: 'JP::P-084',
  405261: 'JP::P-085',
  511631: 'JP::OP07-097_p3',
  752789: 'JP::OP06-068_p2'
}).map(([apparelId, cardId]) => [Number(apparelId), cardId]));

// Existing approved links that pointed at an Asia or unrelated product are corrected to JP.
const correctedExistingMappings = new Map(Object.entries({
  98594: 'JP::P-003',
  117170: 'JP::OP01-120_p4',
  129630: 'JP::OP01-016_p5',
  165933: 'JP::OP01-070_p2',
  165934: 'JP::OP06-093_p2',
  214905: 'JP::EB01-012_p2',
  503437: 'JP::EB02-048',
  158356: 'JP::OP06-062',
  168873: 'JP::ST13-008_p1',
  845068: 'JP::P-108'
}).map(([apparelId, cardId]) => [Number(apparelId), cardId]));

const extraSyntheticProducts = new Map([
  [105503, 'JP::P-003'],
  [135442, 'JP::OP01-016_p5'],
  [174951, 'JP::P-042']
]);

const excludedProducts = new Map(Object.entries({
  134162: 'SNKRDUNK Coming Soon placeholder image',
  222161: 'Asia product',
  254302: 'Chinese card',
  254303: 'Chinese card',
  254304: 'Chinese card',
  254305: 'Chinese card',
  254306: 'Chinese card',
  254307: 'Chinese card',
  254308: 'Chinese card',
  287696: 'Asia product',
  287698: 'Asia product',
  287700: 'Asia product',
  327040: 'Asia product',
  406437: 'Asia product',
  663314: 'Asia product',
  675682: 'Asia product',
  769470: 'English Treasure Cup card'
}).map(([apparelId, reason]) => [Number(apparelId), reason]));

const reviewStatuses = new Set([
  'manual_review_low_confidence',
  'manual_review_regular_match',
  'catalog_card_number_missing'
]);

function approved(link) {
  return link?.status === 'approved' && Number(link?.apparelId || 0) > 0;
}

function variantKeyFor(card = {}) {
  const cardNo = String(card.cardNo || '').trim();
  const variantId = String(card.id || '').split('::')[1] || '';
  return variantId.startsWith(`${cardNo}_`) ? variantId.slice(cardNo.length + 1) : '';
}

function inferredRarity(market = {}, baseCard = {}) {
  const match = String(market.name || '').match(/\b(SEC|SP|SR|UC|R|C|L|P)\b/i);
  return String(match?.[1] || baseCard.rarity || 'P').toUpperCase();
}

function inferredCategory(market = {}, baseCard = {}) {
  if (/\bL\s*(?::|\[)/i.test(String(market.name || ''))) return 'LEADER';
  return baseCard.category || 'CHARACTER';
}

function syntheticCardId(cardNo, apparelId) {
  const normalized = String(cardNo || 'PROMO').replaceAll(/[^A-Z0-9-]/gi, '-');
  return `JP::${normalized}_snkr${apparelId}`;
}

function productCardNo(result, market) {
  const value = String(result?.cardNo || market?.code || '').trim().toUpperCase();
  if (!value || value === 'P') return `PROMO-${market.apparelId}`;
  return value;
}

function cleanImageUrl(url) {
  return String(url || '').replace(/\?.*$/, '');
}

function createSyntheticCard({ result = {}, market, baseCard = {}, baseSeriesCard }) {
  const cardNo = productCardNo(result, market);
  const useRegularSeries = /^Booster Pack/i.test(String(market.setName || ''));
  const seriesCard = useRegularSeries ? (baseSeriesCard || baseCard) : null;
  const series = useRegularSeries
    ? (seriesCard?.originSeries || seriesCard?.series || baseCard.originSeries || baseCard.series || 'JP-PROMO')
    : 'JP-PROMO';
  const baseSeriesId = useRegularSeries
    ? (seriesCard?.originBaseSeriesId || seriesCard?.baseSeriesId || baseCard.originBaseSeriesId || baseCard.baseSeriesId || 'PROMO')
    : 'PROMO';
  const seriesName = useRegularSeries
    ? (seriesCard?.originSeriesName || seriesCard?.seriesName || baseCard.originSeriesName || baseCard.seriesName || market.setName)
    : 'プロモーションカード';

  return {
    ...baseCard,
    id: syntheticCardId(cardNo, market.apparelId),
    locale: 'JP',
    cardNo,
    name: baseCard.name || 'モンキー・D・ルフィ',
    nameEn: baseCard.nameEn || String(market.name || '').split(/\s+(?:SEC|SP|SR|UC|R|C|L|P)\b/i)[0] || null,
    series,
    baseSeriesId,
    seriesName,
    seriesNameEn: useRegularSeries ? (seriesCard?.seriesNameEn || market.setName) : 'Promotional Card',
    originSeries: useRegularSeries ? series : (baseCard.originSeries || 'JP-PROMO'),
    originBaseSeriesId: useRegularSeries ? baseSeriesId : (baseCard.originBaseSeriesId || 'PROMO'),
    originSeriesName: useRegularSeries ? seriesName : (baseCard.originSeriesName || 'プロモーションカード'),
    originSeriesNameEn: market.setName || baseCard.originSeriesNameEn || 'Promotional Card',
    rarity: inferredRarity(market, baseCard),
    category: inferredCategory(market, baseCard),
    categoryKo: baseCard.categoryKo || inferredCategory(market, baseCard),
    color: baseCard.color || '',
    colorKo: baseCard.colorKo || baseCard.color || '',
    cost: baseCard.cost || '',
    power: baseCard.power || '',
    counter: baseCard.counter || '',
    attribute: baseCard.attribute || '',
    attributeKo: baseCard.attributeKo || baseCard.attribute || '',
    type: baseCard.type || '',
    effect: baseCard.effect || '',
    imageUrl: cleanImageUrl(market.previewImageUrl),
    officialUrl: baseCard.officialUrl || `https://www.onepiece-cardgame.com/cardlist/?freewords=${encodeURIComponent(cardNo)}`,
    marketPrice: null,
    promoSetName: market.setName || '',
    promoApparelId: Number(market.apparelId)
  };
}

function upsertApprovedLink(links, card, market, note) {
  const next = links.filter((link) => (
    link.cardId !== card.id
    && !(approved(link) && Number(link.apparelId) === Number(market.apparelId))
  ));
  next.push({
    cardId: card.id,
    cardNo: card.cardNo,
    locale: 'JP',
    variantKey: variantKeyFor(card),
    apparelId: Number(market.apparelId),
    status: 'approved',
    note
  });
  return next;
}

function validate(cards, links, marketById) {
  const errors = [];
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const approvedCards = new Map();
  const approvedProducts = new Map();
  for (const link of links.filter(approved)) {
    if (!cardsById.has(link.cardId)) errors.push(`missing card: ${link.cardId}`);
    if (!marketById.has(Number(link.apparelId))) errors.push(`missing product: ${link.apparelId}`);
    if (approvedCards.has(link.cardId)) errors.push(`duplicate approved card: ${link.cardId}`);
    if (approvedProducts.has(Number(link.apparelId))) errors.push(`duplicate approved product: ${link.apparelId}`);
    approvedCards.set(link.cardId, link.apparelId);
    approvedProducts.set(Number(link.apparelId), link.cardId);
  }
  return errors;
}

async function main() {
  const [auditRaw, cardsRaw, linksRaw] = await Promise.all([
    fs.readFile(auditPath, 'utf8'),
    fs.readFile(cardsPath, 'utf8'),
    fs.readFile(linksPath, 'utf8')
  ]);
  const audit = JSON.parse(auditRaw);
  const auditResults = audit.results || audit.rows || audit.items || [];
  const marketById = new Map(marketCards.map((market) => [Number(market.apparelId), market]));
  const cards = [...existingCards];
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  let links = [...existingLinks];
  const createdCards = [];
  const mappedCards = [];
  const excluded = [];

  const ensureSynthetic = (apparelId, baseCardId, result = {}) => {
    const market = marketById.get(Number(apparelId));
    if (!market) throw new Error(`missing market product ${apparelId}`);
    const baseCard = cardsById.get(baseCardId || result.bestCardId)
      || cards.find((card) => card.locale === 'JP' && card.cardNo === productCardNo(result, market))
      || {};
    const baseSeriesCard = cards.find((card) => (
      card.locale === 'JP'
      && card.cardNo === productCardNo(result, market)
      && card.series !== 'JP-PROMO'
    ));
    const card = createSyntheticCard({ result, market, baseCard, baseSeriesCard });
    if (!cardsById.has(card.id)) {
      cards.push(card);
      cardsById.set(card.id, card);
      createdCards.push({ cardId: card.id, apparelId: Number(apparelId), setName: market.setName });
    }
    links = upsertApprovedLink(
      links,
      cardsById.get(card.id),
      market,
      `manual image review: distinct market promo, ${market.setName || market.name}`
    );
  };

  for (const [apparelId, baseCardId] of extraSyntheticProducts) {
    ensureSynthetic(apparelId, baseCardId);
  }

  for (const result of auditResults.filter((item) => reviewStatuses.has(item.status))) {
    const apparelId = Number(result.apparelId);
    if (excludedProducts.has(apparelId)) {
      excluded.push({ apparelId, reason: excludedProducts.get(apparelId) });
      continue;
    }
    const cardId = reviewedOfficialMappings.get(apparelId);
    if (!cardId) {
      ensureSynthetic(apparelId, result.bestCardId, result);
      continue;
    }
    const card = cardsById.get(cardId);
    const market = marketById.get(apparelId);
    if (!card || !market) throw new Error(`missing reviewed mapping ${apparelId} -> ${cardId}`);
    links = upsertApprovedLink(
      links,
      card,
      market,
      `manual image review: official variant, ${market.setName || market.name}`
    );
    mappedCards.push({ apparelId, cardId });
  }

  for (const [apparelId, cardId] of correctedExistingMappings) {
    const card = cardsById.get(cardId);
    const market = marketById.get(apparelId);
    if (!card || !market) throw new Error(`missing corrected mapping ${apparelId} -> ${cardId}`);
    links = upsertApprovedLink(
      links,
      card,
      market,
      `manual regional correction: JP product, ${market.setName || market.name}`
    );
    mappedCards.push({ apparelId, cardId });
  }

  const validationErrors = validate(cards, links, marketById);
  const report = {
    applyChanges,
    beforeCards: existingCards.length,
    afterCards: cards.length,
    createdCards: createdCards.length,
    mappedOfficialCards: mappedCards.length,
    excludedProducts: excluded.length,
    beforeApprovedLinks: existingLinks.filter(approved).length,
    afterApprovedLinks: links.filter(approved).length,
    validationErrors,
    createdSample: createdCards.slice(0, 12),
    excluded
  };

  if (applyChanges) {
    if (validationErrors.length) {
      throw new Error(`reviewed_promo_validation_failed: ${validationErrors.slice(0, 8).join('; ')}`);
    }
    const cardsEol = cardsRaw.includes('\r\n') ? '\r\n' : '\n';
    const linksEol = linksRaw.includes('\r\n') ? '\r\n' : '\n';
    const cardsOutput = `${JSON.stringify(cards, null, 2)}\n`.replaceAll('\n', cardsEol);
    const linksOutput = `const cardMarketLinks = ${JSON.stringify(links, null, 2)};\n\nexport default cardMarketLinks;\n`
      .replaceAll('\n', linksEol);
    await Promise.all([
      fs.writeFile(cardsPath, cardsOutput, 'utf8'),
      fs.writeFile(linksPath, linksOutput, 'utf8')
    ]);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
