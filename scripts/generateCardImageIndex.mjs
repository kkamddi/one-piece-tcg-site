import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import cvModule from '@techstark/opencv-js';
import baseCatalog from '../src/data/market-cards.js';
import { IMAGE_INDEX_VERSION, normalizeCardImage, imageSignature, extractImageFeatures } from '../src/lib/card-image-features.js';
import { normalizeScanCode } from '../src/lib/card-scan.js';

const cv = await cvModule;
const args = new URLSearchParams(process.argv.slice(2).map(arg => arg.replace(/^--/, '')).join('&'));
const catalog = args.has('catalog') ? JSON.parse(await readFile(args.get('catalog'), 'utf8')) : baseCatalog;
const root = path.resolve(args.get('out') || 'public/card-scan');
const cache = path.resolve('artifacts/card-image-index-cache');
const codes = new Set((args.get('codes') || '').split(',').filter(Boolean));
if (codes.size && !args.has('out')) throw new Error('A subset requires --out so it cannot replace the full index.');
const targets = catalog.map(item => ({ ...item, code: normalizeScanCode(item.code) })).filter(item => item.previewImageUrl && ['JP', 'EN'].includes(item.locale) && /^[A-Z0-9-]+$/.test(item.code) && (!codes.size || codes.has(item.code)));
await mkdir(cache, { recursive: true });
await mkdir(path.join(cache, 'raw'), { recursive: true });
await mkdir(root, { recursive: true });
const results = [], failures = [];
let cursor = 0, done = 0;
const keyOf = item => `${item.locale}-${item.apparelId}`;
const existingSignatures = new Map();
for (const locale of ['JP', 'EN']) {
  try {
    const index = JSON.parse(await readFile(path.join(root, `index-${locale}.json`), 'utf8'));
    if (index.version === IMAGE_INDEX_VERSION) for (const item of index.items) existingSignatures.set(item.key, item.signature);
  } catch {}
}
async function processItem(item) {
  const revision = createHash('sha256').update(`${IMAGE_INDEX_VERSION}:${item.previewImageUrl}`).digest('hex').slice(0, 16);
  const cached = path.join(cache, `${keyOf(item)}-${revision}.json`);
  try { return { ...JSON.parse(await readFile(cached, 'utf8')), code: item.code }; } catch {}
  if (existingSignatures.has(keyOf(item))) {
    try {
      const group = JSON.parse(await readFile(path.join(root, item.locale, `${item.code}.json`), 'utf8'));
      const previous = group.items.find(entry => entry.key === keyOf(item) && entry.revision === revision);
      if (group.version === IMAGE_INDEX_VERSION && previous) return { ...previous, signature: existingSignatures.get(keyOf(item)) };
    } catch {}
  }
  const url = new URL(item.previewImageUrl);
  if (url.hostname !== 'cdn.snkrdunk.com') throw new Error('unsupported_image_host');
  let bytes;
  const rawFile = path.join(cache, 'raw', `${keyOf(item)}-${createHash('sha256').update(item.previewImageUrl).digest('hex').slice(0, 12)}.webp`);
  try { bytes = await readFile(rawFile); } catch {}
  for (let attempt = 0; !bytes && attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer()); await writeFile(rawFile, bytes); break;
    } catch (error) { if (attempt) throw error; }
  }
  const { data, info } = await sharp(bytes, { limitInputPixels: 25000000 }).rotate().resize({ width: 720, height: 900, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = cv.matFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
  let normalized;
  try {
    normalized = normalizeCardImage(cv, source);
    if (normalized.cols / normalized.rows < .48 || normalized.cols / normalized.rows > .88) throw new Error('card_region_not_found');
    const features = extractImageFeatures(cv, normalized);
    if (features.points.length < 20) throw new Error('insufficient_artwork_features');
    const result = { key: keyOf(item), code: item.code, locale: item.locale, revision, signature: Buffer.from(imageSignature(cv, normalized)).toString('base64'), ...features, descriptors: Buffer.from(features.descriptors).toString('base64') };
    await writeFile(cached, JSON.stringify(result));
    return result;
  } finally { normalized?.delete(); source.delete(); }
}
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < targets.length) {
    const item = targets[cursor++];
    try { results.push(await processItem(item)); } catch (error) { failures.push({ key: keyOf(item), message: error.message }); }
    done += 1;
    if (done % 200 === 0) console.log(`${done}/${targets.length}; indexed=${results.length}; failed=${failures.length}`);
  }
}));
const groups = new Map();
results.sort((a, b) => a.key.localeCompare(b.key));
for (const item of results) {
  const key = `${item.locale}/${item.code}`;
  if (!groups.has(key)) groups.set(key, []);
  const { signature, ...features } = item;
  groups.get(key).push(features);
}
for (const [key, items] of groups) {
  await mkdir(path.dirname(path.join(root, `${key}.json`)), { recursive: true });
  await writeFile(path.join(root, `${key}.json`), JSON.stringify({ version: IMAGE_INDEX_VERSION, items }));
}
for (const locale of ['JP', 'EN']) {
  const items = results.filter(item => item.locale === locale).map(({ key, code, signature }) => ({ key, code, signature })).sort((a, b) => a.key.localeCompare(b.key));
  await writeFile(path.join(root, `index-${locale}.json`), JSON.stringify({ version: IMAGE_INDEX_VERSION, complete: !codes.size && !failures.some(item => item.key.startsWith(locale)), items }));
}
const targetKeys = new Set(targets.map(keyOf));
const report = { version: IMAGE_INDEX_VERSION, scope: codes.size ? [...codes] : 'all', targetCount: targets.length, indexedCount: results.length, excluded: codes.size ? [] : catalog.filter(item => !targetKeys.has(keyOf(item))).map(item => ({ key: keyOf(item), code: item.code })), failures };
await writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, failures: failures.slice(0, 10) }));
