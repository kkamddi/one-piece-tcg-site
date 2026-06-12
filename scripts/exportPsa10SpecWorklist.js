import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const queuePath = path.join(rootDir, 'data', 'psa10-targets', 'jp-op-pr-collection-queue.json');
const outDir = path.join(rootDir, 'data', 'psa10-targets');
const outPath = path.join(outDir, 'jp-op-pr-spec-worklist.csv');

function csv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const payload = JSON.parse(await readFile(queuePath, 'utf8'));
const rows = (payload.queue || []).map((item) => [
  item.collectStatus,
  item.priorityScore,
  item.cardId,
  item.cardNo,
  item.scope,
  item.rarity,
  item.name,
  item.seriesName,
  item.snkrdunkApparelId || '',
  item.snkrdunkSourceUrl || '',
  item.search?.primary || '',
  item.search?.psaSearchUrl || '',
  item.search?.googleSearchUrl || '',
  item.psaSpecUrl || '',
]);

const header = [
  'collectStatus',
  'priorityScore',
  'cardId',
  'cardNo',
  'scope',
  'rarity',
  'name',
  'seriesName',
  'snkrdunkApparelId',
  'snkrdunkSourceUrl',
  'searchQuery',
  'psaSearchUrl',
  'googleSearchUrl',
  'psaSpecUrl',
];

await mkdir(outDir, { recursive: true });
await writeFile(outPath, [header, ...rows].map((row) => row.map(csv).join(',')).join('\n'), 'utf8');
console.log(`${path.relative(rootDir, outPath).replace(/\\/g, '/')} rows=${rows.length}`);
