import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cardMarketLinks from '../src/data/card-market-links.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardsPath = path.join(rootDir, 'src', 'data', 'cards.json');
const outDir = path.join(rootDir, 'data', 'psa10-targets');
const outPath = path.join(outDir, 'jp-op-pr-targets.json');

const cards = JSON.parse(await readFile(cardsPath, 'utf8'));
const approvedMarketLinks = new Map(
  cardMarketLinks
    .filter((link) => link?.status === 'approved' && link?.cardId)
    .map((link) => [link.cardId, link])
);

function cardNo(card) {
  return String(card?.cardNo || '').toUpperCase();
}

function rarity(card) {
  return String(card?.rarity || '').trim().toUpperCase();
}

function isExcludedOpRarity(card) {
  return ['C', 'UC', 'U'].includes(rarity(card));
}

function uniqueById(list) {
  return [...new Map(list.map((card) => [card.id || card.cardId, card])).values()];
}

function toTarget(card, scope) {
  const marketLink = approvedMarketLinks.get(card.id) || null;
  return {
    cardId: card.id,
    cardNo: card.cardNo,
    locale: card.locale,
    scope,
    rarity: card.rarity,
    name: card.name,
    series: card.series,
    baseSeriesId: card.baseSeriesId,
    seriesName: card.seriesName,
    imageUrl: card.imageUrl,
    snkrdunkApparelId: marketLink?.apparelId || null,
    snkrdunkSourceUrl: marketLink?.apparelId
      ? `https://snkrdunk.com/en/trading-cards/${marketLink.apparelId}?slide=right`
      : null,
    psaSpecUrl: null,
    psaStatus: 'needs_spec_match',
  };
}

const jpCards = cards.filter((card) => String(card.locale).toUpperCase() === 'JP');
const opTargets = uniqueById(
  jpCards.filter((card) => /^OP\d{2}-/.test(cardNo(card)) && !isExcludedOpRarity(card))
);
const prTargets = uniqueById(jpCards.filter((card) => /^P-/.test(cardNo(card))));
const targets = uniqueById([
  ...opTargets.map((card) => toTarget(card, 'OP')),
  ...prTargets.map((card) => toTarget(card, 'PR')),
]);

const summary = {
  generatedAt: new Date().toISOString(),
  rule: {
    locale: 'JP',
    op: 'cardNo OPxx-xxx, excluding C/UC/U',
    pr: 'cardNo P-xxx, all rarities',
  },
  counts: {
    op: opTargets.length,
    pr: prTargets.length,
    total: targets.length,
    withApprovedSnkrdunkMapping: targets.filter((target) => target.snkrdunkApparelId).length,
    needsSnkrdunkMapping: targets.filter((target) => !target.snkrdunkApparelId).length,
  },
  rarities: [...new Set(targets.map((target) => target.rarity))].sort(),
};

await mkdir(outDir, { recursive: true });
await writeFile(outPath, JSON.stringify({ summary, targets }, null, 2), 'utf8');

console.log(JSON.stringify(summary, null, 2));
