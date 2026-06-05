import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath = '.env.local') {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return;
  const lines = fs.readFileSync(resolved, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

loadEnvFile();

const endpoint = process.env.MARKET_COLLECTOR_URL || 'https://www.optcgkorea.com/api/market-collector';
const token = process.env.MARKET_COLLECTOR_TOKEN;
const scope = process.env.MARKET_COLLECTOR_SCOPE || 'approved';
const limit = Math.max(1, Math.min(50, Number(process.env.MARKET_COLLECTOR_LIMIT || 25)));
const concurrency = Math.max(1, Math.min(8, Number(process.env.MARKET_COLLECTOR_CONCURRENCY || 4)));
const delayMs = Math.max(0, Number(process.env.MARKET_COLLECTOR_DELAY_MS || 1000));
const maxBatches = Math.max(1, Number(process.env.MARKET_COLLECTOR_MAX_BATCHES || 1000));

if (!token) {
  throw new Error('MARKET_COLLECTOR_TOKEN is required');
}

let offset = Math.max(0, Number(process.env.MARKET_COLLECTOR_OFFSET || 0));
let batches = 0;
let collected = 0;
let priced = 0;
let failed = 0;
const errors = [];

while (batches < maxBatches) {
  const url = new URL(endpoint);
  url.searchParams.set('scope', scope);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('concurrency', String(concurrency));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(`collector failed at offset ${offset}: ${response.status} ${JSON.stringify(body)}`);
  }

  batches += 1;
  collected += Number(body.collected || 0);
  priced += Number(body.priced || 0);
  failed += Number(body.failed || 0);
  if (Array.isArray(body.errors)) errors.push(...body.errors);

  console.log(JSON.stringify({
    batch: batches,
    scope: body.scope,
    total: body.total,
    offset: body.offset,
    nextOffset: body.nextOffset,
    collected: body.collected,
    priced: body.priced,
    failed: body.failed,
    done: body.done
  }));

  if (body.done) break;
  offset = Number(body.nextOffset || 0);
  if (delayMs) await sleep(delayMs);
}

console.log(JSON.stringify({
  ok: true,
  batches,
  collected,
  priced,
  failed,
  errors: errors.slice(0, 10)
}, null, 2));
