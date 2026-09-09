import { mkdir, readFile, writeFile } from 'node:fs/promises';
import cvModule from '@techstark/opencv-js';
import sharp from 'sharp';
import catalog from '../src/data/market-cards.js';
import { normalizeCardImage, extractImageFeatures, compareImageFeatures } from '../src/lib/card-image-features.js';

const cv = await cvModule;
const directory = 'artifacts/card-image-validation';
await mkdir(directory, { recursive: true });
const results = [];
const indexKeys = new Set((await Promise.all(['JP', 'EN'].map(async locale => JSON.parse(await readFile(`public/card-scan/index-${locale}.json`, 'utf8')).items))).flat().map(item => item.key));
for (const locale of ['JP', 'EN']) {
  for (const prefix of ['OP01-', 'OP05-', 'OP17-', 'EB04-', 'ST01-', 'P-']) {
    const item = catalog.find(value => value.locale === locale && value.code.startsWith(prefix) && value.previewImageUrl && indexKeys.has(`${value.locale}-${value.apparelId}`));
    if (!item) { results.push({ locale, prefix, skipped: 'not_in_catalog' }); continue; }
    const cache = `${directory}/${locale}-${item.apparelId}.webp`;
    let bytes;
    try { bytes = await readFile(cache); } catch {
      const response = await fetch(item.previewImageUrl, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`sample_HTTP_${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer()); await writeFile(cache, bytes);
    }
    const { data, info } = await sharp(bytes).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const original = cv.matFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
    const normalized = normalizeCardImage(cv, original), changed = new cv.Mat();
    const src = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, normalized.cols - 1, 0, normalized.cols - 1, normalized.rows - 1, 0, normalized.rows - 1]);
    const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [42, 30, 360, 55, 385, 570, 20, 545]);
    const transform = cv.getPerspectiveTransform(src, dst);
    let corrected;
    try {
      cv.warpPerspective(normalized, changed, transform, new cv.Size(420, 600), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(40, 45, 50, 255));
      changed.convertTo(changed, -1, .8, 10);
      corrected = normalizeCardImage(cv, changed);
      const photo = extractImageFeatures(cv, corrected, 600);
      const references = JSON.parse(await readFile(`public/card-scan/${locale}/${item.code}.json`, 'utf8')).items;
      const ranked = references.map(reference => ({ key: reference.key, ...compareImageFeatures(cv, { ...reference, descriptors: Buffer.from(reference.descriptors, 'base64') }, photo) })).sort((a, b) => b.score - a.score);
      const target = ranked.find(value => value.key === `${locale}-${item.apparelId}`);
      const result = { locale, code: item.code, apparelId: item.apparelId, verified: Boolean(target?.verified), rank: ranked.indexOf(target) + 1, inliers: target?.inliers || 0 };
      results.push(result); console.log(JSON.stringify(result));
    } finally { corrected?.delete(); transform.delete(); dst.delete(); src.delete(); changed.delete(); normalized.delete(); original.delete(); }
  }
}
const report = { samples: results.filter(item => !item.skipped).length, matched: results.filter(item => item.verified).length, results };
await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ samples: report.samples, matched: report.matched }));
if (report.matched !== report.samples) process.exitCode = 1;
