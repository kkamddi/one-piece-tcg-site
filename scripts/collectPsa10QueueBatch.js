import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : 'true'];
  })
);

const queuePath = path.resolve(rootDir, args.get('queue') || 'data/psa10-targets/jp-op-pr-collection-queue.json');
const limit = Number(args.get('limit') || 10);
const offset = Number(args.get('offset') || 0);
const delayMs = Number(args.get('delay-ms') || 1500);
const headless = args.get('headless') || 'true';
const outDir = path.resolve(rootDir, args.get('out-dir') || 'tmp/psa10-queue-results');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeName(value) {
  return String(value || '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function runNode(script, scriptArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...scriptArgs], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const payload = JSON.parse(await readFile(queuePath, 'utf8'));
const ready = (payload.queue || []).filter((item) => item.psaSpecUrl && item.collectStatus === 'ready');
const batch = ready.slice(offset, offset + limit);

await mkdir(outDir, { recursive: true });

console.log(JSON.stringify({
  queue: path.relative(rootDir, queuePath).replace(/\\/g, '/'),
  ready: ready.length,
  offset,
  limit,
  selected: batch.length,
}, null, 2));

for (let index = 0; index < batch.length; index += 1) {
  const item = batch[index];
  const outFile = path.join(outDir, `${safeName(item.cardId)}.json`);
  const result = await runNode('scripts/collect-psa10-visible-history-cdp.js', [
    `--url=${item.psaSpecUrl}`,
    `--card-id=${item.cardId}`,
    `--card-no=${item.cardNo}`,
    `--locale=${item.locale}`,
    `--name=${item.name}`,
    `--out=${outFile}`,
    `--headless=${headless}`,
  ]);
  console.log(`[${offset + index + 1}/${offset + batch.length}] ${item.cardId} code=${result.code} out=${path.relative(rootDir, outFile).replace(/\\/g, '/')}`);
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim().slice(0, 1200));
  await wait(delayMs);
}
