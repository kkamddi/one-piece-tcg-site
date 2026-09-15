import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RIFTBOUND_SET_PRODUCTS } from '../src/data/riftbound-set-products.js';

const files = { KR: 'riftbound-preview-kr.json', EN: 'riftbound-preview.json', CN: 'riftbound-preview-cn.json' };
const quote = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;

export async function prepareCatalog() {
  const statements = [];
  const editions = [];
  const ids = new Set();
  for (const [locale, file] of Object.entries(files)) {
    const snapshot = JSON.parse(await readFile(new URL(`../src/data/${file}`, import.meta.url), 'utf8'));
    const { sets, cards, ...metadata } = snapshot;
    const products = RIFTBOUND_SET_PRODUCTS[locale] || {};
    const setIds = new Set(sets.map((set) => set.id));
    if (snapshot.locale !== locale || !cards.length || setIds.size !== sets.length) throw new Error(`Invalid edition: ${locale}`);
    for (const card of cards) {
      if (!card.id.startsWith(`riftbound:${locale}:`) || ids.has(card.id) || !setIds.has(card.set) || !card.code || !card.name || !card.image.startsWith('https://')) throw new Error(`Invalid card: ${card.id}`);
      ids.add(card.id);
    }
    const revision = createHash('sha256').update(JSON.stringify({ snapshot, products })).digest('hex');
    statements.push(`INSERT INTO riftbound_catalog_editions (locale,revision,card_count,metadata_json) VALUES (${[locale, revision, cards.length, JSON.stringify(metadata)].map(quote).join(',')}) ON CONFLICT(locale) DO UPDATE SET revision=excluded.revision,card_count=excluded.card_count,metadata_json=excluded.metadata_json WHERE revision<>excluded.revision;`);
    sets.forEach((set, index) => {
      const values = [locale, set.id, index, JSON.stringify(set), products[set.id] ? JSON.stringify(products[set.id]) : null];
      statements.push(`INSERT INTO riftbound_catalog_sets (locale,set_id,sort_order,set_json,product_json) VALUES (${values.map(quote).join(',')}) ON CONFLICT(locale,set_id) DO UPDATE SET sort_order=excluded.sort_order,set_json=excluded.set_json,product_json=excluded.product_json WHERE sort_order<>excluded.sort_order OR set_json<>excluded.set_json OR product_json IS NOT excluded.product_json;`);
    });
    for (const [index, card] of cards.entries()) {
      statements.push(`INSERT INTO riftbound_catalog_cards (id,locale,set_id,code,sort_order,card_json) VALUES (${[card.id, locale, card.set, card.code, index, JSON.stringify(card)].map(quote).join(',')}) ON CONFLICT(id) DO UPDATE SET set_id=excluded.set_id,code=excluded.code,sort_order=excluded.sort_order,card_json=excluded.card_json WHERE card_json<>excluded.card_json OR sort_order<>excluded.sort_order;`);
    }
    editions.push({ locale, revision, total: cards.length, snapshot, products });
  }
  return { sql: statements.join('\n') + '\n', editions };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { sql, editions } = await prepareCatalog();
  const output = resolve(process.argv[2] || 'artifacts/riftbound-d1-seed.sql');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, sql);
  console.log(JSON.stringify({ output, bytes: Buffer.byteLength(sql), editions: editions.map(({ locale, revision, total }) => ({ locale, revision, total })) }, null, 2));
}
