// Copies the card catalog into dist as a static file. The API reads it through the ASSETS binding
// only when D1 and the R2 snapshot fail, so the catalog does not count toward the 25 MiB Functions limit.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(rootDir, 'dist/card-data/cards-fallback.json');
const cards = JSON.parse(await readFile(path.join(rootDir, 'src/data/cards.json'), 'utf8'));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(cards), 'utf8');
console.log(`[cards-fallback] ${cards.length} cards -> ${path.relative(rootDir, outputPath)}`);
