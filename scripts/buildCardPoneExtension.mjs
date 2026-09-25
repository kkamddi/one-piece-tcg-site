import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import react from '@vitejs/plugin-react';
import { mkdir, copyFile, cp, readFile, writeFile, access, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(repo, 'extensions/card-pone');
const out = process.env.CARD_PONE_RELEASE === '1'
  ? join(repo, 'artifacts', `card-pone-store-${Date.now()}`)
  : join(repo, 'artifacts/card-pone-extension');
const ocr = join(out, 'ocr');
await mkdir(ocr, { recursive: true });

// Ship model data locally. No remote code or captured image is sent to a server.
const model = join(ocr, 'eng.traineddata');
try { await access(model); }
catch {
  const existingModel = join(repo, 'artifacts/card-pone-extension/ocr/eng.traineddata');
  try { await copyFile(existingModel, model); }
  catch {
  const url = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata';
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`OCR model download: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 1_000_000 || data.length > 20_000_000) throw new Error('Unexpected OCR model size');
  await writeFile(model, data);
  }
}
await viteBuild({
  configFile: false, root: source, base: './', publicDir: false, plugins: [react()],
  build: { outDir: out, emptyOutDir: false, reportCompressedSize: false, rollupOptions: { input: join(source, 'panel.html') } }
});
await bundle({ entryPoints: [join(source, 'background.js')], outfile: join(out, 'background.js'), bundle: true, format: 'esm', platform: 'browser', target: 'chrome116' });
await bundle({ entryPoints: [join(source, 'sandbox.js')], outfile: join(out, 'sandbox.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome116' });
await bundle({ entryPoints: [join(repo, 'src/lib/card-image-worker.js')], outfile: join(out, 'image-engine.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome116', external: ['fs', 'path', 'crypto'] });
await copyFile(join(source, 'manifest.json'), join(out, 'manifest.json'));
const sandbox = await readFile(join(source, 'sandbox.html'), 'utf8');
await writeFile(join(out, 'sandbox.html'), sandbox.replace('type="module" ', ''));
await copyFile(join(repo, 'node_modules/tesseract.js/dist/worker.min.js'), join(ocr, 'worker.min.js'));
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  for (const suffix of ['wasm.js', 'wasm']) {
    const name = `tesseract-core-${variant}.${suffix}`;
    await copyFile(join(repo, 'node_modules/tesseract.js-core', name), join(ocr, name));
  }
}
// The remote reference manifest is not used by the bundled fallback. CWS
// rejects packages containing a second file named manifest.json.
await cp(join(repo, 'public/card-scan'), join(out, 'card-scan'), {
  recursive: true,
  filter: path => path !== join(repo, 'public/card-scan/manifest.json')
});
const logo = await sharp(join(repo, 'public/optcg-logo-light.png')).trim().png().toBuffer();
await sharp(logo).resize({ width: 320 }).toFile(join(out, 'logo.png'));
for (const size of [32, 128]) await sharp(logo).resize(size, size, { fit: 'contain', background: '#ffffff' }).png().toFile(join(out, `icon${size}.png`));
const licenses = ['tesseract.js', 'tesseract.js-core', '@techstark/opencv-js', 'react', 'react-dom'];
await mkdir(join(out, 'licenses'), { recursive: true });
for (const name of licenses) {
  const packageDir = join(repo, 'node_modules', name);
  const license = (await readdir(packageDir)).find(file => /^licen[cs]e(?:\.|$)/i.test(file));
  if (!license) throw new Error(`Missing license: ${name}`);
  await copyFile(join(packageDir, license), join(out, 'licenses', `${name.replaceAll('/', '-')}.txt`));
}
await writeFile(join(out, 'build-info.json'), JSON.stringify({ builtAt: new Date().toISOString(), modelSource: 'tesseract-ocr/tessdata_fast/4.1.0', modelSha256: createHash('sha256').update(await readFile(model)).digest('hex'), index: JSON.parse(await readFile(join(out, 'card-scan/report.json'), 'utf8')) }, null, 2));
console.log(`Unpacked extension: ${out}`);
