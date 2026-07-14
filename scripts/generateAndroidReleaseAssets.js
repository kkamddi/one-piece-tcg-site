import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_ICON = path.join(ROOT, 'public', 'card-pone-app-icon-512.png');
const FEATURE_SOURCE = path.join(ROOT, 'public', 'og-card-pone.jpg');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const STORE = path.join(ROOT, 'store', 'android');
const TRANSPARENT = { r: 255, g: 255, b: 255, alpha: 0 };

const densities = {
  mdpi: { legacy: 48, adaptive: 108 },
  hdpi: { legacy: 72, adaptive: 162 },
  xhdpi: { legacy: 96, adaptive: 216 },
  xxhdpi: { legacy: 144, adaptive: 324 },
  xxxhdpi: { legacy: 192, adaptive: 432 },
};

async function containLogo(size, ratio, background = TRANSPARENT) {
  const logoSize = Math.round(size * ratio);
  const logo = await sharp(SOURCE_ICON)
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function roundIcon(size) {
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#ffffff"/></svg>`,
  );
  const logoSize = Math.round(size * 0.72);
  const logo = await sharp(SOURCE_ICON)
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: circle }, { input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

await Promise.all(Object.entries(densities).flatMap(async ([density, sizes]) => {
  const directory = path.join(RES, `mipmap-${density}`);
  await mkdir(directory, { recursive: true });
  const [legacy, round, foreground] = await Promise.all([
    containLogo(sizes.legacy, 0.88),
    roundIcon(sizes.legacy),
    containLogo(sizes.adaptive, 0.66),
  ]);
  await Promise.all([
    sharp(legacy).toFile(path.join(directory, 'ic_launcher.png')),
    sharp(round).toFile(path.join(directory, 'ic_launcher_round.png')),
    sharp(foreground).toFile(path.join(directory, 'ic_launcher_foreground.png')),
  ]);
}));

await mkdir(STORE, { recursive: true });
const storeIcon = await containLogo(512, 0.82, { r: 255, g: 255, b: 255, alpha: 1 });
await Promise.all([
  sharp(storeIcon).toFile(path.join(STORE, 'app-icon-512.png')),
  sharp(FEATURE_SOURCE)
    .resize(1024, 500, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(STORE, 'feature-graphic-1024x500.jpg')),
]);

console.log('Android launcher and Play Store assets generated.');
