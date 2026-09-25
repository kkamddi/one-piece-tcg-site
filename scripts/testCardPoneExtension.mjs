import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureCard, cropPixels, captureFailure } from '../extensions/card-pone/capture.js';

const rect = { x: 20, y: 30, width: 100, height: 140, viewportWidth: 1000, viewportHeight: 800 };
const tab = { id: 7, windowId: 3, url: 'https://example.test/cards' };
function api({ selection = rect, active = tab, viewport = { width: 1000, height: 800 } } = {}) {
  let calls = 0, screenshots = 0;
  return {
    scripting: { executeScript: async () => [{ result: calls++ === 0 ? selection : viewport }] },
    tabs: { query: async () => [active], captureVisibleTab: async (windowId, options) => { assert.equal(windowId, 3); assert.equal(options.format, 'png'); screenshots++; return 'data:image/png;base64,test'; } },
    get screenshots() { return screenshots; }
  };
}

test('crop uses actual screenshot scale, including fractional display scaling', () => {
  assert.deepEqual(cropPixels(rect, 2000, 1600), { x: 40, y: 60, width: 200, height: 280 });
  assert.deepEqual(cropPixels(rect, 1250, 1000), { x: 25, y: 37, width: 125, height: 175 });
});
test('invalid or out-of-bounds selections are rejected', () => {
  for (const changes of [{ x: -1 }, { width: 0 }, { height: NaN }, { x: 999 }, { viewportWidth: 0 }]) assert.throws(() => cropPixels({ ...rect, ...changes }, 2000, 1600));
});
test('capture only follows an explicit completed selection on the same active tab', async () => {
  const chrome = api();
  const result = await captureCard(chrome, tab, 'test');
  assert.deepEqual(result.rect, rect); assert.equal(chrome.screenshots, 1);
});
test('cancel never captures a screenshot', async () => {
  const chrome = api({ selection: null });
  assert.equal(await captureCard(chrome, tab, 'test'), null); assert.equal(chrome.screenshots, 0);
});
test('tab switching, resize and protected pages abort before capture', async () => {
  for (const chrome of [api({ active: { ...tab, id: 8 } }), api({ active: { ...tab, url: 'https://other.test' } }), api({ viewport: { width: 999, height: 800 } })]) {
    await assert.rejects(captureCard(chrome, tab, 'test'), /tab_changed/); assert.equal(chrome.screenshots, 0);
  }
  await assert.rejects(captureCard(api(), { ...tab, url: 'chrome://settings' }, 'test'), /unsupported_page/);
});
test('switching during screenshot capture discards the result', async () => {
  const chrome = api(); let queries = 0;
  chrome.tabs.query = async () => [++queries === 1 ? tab : { ...tab, id: 8 }];
  await assert.rejects(captureCard(chrome, tab, 'test'), /tab_changed/);
});
test('MV3 limits persistent data access to Card Pone and disallows remote scripts', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extensions/card-pone/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'sidePanel']);
  assert.deepEqual(manifest.host_permissions, ['https://www.optcgkorea.com/*']);
  assert.ok(!manifest.content_security_policy.extension_pages.includes("'unsafe-eval'"));
  assert.ok(manifest.content_security_policy.sandbox.includes("connect-src 'none'"));
  assert.deepEqual(manifest.sandbox.pages, ['sandbox.html']);
});

test('uploaded transparent artwork is flattened before recognition and warnings remain visible without candidates', async () => {
  const panel = await readFile(new URL('../extensions/card-pone/panel.jsx', import.meta.url), 'utf8');
  assert.ok(panel.indexOf("context.fillStyle = '#fff'") < panel.indexOf('context.drawImage(source'));
  assert.ok(panel.indexOf('context.fillRect(0, 0, canvas.width, canvas.height)') < panel.indexOf('context.drawImage(source'));
  assert.ok(panel.indexOf('result?.warnings.length > 0') < panel.indexOf('result?.candidates.length > 0'));
});

test('missing activeTab permission is not mislabeled as a restricted page', async () => {
  const chrome = api();
  await assert.rejects(captureCard(chrome, { ...tab, url: undefined }, 'test'), /tab_permission_required/);
  assert.equal(chrome.screenshots, 0);
  assert.equal(captureFailure(new Error('tab_permission_required')).code, 'TAB_ACCESS');
  assert.equal(captureFailure(new Error('unsupported_page')).code, 'RESTRICTED_PAGE');
  assert.equal(captureFailure(new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.')).code, 'TAB_ACCESS');
});

test('ordinary Naver cafe URLs are supported and capture failures keep their stage', async () => {
  const cafe = { ...tab, url: 'https://cafe.naver.com/cardpone/123' };
  const chrome = api({ active: cafe });
  assert.ok(await captureCard(chrome, cafe, 'test'));
  chrome.scripting.executeScript = async () => [{ result: rect }];
  await assert.rejects(captureCard(chrome, cafe, 'test'), error => captureFailure(error).code === 'PAGE_CHANGED');
  const failedCapture = api({ active: cafe });
  failedCapture.tabs.captureVisibleTab = async () => { throw new Error('Failed to capture tab'); };
  await assert.rejects(captureCard(failedCapture, cafe, 'test'), error => captureFailure(error).code === 'CAPTURE');
});

test('toolbar invocation opens the right window and panel messages stay in that window', async () => {
  let toolbar, listener;
  const opens = [], queries = [];
  globalThis.chrome = {
    action: { onClicked: { addListener: callback => { toolbar = callback; } } },
    sidePanel: { setPanelBehavior: async value => { assert.equal(value.openPanelOnActionClick, false); }, open: async value => { opens.push(value); } },
    runtime: { id: 'test', getURL: file => `chrome-extension://test/${file}`, onMessage: { addListener: callback => { listener = callback; } } },
    tabs: { query: async query => { queries.push(query); return [{ ...tab, url: undefined }]; } }
  };
  try {
    await import('../extensions/card-pone/background.js');
    toolbar(tab);
    assert.deepEqual(opens, [{ windowId: 3 }]);
    const result = await new Promise(resolve => listener({ type: 'card-pone-scan', windowId: 3 }, { id: 'test', url: 'chrome-extension://test/panel.html' }, resolve));
    assert.deepEqual(queries, [{ active: true, windowId: 3 }]);
    assert.equal(result.code, 'TAB_ACCESS');
    const invalid = await new Promise(resolve => listener({ type: 'card-pone-scan' }, { id: 'test', url: 'chrome-extension://test/panel.html' }, resolve));
    assert.equal(invalid.code, 'WINDOW');
    assert.equal(queries.length, 1);
  } finally { delete globalThis.chrome; }
});
