import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import cards from '../src/data/cards.json' with { type: 'json' };

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback = '') => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const LOCALES = new Set((getArg('--locales', 'KR,JP') || 'KR,JP').split(',').map((item) => item.trim()).filter(Boolean));
const SERIES = new Set((getArg('--series', '') || '').split(',').map((item) => item.trim()).filter(Boolean));
const LIMIT = Number(getArg('--limit', '0')) || 0;
const OUT_DIR = getArg('--out', 'data/card-thumbnails');
const BUCKET = getArg('--bucket', 'optcg-card-thumbnails');
const SHOULD_UPLOAD = args.has('--upload');
const SHOULD_FORCE = args.has('--force');
const WIDTH = Number(getArg('--width', '320')) || 320;
const QUALITY = Number(getArg('--quality', '74')) || 74;
const CONCURRENCY = Math.max(1, Math.min(Number(getArg('--concurrency', '4')) || 4, 8));

function cardThumbKey(card) {
  const localId = String(card.id || '').replace(/^[A-Z]+::/, '');
  return `cards/${card.locale}/${localId}.webp`;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchImageBuffer(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'optcgkorea-thumbnail-generator/1.0',
        referer: new URL(url).origin + '/'
      }
    });
    if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const result = spawnSync('curl.exe', ['-L', '-sS', '--max-time', '30', url], {
      encoding: 'buffer',
      maxBuffer: 8 * 1024 * 1024
    });
    if (result.status !== 0 || !result.stdout?.length) {
      throw new Error(`fetch_failed:${error.message}`);
    }
    return Buffer.from(result.stdout);
  }
}

function uploadToR2(filePath, key) {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${BUCKET}/${key}`,
    '--file',
    filePath,
    '--remote',
    '--content-type',
    'image/webp'
  ], { stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error((result.error?.message || result.stderr || result.stdout || 'r2_upload_failed').trim());
  }
}

const targets = cards
  .filter((card) => LOCALES.has(card.locale) && (!SERIES.size || SERIES.has(card.series)) && card.imageUrl)
  .slice(0, LIMIT || undefined);

const manifest = [];
const stats = {
  generated: 0,
  skipped: 0,
  uploaded: 0,
  failed: 0
};

async function processCard(card) {
  const key = cardThumbKey(card);
  const outputPath = path.join(OUT_DIR, key);
  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    if (!SHOULD_FORCE && await exists(outputPath)) {
      stats.skipped += 1;
    } else {
      const source = await fetchImageBuffer(card.imageUrl);
      const webp = await sharp(source, { failOn: 'none' })
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 4 })
        .toBuffer();
      await writeFile(outputPath, webp);
      stats.generated += 1;
    }

    if (SHOULD_UPLOAD) {
      uploadToR2(outputPath, key);
      stats.uploaded += 1;
    }
    manifest.push({ id: card.id, locale: card.locale, cardNo: card.cardNo, key });
  } catch (error) {
    stats.failed += 1;
    console.error(`[thumbnail failed] ${card.id} ${card.imageUrl} ${error.message}`);
  }
}

let cursor = 0;
async function worker() {
  for (;;) {
    const index = cursor;
    cursor += 1;
    if (index >= targets.length) return;
    await processCard(targets[index]);
    if ((index + 1) % 100 === 0) {
      console.log(`[thumbnail progress] ${index + 1}/${targets.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()));

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(JSON.stringify({
  targets: targets.length,
  generated: stats.generated,
  skipped: stats.skipped,
  uploaded: stats.uploaded,
  failed: stats.failed,
  concurrency: CONCURRENCY,
  outDir: OUT_DIR,
  bucket: SHOULD_UPLOAD ? BUCKET : null
}, null, 2));
