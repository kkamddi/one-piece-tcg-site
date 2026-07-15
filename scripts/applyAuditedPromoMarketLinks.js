import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cardMarketLinks from '../src/data/card-market-links.js';
import marketCards from '../src/data/market-cards.js';
import cards from '../src/data/cards.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const linksPath = path.join(rootDir, 'src/data/card-market-links.js');
const auditArg = process.argv.find((arg) => arg.startsWith('--audit='));
const auditPath = auditArg?.slice('--audit='.length)
  || process.env.PROMO_AUDIT_OUTPUT
  || 'C:/tmp/card-pone-promo-image-audit.json';
const applyChanges = process.argv.includes('--apply');
const includeReviewedPromo = process.argv.includes('--include-reviewed-promo');

function approved(link) {
  return link?.status === 'approved' && Number(link?.apparelId || 0) > 0;
}

function cardNoFor(card = {}) {
  return String(card.cardNo || '').trim();
}

function variantKeyFor(card = {}) {
  const cardNo = cardNoFor(card);
  const variantId = String(card.id || '').split('::')[1] || '';
  return variantId.startsWith(`${cardNo}_`) ? variantId.slice(cardNo.length + 1) : '';
}

function chooseNewMappings(audit, existingLinks, marketByApparelId) {
  const approvedCardIds = new Set(existingLinks.filter(approved).map((link) => link.cardId));
  const candidates = audit.results.filter((result) => (
    (
      result.status === 'auto_confirmed_existing_promo'
      || (includeReviewedPromo && result.status === 'manual_review_promo')
    )
    && result.bestCardId
    && !approvedCardIds.has(result.bestCardId)
  ));
  const bestByCardId = new Map();

  for (const candidate of candidates) {
    const existing = bestByCardId.get(candidate.bestCardId);
    const market = marketByApparelId.get(String(candidate.apparelId));
    const existingMarket = existing && marketByApparelId.get(String(existing.apparelId));
    const isBetter = !existing
      || candidate.bestScore > existing.bestScore
      || (
        candidate.bestScore === existing.bestScore
        && Number(market?.listingCount || 0) > Number(existingMarket?.listingCount || 0)
      );
    if (isBetter) bestByCardId.set(candidate.bestCardId, candidate);
  }
  return [...bestByCardId.values()];
}

function strongCorrections(audit) {
  const corrections = new Map();
  for (const item of audit.calibration.results || []) {
    if (item.status !== 'compared' || item.mappedRank === 1) continue;
    if (Number(item.bestScore || 0) < 0.84) continue;
    if (Number(item.bestScore || 0) - Number(item.mappedScore || 0) < 0.035) continue;
    corrections.set(String(item.apparelId), {
      apparelId: Number(item.apparelId),
      fromCardId: item.cardId,
      toCardId: item.bestCardId,
      mappedScore: item.mappedScore,
      bestScore: item.bestScore
    });
  }
  return corrections;
}

function applyCorrections(links, corrections, cardsById) {
  const corrected = [];
  const retained = [];
  const seenCorrectedApparelIds = new Set();

  for (const link of links) {
    const correction = corrections.get(String(link.apparelId));
    if (!correction || !approved(link)) {
      retained.push(link);
      continue;
    }
    if (link.cardId === correction.toCardId && !seenCorrectedApparelIds.has(String(link.apparelId))) {
      retained.push({
        ...link,
        note: `image-audited correction: ${correction.bestScore}`
      });
      seenCorrectedApparelIds.add(String(link.apparelId));
      corrected.push(correction);
      continue;
    }
    if (seenCorrectedApparelIds.has(String(link.apparelId))) {
      continue;
    }
    const card = cardsById.get(correction.toCardId);
    if (!card) throw new Error(`missing correction card: ${correction.toCardId}`);
    retained.push({
      ...link,
      cardId: correction.toCardId,
      cardNo: cardNoFor(card),
      locale: card.locale || 'JP',
      variantKey: variantKeyFor(card),
      note: `image-audited correction: ${correction.bestScore}`
    });
    seenCorrectedApparelIds.add(String(link.apparelId));
    corrected.push(correction);
  }
  return { links: retained, corrected };
}

function validateFinalLinks(links, cardsById, marketByApparelId) {
  const errors = [];
  const approvedByCardId = new Map();
  for (const link of links.filter(approved)) {
    if (!cardsById.has(link.cardId)) errors.push(`missing card ${link.cardId}`);
    if (!marketByApparelId.has(String(link.apparelId))) errors.push(`missing market product ${link.apparelId}`);
    const prior = approvedByCardId.get(link.cardId);
    if (prior && Number(prior.apparelId) !== Number(link.apparelId)) {
      errors.push(`multiple approved products for ${link.cardId}: ${prior.apparelId}, ${link.apparelId}`);
    }
    approvedByCardId.set(link.cardId, link);
  }
  return errors;
}

async function main() {
  const [auditRaw, linksRaw] = await Promise.all([
    fs.readFile(auditPath, 'utf8'),
    fs.readFile(linksPath, 'utf8')
  ]);
  const audit = JSON.parse(auditRaw);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const marketByApparelId = new Map(marketCards.map((item) => [String(item.apparelId), item]));
  const corrections = strongCorrections(audit);
  const correctionResult = applyCorrections(cardMarketLinks, corrections, cardsById);
  const newMappingCandidates = chooseNewMappings(audit, correctionResult.links, marketByApparelId);
  const additions = newMappingCandidates.map((candidate) => {
    const card = cardsById.get(candidate.bestCardId);
    if (!card) throw new Error(`missing audited card: ${candidate.bestCardId}`);
    return {
      cardId: candidate.bestCardId,
      cardNo: cardNoFor(card),
      locale: card.locale || 'JP',
      variantKey: variantKeyFor(card),
      apparelId: Number(candidate.apparelId),
      status: 'approved',
      note: `image-audited promo mapping: score ${candidate.bestScore}, ${candidate.setName || candidate.name || ''}`.trim()
    };
  });
  const finalLinks = [...correctionResult.links, ...additions];
  const errors = validateFinalLinks(finalLinks, cardsById, marketByApparelId);
  const report = {
    applyChanges,
    includeReviewedPromo,
    beforeLinks: cardMarketLinks.length,
    afterLinks: finalLinks.length,
    correctedMappings: correctionResult.corrected.length,
    correctionDetails: correctionResult.corrected,
    addedMappings: additions.length,
    additionSample: additions.slice(0, 20).map(({ cardId, apparelId }) => ({ cardId, apparelId })),
    includesP150: additions.some((link) => link.cardId === 'JP::P-150'),
    includesP151: additions.some((link) => link.cardId === 'JP::P-151'),
    validationErrors: errors
  };

  if (applyChanges) {
    if (errors.length) throw new Error(`market_link_validation_failed: ${errors.slice(0, 5).join('; ')}`);
    const eol = linksRaw.includes('\r\n') ? '\r\n' : '\n';
    const output = `const cardMarketLinks = ${JSON.stringify(finalLinks, null, 2)};\n\nexport default cardMarketLinks;\n`
      .replaceAll('\n', eol);
    await fs.writeFile(linksPath, output, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
