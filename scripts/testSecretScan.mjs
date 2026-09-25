import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scanner = fileURLToPath(new URL('./scan-tracked-secrets.mjs', import.meta.url));

test('secret scan excludes only valid image descriptors and still checks metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'card-pone-secret-scan-'));
  const file = 'public/card-scan/JP/OP09-084.json';
  const syntheticKey = 'AI' + 'za' + 'B'.repeat(35);
  const descriptor = syntheticKey + 'A'.repeat(128 - syntheticKey.length);
  const item = { points: [1, 2, 3, 4, 5, 6], descriptors: descriptor };
  try {
    execFileSync('git', ['init', '--quiet', root], { windowsHide: true });
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '{}');
    execFileSync('git', ['add', file], { cwd: root, windowsHide: true });
    function scan(data) {
      writeFileSync(join(root, file), JSON.stringify(data));
      return spawnSync(process.execPath, [scanner], { cwd: root, encoding: 'utf8', windowsHide: true });
    }
    assert.equal(scan({ version: 3, items: [item] }).status, 0);
    for (const data of [
      { version: 3, items: [item], apiKey: syntheticKey },
      { version: 3, items: [{ ...item, descriptors: syntheticKey }] },
      { version: 3, items: [{ ...item, points: [1, 2] }] },
      { version: 2, items: [item] },
      { version: 3, items: [{ ...item, points: ['1', 2, 3, 4, 5, 6] }] }
    ]) {
      const result = scan(data);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Google API key/);
      assert.ok(!result.stderr.includes(syntheticKey), 'Secret values must remain redacted');
    }
    const other = 'fixture.json';
    writeFileSync(join(root, other), JSON.stringify({ version: 3, items: [item] }));
    execFileSync('git', ['add', other], { cwd: root, windowsHide: true });
    assert.equal(scan({ version: 3, items: [item] }).status, 1);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'card-pone-secret-scan-')));
    rmSync(root, { recursive: true, force: true });
  }
});
