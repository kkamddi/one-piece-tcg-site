import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cardsPath = path.join(rootDir, 'src/data/cards.json');
const seriesPath = path.join(rootDir, 'src/data/series.json');
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
const htmlPath = sourceArg?.slice('--source='.length)
  || process.env.JP_PROMO_HTML
  || 'C:/tmp/card-pone-jp-promo-current.html';
const applyChanges = process.argv.includes('--apply');
const officialOrigin = 'https://www.onepiece-cardgame.com';

function decodeHtml(value = '') {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ');
}

function stripTags(value = '') {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDiv(block, className) {
  const match = block.match(new RegExp(`<div class="${className}">([\\s\\S]*?)<\\/div>`));
  return match ? stripTags(match[1]) : '';
}

function normalizeOfficialImage(value = '') {
  if (!value) return '';
  const normalized = value.replace(/^\.\./, '').replace(/^\//, '');
  return `${officialOrigin}/${normalized}`;
}

function parseOfficialPromoCards(html) {
  const blocks = [...html.matchAll(/<dl class="modalCol" id="([^"]+)">([\s\S]*?)<\/dl>/g)];
  return blocks.map(([, modalId, block]) => {
    const info = block.match(/<div class="infoCol">\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>/);
    if (!info) return null;
    const image = block.match(/data-src="([^"]*\/card\/[^"]+)"/);
    const attribute = block.match(/<div class="attribute">[\s\S]*?alt="([^"]*)"/);
    const name = block.match(/<div class="cardName">([\s\S]*?)<\/div>/);
    const acquisition = block.match(/<div class="getInfo"><h3>[^<]*<\/h3>([\s\S]*?)<\/div>/);
    const cardNo = stripTags(info[1]);
    return {
      modalId,
      cardNo,
      rarity: stripTags(info[2]),
      category: stripTags(info[3]).toUpperCase(),
      name: name ? stripTags(name[1]) : cardNo,
      imageUrl: normalizeOfficialImage(image?.[1]),
      attribute: stripTags(attribute?.[1] || '-'),
      cost: extractDiv(block, 'cost') || '-',
      power: extractDiv(block, 'power') || '-',
      counter: extractDiv(block, 'counter') || '-',
      color: extractDiv(block, 'color') || '-',
      type: extractDiv(block, 'feature') || '-',
      effect: [extractDiv(block, 'text'), extractDiv(block, 'trigger')].filter(Boolean).join(' '),
      acquisition: acquisition ? stripTags(acquisition[1]) : ''
    };
  }).filter(Boolean);
}

function cardPrefix(cardNo = '') {
  return String(cardNo).match(/^([A-Z]+\d+)-/)?.[1] || 'PROMO';
}

function chooseBaseCard(cardsByNumber, cardNo) {
  const candidates = cardsByNumber.get(cardNo) || [];
  return candidates.find((card) => card.id === `JP::${cardNo}`)
    || candidates.find((card) => card.series !== 'JP-PROMO')
    || candidates[0]
    || null;
}

function toCatalogCard(officialCard, baseCard, seriesIds) {
  const originBaseSeriesId = baseCard?.originBaseSeriesId || cardPrefix(officialCard.cardNo);
  const preferredOriginSeries = baseCard?.originSeries || `JP-${originBaseSeriesId}`;
  const originSeries = seriesIds.has(preferredOriginSeries) ? preferredOriginSeries : 'JP-PROMO';
  const originSeriesName = baseCard?.originSeriesName || baseCard?.seriesName || 'プロモーションカード';
  return {
    id: `JP::${officialCard.modalId}`,
    locale: 'JP',
    cardNo: officialCard.cardNo,
    name: officialCard.name,
    nameEn: null,
    series: 'JP-PROMO',
    baseSeriesId: 'PROMO',
    seriesName: 'プロモーションカード',
    seriesNameEn: 'プロモーションカード',
    originSeries,
    originBaseSeriesId: originSeries === 'JP-PROMO' ? 'PROMO' : originBaseSeriesId,
    originSeriesName,
    originSeriesNameEn: baseCard?.originSeriesNameEn || originSeriesName,
    rarity: officialCard.rarity || baseCard?.rarity || '',
    category: officialCard.category || baseCard?.category || '',
    categoryKo: baseCard?.categoryKo || officialCard.category || '',
    color: officialCard.color || baseCard?.color || '',
    colorKo: officialCard.color || baseCard?.colorKo || '',
    cost: officialCard.cost || baseCard?.cost || '-',
    power: officialCard.power || baseCard?.power || '-',
    counter: officialCard.counter || baseCard?.counter || '-',
    attribute: officialCard.attribute || baseCard?.attribute || '-',
    attributeKo: baseCard?.attributeKo || officialCard.attribute || '-',
    type: officialCard.type || baseCard?.type || '-',
    effect: officialCard.effect || baseCard?.effect || '',
    imageUrl: officialCard.imageUrl,
    officialUrl: `${officialOrigin}/cardlist/?freewords=${encodeURIComponent(officialCard.cardNo)}`,
    marketPrice: null
  };
}

async function main() {
  const [html, cardsRaw, seriesRaw] = await Promise.all([
    fs.readFile(htmlPath, 'utf8'),
    fs.readFile(cardsPath, 'utf8'),
    fs.readFile(seriesPath, 'utf8')
  ]);
  const cards = JSON.parse(cardsRaw);
  const series = JSON.parse(seriesRaw);
  const officialCards = parseOfficialPromoCards(html);
  const officialIds = new Set(officialCards.map((card) => `JP::${card.modalId}`));
  const existingIds = new Set(cards.map((card) => card.id));
  const cardsByNumber = new Map();
  for (const card of cards.filter((item) => item.locale === 'JP')) {
    cardsByNumber.set(card.cardNo, [...(cardsByNumber.get(card.cardNo) || []), card]);
  }
  const seriesIds = new Set(series.map((item) => item.id));
  const additions = officialCards
    .filter((card) => !existingIds.has(`JP::${card.modalId}`))
    .map((card) => toCatalogCard(card, chooseBaseCard(cardsByNumber, card.cardNo), seriesIds));
  const invalid = additions.filter((card) => !card.id || !card.cardNo || !card.name || !card.imageUrl);
  const duplicateAdditions = additions.filter((card, index) => additions.findIndex((item) => item.id === card.id) !== index);
  const localPromoIdsAbsentFromCurrentOfficialList = cards
    .filter((card) => card.series === 'JP-PROMO' && !officialIds.has(card.id))
    .map((card) => card.id);
  const report = {
    applyChanges,
    officialPromoCards: officialCards.length,
    existingPromoCards: cards.filter((card) => card.series === 'JP-PROMO').length,
    additions: additions.length,
    invalid: invalid.length,
    duplicateAdditions: duplicateAdditions.length,
    additionIdsSample: additions.slice(0, 30).map((card) => card.id),
    localPromoIdsAbsentFromCurrentOfficialListCount: localPromoIdsAbsentFromCurrentOfficialList.length,
    localPromoIdsAbsentFromCurrentOfficialListSample: localPromoIdsAbsentFromCurrentOfficialList.slice(0, 30)
  };

  if (applyChanges) {
    if (invalid.length || duplicateAdditions.length) throw new Error('promo_addition_validation_failed');
    await fs.writeFile(cardsPath, `${JSON.stringify([...cards, ...additions], null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
