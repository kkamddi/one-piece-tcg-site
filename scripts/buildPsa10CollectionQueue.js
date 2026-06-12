import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(rootDir, 'data', 'psa10-targets', 'jp-op-pr-targets.json');
const manualLinksPath = path.join(rootDir, 'data', 'psa10-targets', 'manual-psa-spec-links.json');
const outDir = path.join(rootDir, 'data', 'psa10-targets');
const outPath = path.join(outDir, 'jp-op-pr-collection-queue.json');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[・･]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchTerms(target) {
  const code = target.cardNo;
  const name = normalizeText(target.name);
  const rarity = normalizeText(target.rarity);
  const setName = normalizeText(target.seriesName);
  const base = [
    'PSA 10',
    'One Piece Card Game',
    'Japanese',
    code,
    name,
    rarity,
  ].filter(Boolean);
  const withSet = [...base, setName].filter(Boolean);
  return {
    primary: base.join(' '),
    withSet: withSet.join(' '),
    psaSearchUrl: `https://www.psacard.com/search?q=${encodeURIComponent(base.join(' '))}`,
    googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${base.join(' ')} site:psacard.com/spec/psa`)}`,
  };
}

function priorityScore(target) {
  let score = 0;
  const rarity = String(target.rarity || '').toUpperCase();
  const id = String(target.cardId || '');
  if (target.snkrdunkApparelId) score += 30;
  if (rarity.includes('SP')) score += 24;
  if (rarity === 'SEC') score += 20;
  if (rarity === 'L') score += 12;
  if (rarity === 'SR') score += 8;
  if (rarity === 'P') score += 14;
  if (/_p\d+$/.test(id)) score += 10;
  if (/^JP::P-/.test(id)) score += 8;
  return score;
}

const payload = JSON.parse(await readFile(inputPath, 'utf8'));
const manualLinks = JSON.parse(await readFile(manualLinksPath, 'utf8')).filter((item) => item.status === 'approved');
const manualByCardId = new Map(manualLinks.map((item) => [item.cardId, item]));
const targets = payload.targets || [];

const queue = targets
  .map((target) => {
    const manual = manualByCardId.get(target.cardId);
    const psaSpecUrl = manual?.psaSpecUrl || target.psaSpecUrl || null;
    return {
      ...target,
      psaSpecUrl,
      psaSpecNote: manual?.note || null,
      priorityScore: priorityScore(target),
      search: buildSearchTerms(target),
      collectStatus: psaSpecUrl ? 'ready' : 'needs_spec_url',
    };
  })
  .sort((a, b) => b.priorityScore - a.priorityScore || String(a.cardNo).localeCompare(String(b.cardNo)));

const summary = {
  generatedAt: new Date().toISOString(),
  source: path.relative(rootDir, inputPath).replace(/\\/g, '/'),
  output: path.relative(rootDir, outPath).replace(/\\/g, '/'),
  counts: {
    total: queue.length,
    ready: queue.filter((item) => item.collectStatus === 'ready').length,
    needsSpecUrl: queue.filter((item) => item.collectStatus === 'needs_spec_url').length,
    withApprovedSnkrdunkMapping: queue.filter((item) => item.snkrdunkApparelId).length,
    needsSnkrdunkMapping: queue.filter((item) => !item.snkrdunkApparelId).length,
  },
  topPrioritySamples: queue.slice(0, 20).map((item) => ({
    cardId: item.cardId,
    cardNo: item.cardNo,
    rarity: item.rarity,
    name: item.name,
    priorityScore: item.priorityScore,
    snkrdunkApparelId: item.snkrdunkApparelId,
    search: item.search.primary,
  })),
};

await mkdir(outDir, { recursive: true });
await writeFile(outPath, JSON.stringify({ summary, queue }, null, 2), 'utf8');

console.log(JSON.stringify(summary, null, 2));
