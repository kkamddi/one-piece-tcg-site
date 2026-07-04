import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MARKET_PATH = path.resolve('src/data/market-cards.js');
const TMP_DIR = path.resolve('.tmp');
const HEAD_TMP_PATH = path.join(TMP_DIR, 'market-cards-head.restore.mjs');

fs.mkdirSync(TMP_DIR, { recursive: true });

const headRaw = execFileSync('git', ['show', 'HEAD:src/data/market-cards.js'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
fs.writeFileSync(HEAD_TMP_PATH, headRaw);

const currentCards = (await import(`${pathToFileURL(MARKET_PATH).href}?restore=${Date.now()}`)).default || [];
const headCards = (await import(`${pathToFileURL(HEAD_TMP_PATH).href}?restore=${Date.now()}`)).default || [];

const headByApparelId = new Map(headCards.map((item) => [Number(item.apparelId), item]));

let restoredExisting = 0;
let preservedCurrentOnly = 0;

const restoredCards = currentCards.map((item) => {
  const headItem = headByApparelId.get(Number(item.apparelId));
  if (!headItem) {
    preservedCurrentOnly += 1;
    return item;
  }
  restoredExisting += 1;
  return headItem;
});

function serializeCompactMarketCards(value) {
  const json = JSON.stringify(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `const e=JSON.parse(\`${json}\`);export{e as default};\n`;
}

fs.writeFileSync(MARKET_PATH, serializeCompactMarketCards(restoredCards));

console.log(JSON.stringify({
  currentRows: currentCards.length,
  headRows: headCards.length,
  restoredExisting,
  preservedCurrentOnly,
  finalRows: restoredCards.length
}, null, 2));
