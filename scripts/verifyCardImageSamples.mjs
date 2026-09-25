import { mkdir, readFile, writeFile } from 'node:fs/promises';
import cvModule from '@techstark/opencv-js';
import sharp from 'sharp';
import catalog from '../src/data/market-cards.js';
import { normalizeCardImage, normalizeSlabInterior, normalizeHolderRegions, shortlistImageCodes, imageSignature, extractImageFeatures, compareImageFeatures } from '../src/lib/card-image-features.js';
import { canShowCandidatePrice } from '../extensions/card-pone/result-confidence.js';

const cv = await cvModule;
const directory = 'artifacts/card-image-validation';
await mkdir(directory, { recursive: true });
const results = [];
const imageOnly = process.argv.includes('--image-only');
const conditions = process.argv.includes('--glare') ? ['perspective', 'glare'] : ['perspective'];
const sampleKey = process.argv.find(value => value.startsWith('--sample='))?.slice(9);
const indexes = Object.fromEntries(await Promise.all(['JP', 'EN'].map(async locale => [locale, JSON.parse(await readFile(`public/card-scan/index-${locale}.json`, 'utf8')).items])));
const indexKeys = new Set(Object.values(indexes).flat().map(item => item.key));
// SNKRDUNK also labels promo numbers with a product-family prefix.
const canonicalCode = code => code.replace(/^OPC-(P-\d{3})$/, '$1');
const codeByKey = new Map(catalog.map(item => [`${item.locale}-${item.apparelId}`, canonicalCode(item.code)]));
for (const locale of ['JP', 'EN']) {
  for (const prefix of ['OP01-', 'OP05-', 'OP17-', 'EB04-', 'ST01-', 'P-']) {
    const first = catalog.find(value => value.locale === locale && value.code.startsWith(prefix) && value.previewImageUrl && indexKeys.has(`${value.locale}-${value.apparelId}`));
    if (!first) { results.push({ locale, prefix, skipped: 'not_in_catalog' }); continue; }
    const variants = catalog.filter(value => value.locale === locale && value.code === first.code && value.previewImageUrl && indexKeys.has(`${value.locale}-${value.apparelId}`)).slice(0, 3);
    for (const item of variants) {
    if (sampleKey && sampleKey !== `${locale}-${item.apparelId}`) continue;
    const cache = `${directory}/${locale}-${item.apparelId}.webp`;
    let bytes;
    try { bytes = await readFile(cache); } catch {
      const response = await fetch(item.previewImageUrl, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`sample_HTTP_${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer()); await writeFile(cache, bytes);
    }
    for (const condition of conditions) {
    const started = performance.now();
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
      if (condition === 'glare') {
        const reflection = new cv.Mat();
        changed.copyTo(reflection);
        try {
          cv.line(reflection, new cv.Point(220, 30), new cv.Point(330, 570), new cv.Scalar(255, 255, 255, 255), 48);
          cv.GaussianBlur(reflection, reflection, new cv.Size(21, 21), 0);
          cv.addWeighted(changed, .65, reflection, .35, 0, changed);
        } finally { reflection.delete(); }
      }
      corrected = normalizeCardImage(cv, changed);
      const photo = extractImageFeatures(cv, corrected, 600);
      const extra = [normalizeCardImage(cv, changed, 0, true), normalizeSlabInterior(cv, changed), ...normalizeHolderRegions(cv, changed)];
      let photos, signatures;
      try {
        photos = [photo, ...extra.map(image => extractImageFeatures(cv, image, 600))];
        signatures = [corrected, ...extra].map(image => imageSignature(cv, image));
        const rotated = new cv.Mat();
        try {
          for (const direction of [cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE]) {
            cv.rotate(corrected, rotated, direction); signatures.push(imageSignature(cv, rotated));
          }
        } finally { rotated.delete(); }
      }
      finally { extra.forEach(image => image.delete()); }
      const references = [];
      let retrieved = !imageOnly;
      for (const edition of ['JP', 'EN']) {
        const codes = imageOnly ? shortlistImageCodes(indexes[edition], signatures) : [item.code];
        if (edition === locale && codes.includes(item.code)) retrieved = true;
        for (const code of codes) {
        try { references.push(...JSON.parse(await readFile(`public/card-scan/${edition}/${code}.json`, 'utf8')).items); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
      }
      const ranked = references.map(reference => ({ key: reference.key, ...photos.map(value => compareImageFeatures(cv, { ...reference, descriptors: Buffer.from(reference.descriptors, 'base64') }, value)).sort((a, b) => b.score - a.score)[0] })).sort((a, b) => b.score - a.score);
      const target = ranked.find(value => value.key === `${locale}-${item.apparelId}`);
      if (sampleKey && !target?.verified) {
        for (const [name, image] of [['input', changed], ['normalized', corrected]]) {
          await sharp(Buffer.from(image.data), { raw: { width: image.cols, height: image.rows, channels: 4 } }).png().toFile(`${directory}/${sampleKey}-${condition}-${name}.png`);
        }
      }
      const candidates = ranked.filter(value => value.verified).map(value => ({ ...value, artwork: true }));
      if (sampleKey) console.log(JSON.stringify({ condition, evidence: candidates }));
      const automatic = candidates.filter(value => canShowCandidatePrice({ candidates, warnings: [] }, value));
      const result = { locale, condition, retrieved, milliseconds: Math.round(performance.now() - started), code: item.code, apparelId: item.apparelId, verified: Boolean(target?.verified), rank: target ? ranked.indexOf(target) + 1 : null, inliers: target?.inliers || 0,
        verifiedKeys: candidates.map(value => value.key), requiresConfirmation: candidates.length > 1,
        differentNumberKeys: candidates.filter(value => codeByKey.get(value.key) !== canonicalCode(item.code)).map(value => value.key),
        wrongAutomaticPrice: automatic.some(value => value.key !== `${locale}-${item.apparelId}`) };
      results.push(result); console.log(JSON.stringify(result));
    } finally { corrected?.delete(); transform.delete(); dst.delete(); src.delete(); changed.delete(); normalized.delete(); original.delete(); }
    }
    }
  }
}
const report = { mode: imageOnly ? 'image-only' : 'known-code', conditions, samples: results.filter(item => !item.skipped).length, retrieved: results.filter(item => item.retrieved).length, matched: results.filter(item => item.verified).length,
  topOne: results.filter(item => item.verified && item.rank === 1).length,
  ambiguous: results.filter(item => item.requiresConfirmation).length,
  crossNumberCases: results.filter(item => item.differentNumberKeys?.length).length,
  wrongAutomaticPrices: results.filter(item => item.wrongAutomaticPrice).length, results };
await writeFile(`${directory}/${sampleKey ? `${sampleKey}-` : ''}${imageOnly ? 'image-only-report' : 'report'}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, results: undefined }));
if (report.matched !== report.samples || report.wrongAutomaticPrices || report.crossNumberCases) process.exitCode = 1;
