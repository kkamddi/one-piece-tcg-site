import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import cardMarketLinks from '../src/data/card-market-links.js';
import marketCards from '../src/data/market-cards.js';
import cards from '../src/data/cards.json' with { type: 'json' };

const inputArg = process.argv.find((arg) => arg.startsWith('--input='));
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const cacheArg = process.argv.find((arg) => arg.startsWith('--cache='));
const inspectCardArg = process.argv.find((arg) => arg.startsWith('--inspect-card='));
const INPUT_PATH = inputArg?.slice('--input='.length)
  || process.env.MARKET_LATEST_PATH
  || 'C:/tmp/card-pone-prod-market-latest.json';
const OUTPUT_PATH = outputArg?.slice('--output='.length)
  || process.env.PROMO_AUDIT_OUTPUT
  || 'C:/tmp/card-pone-promo-image-audit.json';
const CACHE_DIR = cacheArg?.slice('--cache='.length)
  || process.env.PROMO_IMAGE_CACHE
  || 'C:/tmp/card-pone-promo-image-cache';
const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.PROMO_AUDIT_CONCURRENCY || 6)));

const regularSourcePattern = /^(?:Booster Pack|Extra Booster|Start(?:er)? Deck|Start Dacks|Ultimate Deck|Premium Booster)/i;
const limitedSourcePattern = /(?:Premium Card Collection|Limited Card Collection|Admirable Collection|ANNIVERSARY SET|Anniversary set|Special Goods Set|FILM RED Finale Set|Encore Pack|Official Card Case|SOUND LOADER|9-Pocket Binder|Family Deck Set)/i;
const promoSourcePattern = /(?:Promotional? Card|Promotion Pack|Promotion Card|Flagship|Standard Battle|Champion(?:ship| Ship)|Tournament|Prize|Souvenir|Freebie|Supplement|All Applicants|Meetup|Visitor Benefits|Participant Gifts|Challenge Kaido|JUMP|magazine|Collaboration|Official Playmat|Treasure|Judge|Campaign|ONE PIECE DAY|BANDAI CARD GAMES Fest|8 Pack Battle|Area Finals|World Final|Learn to Play Event)/i;
const excludedForeignPattern = /(?:\[(?:CN|CHN|EN)\]|Aisa ver\.|Asia ver\.|for Asia|Treasure Cup|Japan Expo Exclusive|BVB x ONE PIECE|Los Angeles Dodgers|COLLEGE BASKETBALL)/i;
const excludedBundlePattern = /(?:Unopened set of|set of \d+ cards)/i;
const knownMislabeledProductIds = new Set([134162]);

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceCategory(item) {
  const source = String(item?.setName || item?.name || '');
  if (regularSourcePattern.test(source)) return 'regular_product';
  if (limitedSourcePattern.test(source)) return 'limited_collection';
  if (promoSourcePattern.test(source)) return 'promo_distribution';
  return 'manual_review';
}

function normalizedCardNo(item) {
  const nameMatch = String(item?.name || '').match(/\[((?:OP|ST|EB|PRB)\d{2}-\d{3,4}|P-\d{3})\]/i);
  let value = String(nameMatch?.[1] || item?.code || '')
    .toUpperCase()
    .replace(/^OPC-/, '')
    .trim();

  const extraZero = value.match(/^((?:OP|ST|EB|PRB)\d{2})-0(\d{3})$/);
  if (extraZero) value = `${extraZero[1]}-${extraZero[2]}`;
  return value;
}

function exclusionReasons(item) {
  const name = String(item?.name || '');
  const reasons = [];
  if (knownMislabeledProductIds.has(Number(item?.apparelId))) reasons.push('known_mislabeled_listing');
  if (/DON!! Card/i.test(name)) reasons.push('don_card');
  if (excludedForeignPattern.test(name)) reasons.push('non_japanese_variant');
  if (excludedBundlePattern.test(name)) reasons.push('sealed_bundle');
  return reasons;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

const downloadPromises = new Map();

async function downloadImage(url) {
  if (!url) throw new Error('missing_image_url');
  if (downloadPromises.has(url)) return downloadPromises.get(url);

  const request = (async () => {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, `${hashUrl(url)}.img`);
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 500) return filePath;
    } catch {
      // Download below.
    }

    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 CardPonePromoAudit/1.0'
          },
          signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok) throw new Error(`image_http_${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length < 500) throw new Error('image_too_small');
        await fs.writeFile(filePath, bytes);
        return filePath;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw lastError || new Error('image_download_failed');
  })();

  downloadPromises.set(url, request);
  return request;
}

const signaturePromises = new Map();

async function imageSignature(url) {
  if (signaturePromises.has(url)) return signaturePromises.get(url);
  const request = (async () => {
    const filePath = await downloadImage(url);
    const image = sharp(filePath)
      .rotate()
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
      .flatten({ background: '#ffffff' });
    const [gray, color, hashPixels] = await Promise.all([
      image.clone().resize(64, 88, { fit: 'fill' }).grayscale().normalise().raw().toBuffer(),
      image.clone().resize(16, 22, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
      image.clone().resize(9, 8, { fit: 'fill' }).grayscale().normalise().raw().toBuffer()
    ]);
    const differenceHash = [];
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const offset = row * 9 + column;
        differenceHash.push(hashPixels[offset] > hashPixels[offset + 1] ? 1 : 0);
      }
    }
    return { gray, color, differenceHash };
  })();
  signaturePromises.set(url, request);
  return request;
}

function correlation(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let sumLeft = 0;
  let sumRight = 0;
  for (let index = 0; index < length; index += 1) {
    sumLeft += left[index];
    sumRight += right[index];
  }
  const meanLeft = sumLeft / length;
  const meanRight = sumRight / length;
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < length; index += 1) {
    const leftDelta = left[index] - meanLeft;
    const rightDelta = right[index] - meanRight;
    numerator += leftDelta * rightDelta;
    leftSquare += leftDelta * leftDelta;
    rightSquare += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftSquare * rightSquare);
  return denominator ? numerator / denominator : 0;
}

function meanSimilarity(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return 1 - total / length / 255;
}

function hashSimilarity(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let equal = 0;
  for (let index = 0; index < length; index += 1) {
    if (left[index] === right[index]) equal += 1;
  }
  return equal / length;
}

function compareSignatures(left, right) {
  const grayCorrelation = (correlation(left.gray, right.gray) + 1) / 2;
  const graySimilarity = meanSimilarity(left.gray, right.gray);
  const colorSimilarity = meanSimilarity(left.color, right.color);
  const differenceHashSimilarity = hashSimilarity(left.differenceHash, right.differenceHash);
  const score = (
    grayCorrelation * 0.4
    + graySimilarity * 0.25
    + differenceHashSimilarity * 0.2
    + colorSimilarity * 0.15
  );
  return {
    score: Number(score.toFixed(5)),
    grayCorrelation: Number(grayCorrelation.toFixed(5)),
    graySimilarity: Number(graySimilarity.toFixed(5)),
    differenceHashSimilarity: Number(differenceHashSimilarity.toFixed(5)),
    colorSimilarity: Number(colorSimilarity.toFixed(5))
  };
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function compareMarketItem(item, candidates) {
  const sourceSignature = await imageSignature(item.previewImageUrl);
  const comparisons = [];
  for (const candidate of candidates) {
    try {
      const candidateSignature = await imageSignature(candidate.imageUrl);
      comparisons.push({
        cardId: candidate.id,
        series: candidate.series,
        imageUrl: candidate.imageUrl,
        ...compareSignatures(sourceSignature, candidateSignature)
      });
    } catch (error) {
      comparisons.push({
        cardId: candidate.id,
        series: candidate.series,
        imageUrl: candidate.imageUrl,
        error: String(error?.message || error)
      });
    }
  }
  return comparisons
    .filter((comparison) => Number.isFinite(comparison.score))
    .sort((left, right) => right.score - left.score);
}

function classifyComparison(comparisons) {
  const best = comparisons[0] || null;
  const second = comparisons[1] || null;
  if (!best) return { status: 'image_unavailable', best: null, margin: 0 };
  const margin = Number((best.score - Number(second?.score || 0)).toFixed(5));
  if (best.series === 'JP-PROMO' && best.score >= 0.84 && margin >= 0.035) {
    return { status: 'auto_confirmed_existing_promo', best, margin };
  }
  if (best.score >= 0.8 && margin >= 0.025) {
    return {
      status: best.series === 'JP-PROMO' ? 'manual_review_promo' : 'manual_review_regular_match',
      best,
      margin
    };
  }
  return { status: 'manual_review_low_confidence', best, margin };
}

async function main() {
  const production = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'));
  const latestItems = Array.isArray(production?.items) ? production.items : [];
  const approvedLinks = cardMarketLinks.filter((item) => item.status === 'approved' && item.apparelId);
  const approvedApparelIds = new Set(approvedLinks.map((item) => String(item.apparelId)));
  const marketByApparelId = new Map(
    marketCards.filter((item) => item.apparelId).map((item) => [String(item.apparelId), item])
  );
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const jpCardsByNumber = new Map();
  for (const card of cards.filter((item) => item.locale === 'JP')) {
    const rows = jpCardsByNumber.get(card.cardNo) || [];
    rows.push(card);
    jpCardsByNumber.set(card.cardNo, rows);
  }
  if (inspectCardArg) {
    const cardNo = inspectCardArg.slice('--inspect-card='.length).toUpperCase();
    console.log(JSON.stringify({
      catalogCards: cards.length,
      jpPromoCards: cards.filter((card) => card.series === 'JP-PROMO').length,
      cardNo,
      candidates: (jpCardsByNumber.get(cardNo) || []).map((card) => ({
        id: card.id,
        series: card.series,
        imageUrl: card.imageUrl
      }))
    }, null, 2));
    return;
  }

  const unmappedMarketItems = latestItems
    .filter((item) => !approvedApparelIds.has(String(item.apparelId)))
    .map((item) => marketByApparelId.get(String(item.apparelId)))
    .filter(Boolean);

  const scopedItems = unmappedMarketItems.filter((item) => (
    ['promo_distribution', 'limited_collection'].includes(sourceCategory(item))
  ));
  const excluded = scopedItems
    .map((item) => ({ item, reasons: exclusionReasons(item) }))
    .filter(({ reasons }) => reasons.length);
  const targets = scopedItems.filter((item) => exclusionReasons(item).length === 0);

  const calibrationLinks = uniqueBy(
    approvedLinks.filter((link) => cardsById.get(link.cardId)?.series === 'JP-PROMO'),
    (link) => String(link.apparelId)
  );
  const calibrationResults = await mapConcurrent(calibrationLinks, CONCURRENCY, async (link) => {
    const item = marketByApparelId.get(String(link.apparelId));
    const mappedCard = cardsById.get(link.cardId);
    if (!item?.previewImageUrl || !mappedCard?.imageUrl) {
      return { apparelId: link.apparelId, cardId: link.cardId, status: 'missing_image' };
    }
    const candidates = jpCardsByNumber.get(mappedCard.cardNo) || [];
    try {
      const comparisons = await compareMarketItem(item, candidates);
      const mapped = comparisons.find((comparison) => comparison.cardId === link.cardId) || null;
      return {
        apparelId: link.apparelId,
        cardId: link.cardId,
        status: 'compared',
        mappedScore: mapped?.score || 0,
        mappedRank: mapped ? comparisons.findIndex((comparison) => comparison.cardId === link.cardId) + 1 : null,
        bestCardId: comparisons[0]?.cardId || null,
        bestScore: comparisons[0]?.score || 0
      };
    } catch (error) {
      return { apparelId: link.apparelId, cardId: link.cardId, status: 'error', error: String(error?.message || error) };
    }
  });

  const targetResults = await mapConcurrent(targets, CONCURRENCY, async (item) => {
    const cardNo = normalizedCardNo(item);
    const candidates = jpCardsByNumber.get(cardNo) || [];
    if (!cardNo || !candidates.length) {
      return {
        apparelId: item.apparelId,
        cardNo,
        name: item.name,
        setName: item.setName,
        category: sourceCategory(item),
        status: 'catalog_card_number_missing',
        previewImageUrl: item.previewImageUrl,
        comparisons: []
      };
    }
    try {
      const comparisons = await compareMarketItem(item, candidates);
      const classification = classifyComparison(comparisons);
      return {
        apparelId: item.apparelId,
        cardNo,
        name: item.name,
        setName: item.setName,
        category: sourceCategory(item),
        status: classification.status,
        bestCardId: classification.best?.cardId || null,
        bestSeries: classification.best?.series || null,
        bestScore: classification.best?.score || 0,
        margin: classification.margin,
        previewImageUrl: item.previewImageUrl,
        comparisons: comparisons.slice(0, 5)
      };
    } catch (error) {
      return {
        apparelId: item.apparelId,
        cardNo,
        name: item.name,
        setName: item.setName,
        category: sourceCategory(item),
        status: 'image_error',
        error: String(error?.message || error),
        previewImageUrl: item.previewImageUrl,
        comparisons: []
      };
    }
  });

  const calibrationCompared = calibrationResults.filter((item) => item.status === 'compared');
  const statusCounts = targetResults.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    input: {
      latestMarketProducts: latestItems.length,
      approvedMappings: approvedLinks.length,
      unmappedMarketProducts: unmappedMarketItems.length,
      promoAndLimitedScope: scopedItems.length,
      targetCount: targets.length,
      excludedCount: excluded.length
    },
    calibration: {
      total: calibrationResults.length,
      compared: calibrationCompared.length,
      mappedTopRank: calibrationCompared.filter((item) => item.mappedRank === 1).length,
      mappedScoreP10: percentile(calibrationCompared.map((item) => item.mappedScore), 0.1),
      mappedScoreP50: percentile(calibrationCompared.map((item) => item.mappedScore), 0.5),
      mappedScoreP90: percentile(calibrationCompared.map((item) => item.mappedScore), 0.9),
      results: calibrationResults
    },
    summary: {
      statusCounts,
      excludedReasonCounts: excluded.flatMap(({ reasons }) => reasons).reduce((counts, reason) => {
        counts[reason] = (counts[reason] || 0) + 1;
        return counts;
      }, {})
    },
    excluded: excluded.map(({ item, reasons }) => ({
      apparelId: item.apparelId,
      cardNo: normalizedCardNo(item),
      name: item.name,
      setName: item.setName,
      reasons
    })),
    results: targetResults
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath: OUTPUT_PATH, ...report.input, ...report.calibration, statusCounts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
