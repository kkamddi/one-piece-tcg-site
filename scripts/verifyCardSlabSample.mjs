import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import cvModule from '@techstark/opencv-js';
import { normalizeCardImage, normalizeSlabInterior, extractImageFeatures, compareImageFeatures } from '../src/lib/card-image-features.js';

// Regression fixture: the supplied P-110 screenshot, including its PSA holder.
const cv = await cvModule;
const { data, info } = await sharp(process.argv[2]).extract({ left: 110, top: 4, width: 570, height: 885 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const source = cv.matFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
const references = JSON.parse(await readFile('public/card-scan/JP/P-110.json', 'utf8')).items;
try {
  const results = [];
  for (const inner of [false, true, 'slab']) {
    const normalized = inner === 'slab' ? normalizeSlabInterior(cv, source) : normalizeCardImage(cv, source, 0, inner);
    try {
      const photo = extractImageFeatures(cv, normalized, 600);
      const ranked = references.map(reference => ({ key: reference.key, ...compareImageFeatures(cv, { ...reference, descriptors: Buffer.from(reference.descriptors, 'base64') }, photo) })).sort((a, b) => b.score - a.score);
      results.push({ inner, ...ranked[0] });
    } finally { normalized.delete(); }
  }
  console.log(JSON.stringify(results));
  assert.ok(results.some(result => result.key === 'JP-686000' && result.verified));
} finally { source.delete(); }
