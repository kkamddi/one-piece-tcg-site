import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import vm from 'node:vm';
import { extractCardCodes, getCameraCrop, getOcrRegions, getScanVariants, MAX_SCAN_BYTES, validateScanFile } from '../src/lib/card-scan.js';

test('variant lookup preserves matching artwork with different marks and requires the chosen language', () => {
  const items = [
    { code: 'OP01-120', locale: 'JP', apparelId: 1, previewImageUrl: 'same.png', name: 'Original' },
    { code: 'OP01-120', locale: 'JP', apparelId: 2, previewImageUrl: 'same.png', name: 'Reprint with mark' },
    { code: 'OP01-120', locale: 'EN', apparelId: 3 },
    { code: 'OP02-013', locale: 'JP', apparelId: 4 }
  ];
  assert.deepEqual(getScanVariants([...items, items[0]], 'OP01-120', 'JP').map(item => item.apparelId), [1, 2]);
  assert.equal(getScanVariants(items, 'OP01-120', 'EN')[0].apparelId, 3);
  assert.deepEqual(getScanVariants(items, 'OP17-001', 'JP'), []);
});

test('mobile scan starts the camera and analyzes captures automatically; price requires confirmation', async () => {
  const source = await readFile(new URL('../src/CardScanner.jsx', import.meta.url), 'utf8');
  assert.match(source, /matchMedia\('\(max-width: 767px\)'\)/);
  assert.match(source, /void openCamera\(\)/);
  assert.match(source, /void readPhoto\(photo\)/);
  assert.match(source, /onSelect\(chosen, variants\)/);
  assert.doesNotMatch(source, /setChosen\(variants\[0\]\)/);
  const css = await readFile(new URL('../src/card-scanner.css', import.meta.url), 'utf8');
  assert.match(css, /\.renew-market-scan-entry \{ display: none;/);
});

test('recognizes supported card families without interpreting ordinary numbers', () => {
  assert.deepEqual(extractCardCodes('OP01-120 EB04-061 ST29-001 PRB01-001 P-159 5000 2026-09-09'), ['OP01-120', 'EB04-061', 'ST29-001', 'PRB01-001', 'P-159']);
  assert.deepEqual(extractCardCodes('nothing here 123-456'), []);
});

test('public scan entry and dialog are disabled during maintenance', async () => {
  const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
  assert.match(source, /const CARD_SCAN_AVAILABLE = false;/);
  assert.match(source, /disabled=\{!CARD_SCAN_AVAILABLE \|\| loading\}/);
  assert.match(source, /CARD_SCAN_AVAILABLE && scannerOpen \? <CardScanner/);
  assert.match(source, /스캔 점검 중/);
});

test('normalizes full-width text, dashes and conservative OCR digit substitutions', () => {
  assert.deepEqual(extractCardCodes('ＯＰ０１－１２０ 0POI-I20 op 01 - 120'), ['OP01-120']);
  assert.deepEqual(extractCardCodes('EB04\u2013061'), ['EB04-061']);
});

test('does not match partial identifiers or silently merge different codes', () => {
  assert.deepEqual(extractCardCodes('XOP01-120 OP01-1200 P-12'), []);
  assert.deepEqual(extractCardCodes('OPO1-120ED OP01-120SEC OP02-013SR'), ['OP01-120', 'OP02-013']);
  assert.deepEqual(extractCardCodes('OP01-120\nOP01-120\nOP02-013'), ['OP01-120', 'OP02-013']);
});

test('reads missing or damaged separators and OCR digits while retaining identifier boundaries', () => {
  assert.deepEqual(extractCardCodes('OP01120 EB04.061 ST29:001 OP01-I2O OP05-O5S'), ['OP01-120', 'EB04-061', 'ST29-001', 'OP05-055']);
  assert.deepEqual(extractCardCodes('XOP01120 OP011200 invoice 123456'), []);
});

test('number close-ups retain the entire photo instead of cropping its last few pixels', () => {
  const closeup = getOcrRegions(600, 80);
  assert.equal(closeup[0].mode, '7');
  assert.equal(closeup[0].height, 1);
  assert.equal(closeup[0].width, 1);
  const card = getOcrRegions(600, 838);
  assert.equal(card[0].x, .70);
  assert.equal(card.at(-1).height, 1);
});

test('file checks reject oversized, empty and non-raster content', () => {
  assert.equal(validateScanFile({ size: 100, type: 'image/jpeg' }), '');
  assert.equal(validateScanFile({ size: 100, type: '', name: 'camera.JPG' }), '');
  assert.equal(validateScanFile({ size: MAX_SCAN_BYTES + 1, type: 'image/jpeg' }), 'size');
  assert.equal(validateScanFile({ size: 0, type: 'image/jpeg' }), 'file');
  assert.equal(validateScanFile({ size: 100, type: 'image/svg+xml' }), 'file');
  assert.equal(validateScanFile({ size: 100, type: 'text/html', name: 'fake.jpg' }), 'file');
});

test('camera crop maps a portrait frame into a landscape video without stretching', () => {
  const crop = getCameraCrop(1920, 1080, 300, 400, { x: 42, y: 49, width: 216, height: 302 });
  assert.ok(Math.abs(crop.x - 668.4) < 0.01);
  assert.ok(Math.abs(crop.y - 132.3) < 0.01);
  assert.ok(Math.abs(crop.width / crop.height - 216 / 302) < 0.001);
  assert.ok(crop.x + crop.width <= 1920 && crop.y + crop.height <= 1080);
  assert.throws(() => getCameraCrop(0, 0, 300, 400, { x: 0, y: 0, width: 200, height: 300 }));
});

test('scanner and lazy OCR modules parse; scan state belongs to the market screen', async () => {
  for (const path of ['../src/CardScanner.jsx', '../src/lib/card-scan-ocr.js']) {
    parse(await readFile(new URL(path, import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  }
  const app = parse(await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  const market = app.program.body.find(node => node.id?.name === 'RenewMarket');
  assert.ok(market.body.body.some(node => node.declarations?.some(declaration => declaration.id.elements?.[0]?.name === 'scannerOpen')));
});

async function ocrWithWorker(createWorker) {
  const source = await readFile(new URL('../src/lib/card-scan-ocr.js', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const fn = ast.program.body.find(node => node.declaration?.id?.name === 'recognizeCardCodes').declaration;
  return vm.runInNewContext(`(${source.slice(fn.start, fn.end)})`, {
    createWorker, workerPath: 'test-worker', extractCardCodes, getOcrRegions, DOMException,
    prepareRegion: () => ({ width: 100, height: 100 })
  });
}

test('OCR falls back to the full photo and always terminates its worker', async () => {
  let calls = 0;
  let terminated = 0;
  const scan = await ocrWithWorker(async () => ({
    setParameters: async () => {},
    recognize: async () => ({ data: { text: ++calls < 6 ? '5000' : 'OP01-120' } }),
    terminate: async () => { terminated += 1; }
  }));
  const codes = await scan({}, { signal: new AbortController().signal });
  assert.deepEqual(codes, ['OP01-120']);
  assert.equal(calls, 6);
  assert.equal(terminated, 1);
});

test('OCR also reads the rectified card when the original photo has no readable number', async () => {
  let calls = 0, fallbacks = 0;
  const scan = await ocrWithWorker(async () => ({
    setParameters: async () => {},
    recognize: async () => ({ data: { text: ++calls === 7 ? 'OP01120' : '' } }),
    terminate: async () => {}
  }));
  assert.deepEqual(await scan({ width: 600, height: 838 }, {
    signal: new AbortController().signal,
    getFallbackCanvas: async () => { fallbacks += 1; return { width: 360, height: 504 }; }
  }), ['OP01-120']);
  assert.equal(fallbacks, 1);
});

test('cancelling active recognition terminates the worker without a stale result', async () => {
  const controller = new AbortController();
  let terminated = 0;
  const scan = await ocrWithWorker(async () => ({
    setParameters: async () => {},
    recognize: () => { queueMicrotask(() => controller.abort()); return new Promise(() => {}); },
    terminate: async () => { terminated += 1; }
  }));
  await assert.rejects(scan({}, { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(terminated, 1);
});

test('a worker that finishes loading after cancellation is also terminated', async () => {
  const controller = new AbortController();
  let resolveWorker;
  let terminated = 0;
  const scan = await ocrWithWorker(() => new Promise(resolve => { resolveWorker = resolve; }));
  const pending = scan({}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  resolveWorker({ terminate: async () => { terminated += 1; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(terminated, 1);
});
