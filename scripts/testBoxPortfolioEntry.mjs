import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { sealedBoxes } from '../src/box-portfolio.js';

const app = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const pick = (pattern) => app.match(pattern)[0];
const source = [
  pick(/function getBaseSeriesId\(seriesOrId\) \{[\s\S]*?\n\}/),
  pick(/function findSeriesSealedBox\(series\) \{[\s\S]*?\n\}/)
].join('\n');

test('every JP catalog series with a sealed box finds that box', () => {
  const context = { PORTFOLIO_BOXES: sealedBoxes };
  vm.runInNewContext(source, context);
  assert.equal(context.findSeriesSealedBox({ id: 'JP-OP09', baseSeriesId: 'OP09' })?.code, 'OP-09');
  assert.equal(context.findSeriesSealedBox({ id: 'JP-OP17' })?.code, 'OPC-TCG-OP-17');
  assert.equal(context.findSeriesSealedBox({ id: 'JP-EB05', baseSeriesId: 'EB05' })?.code, 'OPC-TCG-EB-05');
  assert.equal(context.findSeriesSealedBox({ id: 'JP-PRB02', baseSeriesId: 'PRB02' })?.code, 'PRB-02');
  assert.equal(context.findSeriesSealedBox({ id: 'JP-ST01', baseSeriesId: 'ST01' }), null);
});

test('box holdings are enabled and every entry point opens the shared purchase editor', () => {
  assert.match(app, /const BOX_PORTFOLIO_ENABLED = true;/);
  assert.match(app, /setPortfolioEditorItem\(\{ \.\.\.box, assetType: 'box', grade: 'a' \}\)/);
  assert.match(app, /setEditor\(\{ \.\.\.box, assetType: 'box', grade: 'a' \}\)/);
  assert.match(app, /onAddBox=\{BOX_PORTFOLIO_ENABLED \? addBoxToPortfolio : undefined\}/);
});

test('boxes can be added at the current lowest listing', () => {
  assert.match(app, /\.filter\(\(\[modeKey\]\) => !isBox \|\| \['current', 'manual', 'later'\]\.includes\(modeKey\)\)/);
  assert.match(app, /const currentPriceJpy = isBox \? Math\.round\(boxCurrentQuote\?\.boxPriceJpy \|\| 0\)/);
  assert.match(app, /referenceSource: mode === 'current' \? \(isBox \? 'listing' : 'current_market'\)/);
});
