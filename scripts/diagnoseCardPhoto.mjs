import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import cvModule from '@techstark/opencv-js';
import { normalizeCardImage, normalizeSlabInterior, normalizeHolderRegions, shortlistImageCodes, imageSignature, extractImageFeatures, compareImageFeatures } from '../src/lib/card-image-features.js';

const cv = await cvModule;
const [path, expectedKey] = process.argv.slice(2);
if (!path || !expectedKey) throw new Error('Usage: node scripts/diagnoseCardPhoto.mjs IMAGE EXPECTED_LOCALE-PRODUCT_ID');
const { data, info } = await sharp(path).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const source = cv.matFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
const images = [];
try {
  images.push(normalizeCardImage(cv, source), normalizeCardImage(cv, source, 0, true), normalizeSlabInterior(cv, source), ...normalizeHolderRegions(cv, source));
  const photos = images.map(image => extractImageFeatures(cv, image, 600));
  const signatures = images.map(image => imageSignature(cv, image));
  const rotated = new cv.Mat();
  try {
    for (const direction of [cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE]) {
      cv.rotate(images[0], rotated, direction); signatures.push(imageSignature(cv, rotated));
    }
  } finally { rotated.delete(); }
  const matches = [];
  for (const locale of ['JP', 'EN']) {
    const index = JSON.parse(await readFile(`public/card-scan/index-${locale}.json`, 'utf8')).items;
    const codes = shortlistImageCodes(index, signatures);
    const expected = index.find(item => item.key === expectedKey);
    if (expected) assert.ok(codes.includes(expected.code), 'Correct card must survive image-only retrieval');
    const references = (await Promise.all(codes.map(async code => JSON.parse(await readFile(`public/card-scan/${locale}/${code}.json`, 'utf8')).items))).flat();
    const start = performance.now();
    const ranked = references.map(reference => ({ key: reference.key, code: reference.code, ...photos.map(photo => compareImageFeatures(cv, { ...reference, descriptors: Buffer.from(reference.descriptors, 'base64') }, photo)).sort((a, b) => b.score - a.score)[0] })).filter(item => item.verified);
    matches.push(...ranked);
    console.log(JSON.stringify({ locale, codes: codes.length, references: references.length, milliseconds: Math.round(performance.now() - start) }));
  }
  matches.sort((a, b) => b.score - a.score);
  console.log(JSON.stringify({ matches }));
  assert.equal(matches[0]?.key, expectedKey, 'Expected artwork must be first across JP and EN');
  assert.ok(matches.every(item => item.code === matches[0].code), 'Different card numbers must not be visually verified');
} finally { images.forEach(image => image.delete()); source.delete(); }
