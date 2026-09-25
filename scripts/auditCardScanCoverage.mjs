import { readFile } from 'node:fs/promises';
import catalog from '../src/data/market-cards.js';
import { normalizeScanCode } from '../src/lib/card-scan.js';

const root = new URL('../public/card-scan/', import.meta.url);
const report = JSON.parse(await readFile(new URL('report.json', root), 'utf8'));
const failures = new Map(report.failures.map(item => [item.key, item.message]));
const results = [];
for (const locale of ['JP', 'EN']) {
  const index = JSON.parse(await readFile(new URL(`index-${locale}.json`, root), 'utf8'));
  const indexed = new Set(index.items.map(item => item.key));
  const products = catalog.filter(item => item.locale === locale);
  const missing = products.filter(item => !indexed.has(`${locale}-${item.apparelId}`)).map(item => ({
    key: `${locale}-${item.apparelId}`, code: normalizeScanCode(item.code), name: item.name,
    reason: failures.get(`${locale}-${item.apparelId}`) || 'excluded_or_missing'
  }));
  results.push({ locale, products: products.length, indexed: indexed.size, missing });
}
console.log(JSON.stringify({ scope: 'local snapshot, not a live SNKRDUNK completeness guarantee', results }, null, 2));
if (process.argv.includes('--strict') && results.some(result => result.missing.length)) process.exitCode = 1;
