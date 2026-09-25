import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const source = await readFile(new URL('../src/CenteringLab.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const names = ['clamp', 'median', 'getLineContrast', 'findStrongestEdge', 'polygonArea', 'pointDistance', 'denormalizeCornerPoints', 'getOutlineValidation',
  'getAxisRatio', 'getWorseAxisRatio', 'getCenteringReport', 'boundariesToFrame', 'frameToBoundaries',
  'getLumaData', 'detectBoundary', 'analyzeCapturedCanvas'];
const context = vm.createContext({});
for (const name of names) {
  const node = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  assert.ok(node, name);
  vm.runInContext(source.slice(node.start, node.end), context);
}

test('centering ratios and frame conversion preserve known border measurements', () => {
  const boundaries = { left: 6, right: 4, top: 5, bottom: 5 };
  const frame = context.boundariesToFrame(boundaries);
  const report = context.getCenteringReport(boundaries, frame);
  assert.equal(report.left, 60);
  assert.equal(report.right, 40);
  assert.equal(report.top, 50);
  assert.equal(report.bottom, 50);
  assert.equal(JSON.stringify(context.frameToBoundaries(frame)), JSON.stringify(boundaries));
});

test('tilted print frame reports its worse edge instead of averaging away the deviation', () => {
  const report = context.getCenteringReport(null, {
    tl: { x: 4, y: 5 }, tr: { x: 96, y: 5 }, bl: { x: 6, y: 95 }, br: { x: 96, y: 95 }
  });
  assert.equal(report.left, 60);
  assert.equal(report.right, 40);
});

test('outline validation rejects crossed and tiny selections', () => {
  const card = { tl: { x: 10, y: 10 }, tr: { x: 90, y: 10 }, br: { x: 90, y: 90 }, bl: { x: 10, y: 90 } };
  assert.equal(context.getOutlineValidation(card, 630, 880).valid, true);
  assert.equal(context.getOutlineValidation({ ...card, tr: card.br, br: card.tr }, 630, 880).valid, false);
  const tiny = { tl: { x: 10, y: 10 }, tr: { x: 11, y: 10 }, br: { x: 11, y: 11 }, bl: { x: 10, y: 11 } };
  assert.equal(context.getOutlineValidation(tiny, 630, 880).valid, false);
});

test('equal-contrast edge plateaus use their center rather than biasing both borders left', () => {
  const width = 200, height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = x >= 80 && x < 120 ? 240 : 20;
      pixels.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  const left = context.findStrongestEdge(pixels, width, height, 'vertical', 60, 100, 20, 80);
  const right = context.findStrongestEdge(pixels, width, height, 'vertical', 100, 140, 20, 80);
  assert.equal(left.position, 79.5);
  assert.equal(right.position, 119.5);
  assert.equal((left.position + right.position) / 2, 99.5);
});

function analyzeSyntheticCard({ left = 19, right = 302, top = 22, bottom = 418, blank = false } = {}) {
  const width = 315, height = 440;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = !blank && x >= left && x < right && y >= top && y < bottom ? 30 : 240;
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  context.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ width, height, data })
  }) }) };
  return context.analyzeCapturedCanvas({});
}

test('captured image analysis uses detected asymmetric borders, not a fixed 50:50 guide', () => {
  const analysis = analyzeSyntheticCard();
  const report = context.getCenteringReport(analysis.boundaries);
  assert.ok(Math.abs(report.left - 59.375) < 0.1);
  assert.ok(Math.abs(report.top - 50) < 0.1);
  assert.ok(analysis.confidence > 0.8);
});

test('blank images and an undetected edge cannot receive high detection confidence', () => {
  assert.equal(analyzeSyntheticCard({ blank: true }).confidence, 0);
  assert.equal(analyzeSyntheticCard({ left: 0 }).confidence, 0);
});
