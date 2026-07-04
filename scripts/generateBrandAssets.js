import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const RED = '#b51f24';
const BLACK = '#111111';
const BG = '#fbfaf8';
const OUT = 'public';

function iconSvg(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="${BG}"/>
      <text x="50%" y="44%" text-anchor="middle"
        font-family="Arial Black, Pretendard, Arial, sans-serif"
        font-size="${Math.round(size * 0.19)}" font-weight="900"
        fill="${BLACK}" letter-spacing="${Math.round(size * -0.006)}">OPTCG</text>
      <text x="50%" y="66%" text-anchor="middle"
        font-family="Arial, Pretendard, sans-serif"
        font-size="${Math.round(size * 0.14)}" font-weight="700"
        fill="${RED}" letter-spacing="${Math.round(size * 0.032)}">Korea</text>
    </svg>
  `);
}

async function makeIcon(size, file) {
  await sharp(iconSvg(size)).png().toFile(`${OUT}/${file}`);
}

async function makeFavicon() {
  await sharp(iconSvg(256)).resize(96, 96).png().toFile(`${OUT}/favicon.png`);
  await sharp(iconSvg(256)).resize(96, 96).jpeg({ quality: 92 }).toFile(`${OUT}/favicon.jpg`);
  await sharp(iconSvg(256)).resize(96, 96).png().toFile(`${OUT}/favicon-v2.png`);
  await sharp(iconSvg(256)).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
  await sharp(iconSvg(256)).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon-v2.png`);
  await writeFile(`${OUT}/favicon.svg`, iconSvg(256), 'utf8');
}

async function makeOgPreview() {
  const width = 1200;
  const height = 630;
  const logo = await sharp(`${OUT}/optcg-logo-light.png`)
    .resize({ width: 720, height: 260, fit: 'inside' })
    .png()
    .toBuffer();

  const subtitle = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${BG}"/>
      <text x="50%" y="430" text-anchor="middle"
        font-family="Pretendard, Arial, sans-serif"
        font-size="36" font-weight="800"
        fill="#333842">원피스 카드 도감 · 시세 · 컬렉션 관리</text>
      <text x="50%" y="485" text-anchor="middle"
        font-family="Pretendard, Arial, sans-serif"
        font-size="25" font-weight="700"
        fill="#8a9099">OPTCG Korea</text>
    </svg>
  `);

  const og = sharp(subtitle)
    .composite([{ input: logo, gravity: 'north', top: 155, left: 240 }])
    .jpeg({ quality: 92 });

  const ogBuffer = await og.toBuffer();
  await sharp(ogBuffer).toFile(`${OUT}/og-preview.jpg`);
  await sharp(ogBuffer).toFile(`${OUT}/og-preview-optcg.jpg`);
}

await makeIcon(192, 'app-icon-192.png');
await makeIcon(512, 'app-icon-512.png');
await makeIcon(192, 'app-icon-v2-192.png');
await makeIcon(512, 'app-icon-v2-512.png');
await makeFavicon();
await makeOgPreview();
