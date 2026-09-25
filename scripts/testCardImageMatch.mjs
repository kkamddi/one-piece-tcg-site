import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import cvModule from '@techstark/opencv-js';
import { parse } from '@babel/parser';
import { IMAGE_INDEX_VERSION, normalizeCardImage, normalizeHolderRegions, shortlistImageCodes, extractImageFeatures, compareImageFeatures, imageSignature, signatureDistance } from '../src/lib/card-image-features.js';
import { getScanVariants } from '../src/lib/card-scan.js';
import { createCardImageSession } from '../src/lib/card-image-match.js';

const cv = await cvModule;
const sample = new URL('../artifacts/card-scan-OP01-120.png', import.meta.url);
async function sampleMat() {
  const { data, info } = await sharp(await readFile(sample)).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return cv.matFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
}
const references = JSON.parse(await readFile(new URL('../public/card-scan/JP/OP01-120.json', import.meta.url), 'utf8')).items.map(item => ({ ...item, descriptors: Buffer.from(item.descriptors, 'base64') }));
const normal = references.find(item => item.key === 'JP-142695');
function matchedKeys(mat) {
  const normalized = normalizeCardImage(cv, mat);
  try {
    const photo = extractImageFeatures(cv, normalized, 600);
    return references.filter(item => compareImageFeatures(cv, item, photo).verified).map(item => item.key);
  } finally { normalized.delete(); }
}

test('real artwork matches original and reprint, but not the different parallel artwork', async () => {
  const mat = await sampleMat();
  try {
    const keys = matchedKeys(mat);
    assert.ok(keys.includes('JP-142695'));
    assert.ok(keys.includes('JP-328421'));
    assert.ok(!keys.includes('JP-93520'));
  } finally { mat.delete(); }
});

test('rotated and darker photos still match the registered artwork', async () => {
  const mat = await sampleMat(), rotated = new cv.Mat(), darker = new cv.Mat();
  try {
    cv.rotate(mat, rotated, cv.ROTATE_180);
    mat.convertTo(darker, -1, .7, 12);
    assert.ok(matchedKeys(rotated).includes('JP-142695'));
    assert.ok(matchedKeys(darker).includes('JP-142695'));
  } finally { darker.delete(); rotated.delete(); mat.delete(); }
});

test('perspective correction keeps artwork evidence in a simulated angled photo', async () => {
  const mat = await sampleMat();
  const src = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, mat.cols - 1, 0, mat.cols - 1, mat.rows - 1, 0, mat.rows - 1]);
  const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [60, 45, 510, 85, 560, 790, 30, 740]);
  const transform = cv.getPerspectiveTransform(src, dst), warped = new cv.Mat();
  try {
    cv.warpPerspective(mat, warped, transform, new cv.Size(600, 840), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(50, 55, 60, 255));
    assert.ok(matchedKeys(warped).includes('JP-142695'));
  } finally { warped.delete(); transform.delete(); dst.delete(); src.delete(); mat.delete(); }
});

test('blank photos never receive verified artwork matches', () => {
  const blank = new cv.Mat(504, 360, cv.CV_8UC4, new cv.Scalar(245, 245, 245, 255));
  try { assert.deepEqual(matchedKeys(blank), []); } finally { blank.delete(); }
});

test('weak frame and watermark matches cannot verify artwork', () => {
  const points = [], descriptors = [];
  for (let i = 0; i < normal.points.length; i += 2) {
    const x = normal.points[i] / normal.width, y = normal.points[i + 1] / normal.height;
    if (x > .2 && x < .8 && y > .1 && y < .42) continue;
    points.push(normal.points[i], normal.points[i + 1]);
    descriptors.push(...normal.descriptors.subarray(i / 2 * 32, (i / 2 + 1) * 32));
  }
  const selected = Array.from({ length: Math.min(20, points.length / 2) }, (_, i) => Math.floor(i * (points.length / 2) / 20));
  const result = compareImageFeatures(cv, normal, { ...normal, points: selected.flatMap(i => points.slice(i * 2, i * 2 + 2)), descriptors: selected.flatMap(i => descriptors.slice(i * 32, i * 32 + 32)) });
  assert.ok(result.inliers >= 10);
  assert.equal(result.artworkInliers, 0);
  assert.equal(result.verified, false);
  assert.equal(compareImageFeatures(cv, normal, normal).verified, true);
});

test('OCR rectification retains a high-resolution card with rounded corners and background', async () => {
  const photo = await sharp({ create: { width: 1100, height: 1400, channels: 4, background: '#d4d7d5' } })
    .composite([{ input: await readFile(sample), left: 230, top: 190 }]).raw().toBuffer();
  const mat = cv.matFromImageData({ data: new Uint8ClampedArray(photo), width: 1100, height: 1400 });
  const normalized = normalizeCardImage(cv, mat, 1080);
  try {
    assert.equal(normalized.cols, 1080);
    assert.equal(normalized.rows, 1512);
  } finally { normalized.delete(); mat.delete(); }
});

test('the full image-only shortlist includes the correct card without a card number', async () => {
  const mat = await sampleMat(), normalized = normalizeCardImage(cv, mat);
  try {
    const signature = imageSignature(cv, normalized);
    const index = JSON.parse(await readFile(new URL('../public/card-scan/index-JP.json', import.meta.url), 'utf8'));
    const closest = index.items.map(item => ({ code: item.code, score: signatureDistance(signature, Array.from(Buffer.from(item.signature, 'base64'))) })).sort((a, b) => a.score - b.score).slice(0, 40);
    assert.ok(closest.some(item => item.code === 'OP01-120'));
  } finally { normalized.delete(); mat.delete(); }
});

test('Unicode catalog hyphens resolve without merging separate versions', () => {
  assert.equal(getScanVariants([{ apparelId: 1, code: 'P\u2010022', locale: 'JP' }], 'P-022', 'JP').length, 1);
});

test('each crop contributes candidates even when another crop has better absolute scores', () => {
  const encode = values => Buffer.from(values).toString('base64');
  const items = Array.from({ length: 80 }, (_, i) => ({ code: `OTHER-${i}`, signature: encode([0, 100, 200, 100]) }));
  items.push({ code: 'TARGET', signature: encode([180, 90, 20, 60]) });
  const codes = shortlistImageCodes(items, [[0, 100, 200, 100], [160, 100, 10, 30]]);
  assert.ok(codes.includes('TARGET'));
  assert.ok(codes.length <= 64);
});

test('holder search regions are bounded and blank regions cannot match artwork', () => {
  const blank = new cv.Mat(847, 562, cv.CV_8UC4, new cv.Scalar(245, 245, 245, 255));
  const regions = normalizeHolderRegions(cv, blank);
  try {
    assert.equal(regions.length, 3);
    for (const region of regions) assert.equal(compareImageFeatures(cv, normal, extractImageFeatures(cv, region, 600)).verified, false);
  } finally { regions.forEach(region => region.delete()); blank.delete(); }
});

test('image worker, session and scanner modules parse', async () => {
  for (const file of ['../src/lib/card-image-worker.js', '../src/lib/card-image-match.js', '../src/CardScanner.jsx']) {
    parse(await readFile(new URL(file, import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  }
  assert.ok(normal.descriptors.length > 0);
});

test('cancelling image comparison stops its worker; only static GET requests are made', async () => {
  const previousWorker = global.Worker, previousFetch = global.fetch;
  let terminated = 0;
  const requests = [];
  global.Worker = class { postMessage() {} terminate() { terminated += 1; } };
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ version: IMAGE_INDEX_VERSION, items: [{ key: 'JP-1' }] }) };
  };
  const controller = new AbortController();
  const session = createCardImageSession(controller.signal);
  try {
    const pending = session.match('OP01-120', 'JP');
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(terminated, 1);
    assert.equal(requests[0].url, '/card-scan/JP/OP01-120.json');
    assert.equal(requests[0].options.body, undefined);
    assert.equal(requests[0].options.method, undefined);
  } finally { session.dispose(); global.Worker = previousWorker; global.fetch = previousFetch; }
});

test('missing comparison data does not produce a fabricated image match', async () => {
  const previousWorker = global.Worker, previousFetch = global.fetch;
  global.Worker = class { postMessage() { throw new Error('should_not_compare'); } terminate() {} };
  global.fetch = async () => ({ ok: false });
  const session = createCardImageSession(new AbortController().signal);
  try { await assert.rejects(session.match('OP01-120', 'JP'), /image_index_unavailable/); }
  finally { session.dispose(); global.Worker = previousWorker; global.fetch = previousFetch; }
});
