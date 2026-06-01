import fs from 'node:fs';
import path from 'node:path';
import marketCards from '../src/data/market-cards.js';

const OUTPUT_PATH = path.resolve('src/data/pricecharting-market-links.js');

function slugifyPriceChartingPart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function marketItemLooksVariant(item) {
  const text = `${item?.name || ''} ${item?.setName || ''}`;
  return /(?:-P\b|Parallel|Comic|Wanted|SPC|THE BEST|Premium|Promotional|Championship|Winner|Prize|Anniversary|Flagship|World Final|Grand Asia|English)/i.test(text);
}

function derivePriceChartingUrl(item) {
  if (!item?.code || !item?.name || !item?.setName) return '';
  if (marketItemLooksVariant(item)) return '';

  const cleanSet = String(item.setName || '')
    .replace(/^Booster Pack\s*/i, '')
    .replace(/^Extra Booster\s*/i, '')
    .replace(/^Starter Deck\s*/i, '')
    .replace(/["“”]/g, '')
    .trim();
  const setSlug = slugifyPriceChartingPart(cleanSet);
  if (!setSlug) return '';

  const namePart = String(item.name || '')
    .replace(/\[[^\]]+\].*$/g, '')
    .replace(/\([^)]*\).*$/g, '')
    .replace(/\b(?:L|C|UC|R|SR|SEC|SP CARD|SP|P)\b.*$/i, '')
    .replace(/\b([A-Za-z]+)\s+([A-Z])\s+([A-Za-z]+)\b/g, '$1$2$3')
    .trim();
  const cardSlug = slugifyPriceChartingPart(`${namePart} ${item.code}`);
  if (!cardSlug) return '';

  return `https://www.pricecharting.com/game/one-piece-japanese-${setSlug}/${cardSlug}`;
}

function buildLinks() {
  return (Array.isArray(marketCards) ? marketCards : [])
    .filter((item) => item?.locale === 'JP' && item?.apparelId && item?.code)
    .map((item) => {
      const priceChartingUrl = derivePriceChartingUrl(item);
      return {
        apparelId: Number(item.apparelId),
        code: item.code || '',
        locale: item.locale || 'JP',
        priceChartingUrl,
        status: priceChartingUrl ? 'approved' : 'pending',
        note: priceChartingUrl ? 'derived base-clean URL' : 'variant or special product needs manual PriceCharting URL review'
      };
    })
    .sort((a, b) => {
      const codeCompare = String(a.code).localeCompare(String(b.code), 'en');
      if (codeCompare) return codeCompare;
      return Number(a.apparelId) - Number(b.apparelId);
    });
}

const links = buildLinks();
const approved = links.filter((item) => item.status === 'approved').length;
const pending = links.filter((item) => item.status === 'pending').length;
const contents = `const priceChartingMarketLinks = ${JSON.stringify(links, null, 2)};\n\nexport default priceChartingMarketLinks;\n`;

fs.writeFileSync(OUTPUT_PATH, contents);
console.log(JSON.stringify({ output: OUTPUT_PATH, total: links.length, approved, pending }, null, 2));
