// Writes the starter deck guide to src/data/starter-decks-guide.json so the app can show it without loading the 14MB card list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStarterDecksEditorial, getStarterDecksFaq, getStarterDecksSeo } from '../lib/starter-decks-editorial.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readData = (name) => JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'data', name), 'utf8'));
const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const args = [readData('series.json'), readData('cards.json'), today, readData('topics.json')];

const output = {
  seo: getStarterDecksSeo(...args),
  editorial: buildStarterDecksEditorial(...args),
  faq: getStarterDecksFaq(...args)
};
fs.writeFileSync(path.join(rootDir, 'src', 'data', 'starter-decks-guide.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`starter-decks-guide.json: ${output.editorial.sections.length} sections (${today})`);
