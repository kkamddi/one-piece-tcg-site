import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import boxMarketItems from '../src/data/box-market-items.js';
import previousPrices from '../src/data/box-market-prices.js';

const OUTPUT_URL = new URL('../src/data/box-market-prices.js', import.meta.url);
const BATCH_SIZE = 4;

function isRecommendationBox(item) {
  return /^(?:OP|EB|PRB)-?\d+/i.test(String(item?.code || ''));
}

async function fetchBoxPrice(item) {
  const response = await fetch(`https://snkrdunk.com/en/v1/products/SW---${Number(item.apparelId)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 CardPoneBoxPriceSync/1.0'
    }
  });
  if (!response.ok) throw new Error(`${item.code}#${item.apparelId}: ${response.status}`);
  const body = await response.json();
  const currency = String(body?.currency || '').toUpperCase();
  const priceKrw = currency === 'KRW' ? Math.round(Number(body?.minPrice || 0)) : 0;
  if (priceKrw <= 0) throw new Error(`${item.code}#${item.apparelId}: KRW price unavailable`);
  return [String(item.apparelId), {
    priceKrw,
    listingCount: Number(body?.listingCount || 0)
  }];
}

async function main() {
  const targets = boxMarketItems.filter(isRecommendationBox);
  const targetIds = new Set(targets.map((item) => String(item.apparelId)));
  const entries = new Map(
    Object.entries(previousPrices || {}).filter(([apparelId]) => targetIds.has(apparelId)),
  );
  const failures = [];
  for (let index = 0; index < targets.length; index += BATCH_SIZE) {
    const batch = targets.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(fetchBoxPrice));
    results.forEach((result, resultIndex) => {
      if (result.status === 'fulfilled') entries.set(...result.value);
      else failures.push(`${batch[resultIndex].code}: ${result.reason?.message || result.reason}`);
    });
  }
  const prices = Object.fromEntries([...entries].sort((a, b) => Number(a[0]) - Number(b[0])));
  const source = `export default ${JSON.stringify(prices, null, 2)};\n`;
  await writeFile(fileURLToPath(OUTPUT_URL), source, 'utf8');
  console.log(`Available ${entries.size}/${targets.length} recommendation box prices.`);
  if (failures.length) {
    console.warn(failures.join('\n'));
    if (!entries.size) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
