import { mkdir, writeFile } from 'node:fs/promises';
const token = process.env.MARKET_COLLECTOR_TOKEN;
if (!token) throw new Error('Missing collector token');
const response = await fetch('https://www.optcgkorea.com/api/market-collector?action=recognition-catalog', {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000)
});
if (!response.ok) throw new Error(`Catalog export failed: ${response.status}`);
const { items } = await response.json();
if (!Array.isArray(items) || items.length < 9000 || items.some(item => !['JP', 'EN'].includes(item.locale))) throw new Error('Incomplete catalog export');
await mkdir('tmp', { recursive: true });
await writeFile('tmp/card-scan-catalog.json', JSON.stringify(items));
console.log(`Exported ${items.length} public products`);
