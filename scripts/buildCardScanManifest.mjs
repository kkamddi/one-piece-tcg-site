import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import catalog from '../src/data/market-cards.js';

const root = new URL('../public/card-scan/', import.meta.url);
const customCatalog = process.argv.find(arg => arg.startsWith('--catalog='))?.slice(10);
const market = customCatalog ? JSON.parse(await readFile(customCatalog, 'utf8')) : catalog;
const items = market.filter(item => ['JP', 'EN'].includes(item.locale)).map(({ apparelId, code, locale, name, setName, previewImageUrl }) => ({ apparelId, code, locale, name, setName, previewImageUrl }));
await writeFile(new URL('catalog.json', root), JSON.stringify({ version: 3, items }));
const files = {};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of ['catalog.json', 'index-JP.json', 'index-EN.json']) files[file] = hash(await readFile(new URL(file, root)));
for (const locale of ['JP', 'EN']) {
  const index = JSON.parse(await readFile(new URL(`index-${locale}.json`, root), 'utf8'));
  for (const code of new Set(index.items.map(item => item.code))) {
    if (!/^[A-Z0-9-]+$/.test(code)) throw new Error('invalid index path');
    const file = `${locale}/${code}.json`;
    files[file] = hash(await readFile(new URL(file, root)));
  }
}
await writeFile(new URL('manifest.json', root), JSON.stringify({ schema: 1, indexVersion: 3, revision: hash(JSON.stringify(files)), files }));
console.log(`Published metadata for ${items.length} products, ${Object.keys(files).length} files`);
