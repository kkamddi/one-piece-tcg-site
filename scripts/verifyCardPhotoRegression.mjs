import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import cvModule from '@techstark/opencv-js';
import { normalizeCardImage, normalizeSlabInterior, normalizeHolderRegions, shortlistImageCodes, imageSignature, extractImageFeatures, compareImageFeatures, signatureDistance } from '../src/lib/card-image-features.js';

// User photos stay local and are never copied into the repository or uploaded.
const [photoPath, expectedKey, ...options] = process.argv.slice(2);
if (!photoPath || !/^(JP|EN)-\d+$/.test(expectedKey)) throw new Error('Usage: node scripts/verifyCardPhotoRegression.mjs PHOTO LOCALE-ID [--widths=original,320,240] [--remote-index]');
const cv = await cvModule;
const remote = options.includes('--remote-index');
const files = new Map();
async function readReference(file) {
  if (!files.has(file)) files.set(file, (async () => {
    if (!remote) return JSON.parse(await readFile(`public/card-scan/${file}.json`, 'utf8'));
    const response = await fetch(`https://www.optcgkorea.com/card-scan/${file}.json`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`reference_HTTP_${response.status}: ${file}`);
    return response.json();
  })());
  return files.get(file);
}
const indexes = {};
for (const locale of ['JP', 'EN']) {
  indexes[locale] = (await readReference(`index-${locale}`)).items;
}
const expected = indexes[expectedKey.slice(0, 2)].find(item => item.key === expectedKey);
assert.ok(expected, 'Expected artwork must exist in the index');
const widths = (options.find(option => option.startsWith('--widths='))?.slice(9) || 'original,320,240').split(',');
let failed = false;
for (const width of widths) {
  const started = performance.now();
  let input = sharp(photoPath).flatten({ background: '#fff' });
  if (width !== 'original') input = input.resize({ width: Number(width), withoutEnlargement: true });
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
    const matches = [], retrieval = [];
    for (const locale of ['JP', 'EN']) {
      const index = indexes[locale];
      const codes = shortlistImageCodes(index, signatures);
      retrieval.push({ locale, codes: codes.length, expectedCodeIncluded: codes.includes(expected.code) });
      for (let i = 0; i < codes.length; i += 4) {
        await Promise.all(codes.slice(i, i + 4).map(code => readReference(`${locale}/${code}`)));
      }
      for (const code of codes) {
        const references = (await readReference(`${locale}/${code}`)).items;
        for (const reference of references) {
          const decoded = { ...reference, descriptors: Buffer.from(reference.descriptors, 'base64') };
          const best = photos.map(photo => compareImageFeatures(cv, decoded, photo)).sort((a, b) => b.score - a.score)[0];
          if (best.verified) matches.push({ key: reference.key, code, ...best });
        }
      }
    }
    matches.sort((a, b) => b.score - a.score);
    const expectedRanks = signatures.map(signature => indexes[expectedKey.slice(0, 2)]
      .map(item => ({ key: item.key, distance: signatureDistance(signature, Buffer.from(item.signature, 'base64')) }))
      .sort((a, b) => a.distance - b.distance).findIndex(item => item.key === expectedKey) + 1);
    const passed = matches[0]?.key === expectedKey && matches.every(item => item.code === expected.code);
    failed ||= !passed;
    console.log(JSON.stringify({ width: info.width, height: info.height, passed, retrieval, expectedRanks, matches, milliseconds: Math.round(performance.now() - started) }));
  } finally { images.forEach(image => image.delete()); source.delete(); }
}
assert.equal(failed, false, 'At least one photo size failed retrieval or artwork matching');
