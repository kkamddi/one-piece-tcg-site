import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedDir = path.join(rootDir, 'data/supabase-card-seed');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isDryRun = process.argv.includes('--dry-run');
const batchSizeArg = process.argv.find((arg) => arg.startsWith('--batch-size='));
const batchSize = Number(batchSizeArg?.split('=')[1] || 250);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(seedDir, fileName), 'utf8'));
}

async function assertTableExists(table) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (!error) return;

  const hint = error.code === 'PGRST205'
    ? `Table "${table}" is missing. Run docs/card-db-schema.sql in Supabase SQL editor first.`
    : `Cannot access "${table}": ${error.message}`;
  throw new Error(hint);
}

async function upsertInBatches(table, rows, onConflict = 'id') {
  if (isDryRun) {
    console.log(`[dry-run] ${table}: ${rows.length} rows`);
    return;
  }

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict });

    if (error) {
      throw new Error(`${table} batch ${start}-${start + batch.length - 1}: ${error.message}`);
    }

    console.log(`${table}: upserted ${Math.min(start + batch.length, rows.length)}/${rows.length}`);
  }
}

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
  return count || 0;
}

async function main() {
  const [seriesRows, cardRows] = await Promise.all([
    readJson('card_series.json'),
    readJson('cards.json')
  ]);

  await assertTableExists('card_series');
  await assertTableExists('cards');
  await assertTableExists('card_search_aliases');

  console.log(`Seed ready: ${seriesRows.length} series, ${cardRows.length} cards`);

  await upsertInBatches('card_series', seriesRows);
  await upsertInBatches('cards', cardRows);

  if (!isDryRun) {
    const [seriesCount, cardsCount] = await Promise.all([
      countRows('card_series'),
      countRows('cards')
    ]);
    console.log(`Supabase counts: ${seriesCount} series, ${cardsCount} cards`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
