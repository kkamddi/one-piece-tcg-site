import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import marketCards from '../src/data/market-cards.js';
import cards from '../src/data/cards.json' with { type: 'json' };

const auditArg = process.argv.find((arg) => arg.startsWith('--audit='));
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const cacheArg = process.argv.find((arg) => arg.startsWith('--cache='));
const minScoreArg = process.argv.find((arg) => arg.startsWith('--min-score='));
const maxScoreArg = process.argv.find((arg) => arg.startsWith('--max-score='));
const statusesArg = process.argv.find((arg) => arg.startsWith('--statuses='));
const apparelIdsArg = process.argv.find((arg) => arg.startsWith('--apparel-ids='));

const AUDIT_PATH = auditArg?.slice('--audit='.length)
  || 'tmp/card-pone-promo-image-audit-manual-final.json';
const OUTPUT_DIR = outputArg?.slice('--output='.length)
  || 'tmp/card-pone-promo-review-sheets';
const CACHE_DIR = cacheArg?.slice('--cache='.length)
  || 'tmp/card-pone-promo-image-cache';
const MIN_SCORE = Number(minScoreArg?.slice('--min-score='.length) || 0);
const MAX_SCORE = Number(maxScoreArg?.slice('--max-score='.length) || 1);
const STATUSES = new Set((statusesArg?.slice('--statuses='.length)
  || 'manual_review_low_confidence,manual_review_regular_match,catalog_card_number_missing')
  .split(',')
  .filter(Boolean));
const APPAREL_IDS = (apparelIdsArg?.slice('--apparel-ids='.length) || '')
  .split(',')
  .map(Number)
  .filter(Number.isFinite);

const CELL_WIDTH = 190;
const IMAGE_HEIGHT = 260;
const HEADER_HEIGHT = 92;
const ROW_HEIGHT = 392;
const SHEET_WIDTH = 820;
const ITEMS_PER_SHEET = 3;

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function truncate(value, length) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

async function imageBuffer(url) {
  if (!url) return null;
  const filePath = path.join(CACHE_DIR, `${hashUrl(url)}.img`);
  try {
    try {
      await fs.access(filePath);
    } catch {
      const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error(`image request failed: ${response.status}`);
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    }
    return await sharp(filePath)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: CELL_WIDTH, height: IMAGE_HEIGHT, fit: 'contain', background: '#ffffff' })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function labelSvg(width, height, lines, fontSize = 17) {
  const text = lines
    .map((line, index) => `<text x="8" y="${24 + index * 22}" font-size="${fontSize}" font-family="Arial, sans-serif" fill="#17191c">${escapeXml(line)}</text>`)
    .join('');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/>${text}</svg>`);
}

async function renderRow(item) {
  const candidates = (item.comparisons || []).slice(0, 3);
  const images = await Promise.all([
    imageBuffer(item.previewImageUrl),
    ...candidates.map((candidate) => imageBuffer(candidate.imageUrl)),
  ]);
  const canvas = sharp({
    create: { width: SHEET_WIDTH, height: ROW_HEIGHT, channels: 4, background: '#ffffff' },
  });
  const composites = [{
    input: labelSvg(SHEET_WIDTH, HEADER_HEIGHT, [
      `SNKRDUNK #${item.apparelId} | ${item.status} | score ${Number(item.bestScore || 0).toFixed(3)} / margin ${Number(item.margin || 0).toFixed(3)}`,
      truncate(item.name, 92),
      truncate(item.setName, 92),
    ]),
    left: 0,
    top: 0,
  }];

  const labels = ['SNKRDUNK', ...candidates.map((candidate) => `${candidate.cardId} | ${Number(candidate.score || 0).toFixed(3)}`)];
  images.forEach((buffer, index) => {
    const left = 10 + index * 202;
    if (buffer) composites.push({ input: buffer, left, top: HEADER_HEIGHT + 2 });
    composites.push({
      input: labelSvg(CELL_WIDTH, 32, [labels[index] || ''], 14),
      left,
      top: HEADER_HEIGHT + IMAGE_HEIGHT + 4,
    });
  });
  composites.push({
    input: Buffer.from(`<svg width="${SHEET_WIDTH}" height="2" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="2" fill="#d9dde3"/></svg>`),
    left: 0,
    top: ROW_HEIGHT - 2,
  });
  return canvas.composite(composites).png().toBuffer();
}

async function main() {
  const report = JSON.parse(await fs.readFile(AUDIT_PATH, 'utf8'));
  const rows = APPAREL_IDS.length
    ? APPAREL_IDS.map((apparelId) => {
      const market = marketCards.find((item) => Number(item.apparelId) === apparelId);
      if (!market) throw new Error(`missing market product ${apparelId}`);
      const candidates = cards.filter((card) => card.locale === 'JP' && card.cardNo === market.code);
      return {
        ...market,
        cardNo: market.code,
        status: 'existing_duplicate_review',
        bestScore: 0,
        margin: 0,
        comparisons: candidates.map((card) => ({ cardId: card.id, imageUrl: card.imageUrl, score: 0 }))
      };
    })
    : (report.rows || report.items || report.results || [])
      .filter((item) => STATUSES.has(item.status))
      .filter((item) => Number(item.bestScore || 0) >= MIN_SCORE)
      .filter((item) => Number(item.bestScore || 0) < MAX_SCORE);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (let offset = 0; offset < rows.length; offset += ITEMS_PER_SHEET) {
    const pageRows = rows.slice(offset, offset + ITEMS_PER_SHEET);
    const rowBuffers = await Promise.all(pageRows.map(renderRow));
    const outputPath = path.join(OUTPUT_DIR, `review-${String(offset / ITEMS_PER_SHEET + 1).padStart(2, '0')}.png`);
    await sharp({
      create: { width: SHEET_WIDTH, height: ROW_HEIGHT * pageRows.length, channels: 4, background: '#ffffff' },
    })
      .composite(rowBuffers.map((input, index) => ({ input, left: 0, top: index * ROW_HEIGHT })))
      .png()
      .toFile(outputPath);
  }

  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, rows: rows.length, sheets: Math.ceil(rows.length / ITEMS_PER_SHEET) }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
