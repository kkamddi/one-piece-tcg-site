import { execFileSync } from 'node:child_process';
import cards from '../src/data/cards.json' with { type: 'json' };

const getArg = (name, fallback = '') => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const BASE_URL = getArg('--base-url', 'https://www.optcgkorea.com').replace(/\/+$/, '');
const SINCE_REF = getArg('--since', '');
const CONCURRENCY = Math.max(1, Math.min(Number(getArg('--concurrency', '16')) || 16, 32));

function getExistingCardIds(ref) {
  if (!ref) return null;
  const snapshot = execFileSync('git', ['show', `${ref}:src/data/cards.json`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  return new Set(JSON.parse(snapshot).map((card) => card.id));
}

function cardThumbKey(card) {
  const localId = String(card.id || '').replace(/^[A-Z]+::/, '');
  return `cards/${card.locale}/${localId}.webp`;
}

const existingCardIds = getExistingCardIds(SINCE_REF);
const targets = cards.filter((card) => card.imageUrl && (!existingCardIds || !existingCardIds.has(card.id)));
const failures = [];
let cursor = 0;
let verified = 0;

async function worker() {
  for (;;) {
    const index = cursor;
    cursor += 1;
    if (index >= targets.length) return;
    const card = targets[index];
    const key = cardThumbKey(card);
    try {
      const response = await fetch(`${BASE_URL}/api/card-thumb?key=${encodeURIComponent(key)}`);
      const body = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      if (response.status === 200 && contentType.includes('image/webp') && body.byteLength > 1000) {
        verified += 1;
      } else {
        failures.push({ id: card.id, status: response.status, contentType, bytes: body.byteLength });
      }
    } catch (error) {
      failures.push({ id: card.id, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()));

console.log(JSON.stringify({
  targets: targets.length,
  verified,
  failed: failures.length,
  sinceRef: SINCE_REF || null,
  baseUrl: BASE_URL,
  failures
}, null, 2));

if (failures.length) process.exitCode = 1;
