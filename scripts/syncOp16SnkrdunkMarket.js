import fs from 'node:fs';
import path from 'node:path';
import marketCards from '../src/data/market-cards.js';
import cardMarketLinks from '../src/data/card-market-links.js';

const CARDS_PATH = path.resolve('src/data/cards.json');
const MARKET_PATH = path.resolve('src/data/market-cards.js');
const LINKS_PATH = path.resolve('src/data/card-market-links.js');
const CACHE_PATH = path.resolve('tmp/op16-snkrdunk-search-cache.json');
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const refreshCache = args.has('--refresh');
const delayMs = Number(process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || 2400);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cardNoOf(card) {
  return String(card.cardNo || card.card_no || card.card_no_base || card.cardNoBase || '');
}

function seriesOf(card) {
  return String(card.seriesId || card.series_id || card.series || '');
}

function suffixOfCardId(cardId) {
  return String(cardId || '').match(/(_[a-z]\d+)$/)?.[1] || '';
}

function parseSetName(name) {
  const match = String(name || '').match(/\(([^()]+)\)\s*$/);
  return match ? match[1].trim() : 'Booster Pack "THE TIME OF BATTLE"';
}

function parseCode(name) {
  return String(name || '').match(/\[(OP16-\d{3})\]/)?.[1] || '';
}

function rarityToken(rarity) {
  return String(rarity || '').toUpperCase().replace(/\s+/g, ' ');
}

function marketRarityPattern(rarity, isParallel) {
  const token = rarityToken(rarity);
  if (!token) return null;
  return new RegExp(`\\b${token}${isParallel ? '-P' : ''}\\b`, 'i');
}

function isRiskyMarketName(name) {
  return /Comic|Wanted|SPC|SEC-SP|SR-SP|THE BEST|Premium Booster|Promo|Championship|Winner|Prize|Gold Background|Silver Background|Anniversary|World Final|Flagship|Grand Asia|\[EN\]/i.test(name);
}

function findApprovedMarketForCard(card, candidates) {
  const id = String(card.id || '');
  const suffix = suffixOfCardId(id);
  if (suffix && suffix !== '_p1') return null;
  const isParallel = suffix === '_p1';
  const pattern = marketRarityPattern(card.rarity, isParallel);
  if (!pattern) return null;
  const filtered = candidates.filter((item) => {
    const name = normalizeText(item.name);
    if (isRiskyMarketName(name)) return false;
    if (!pattern.test(name)) return false;
    if (isParallel) return /-P\b/i.test(name);
    return !/-P\b|Parallel|Comic|Wanted|SPC|SEC-SP|SR-SP/i.test(name);
  });
  return filtered.length === 1 ? filtered[0] : null;
}

async function searchSnkrdunk(code) {
  const url = new URL('https://snkrdunk.com/en/v1/search');
  url.searchParams.set('keyword', code);
  url.searchParams.set('perPage', '50');
  url.searchParams.set('page', '1');
  url.searchParams.set('type', '');
  let response;
  let text = '';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 OPTCGKorea/1.0'
      }
    });
    text = (await response.text()).replace(/^\uFEFF/, '');
    if (response.ok) break;
    if (response.status !== 429 || attempt === 5) {
      throw new Error(`${code} search failed: ${response.status}`);
    }
    await wait(delayMs * attempt * 2);
  }
  const data = JSON.parse(text);
  return (data.streetwears || [])
    .filter((item) => item?.isTradingCard)
    .filter((item) => parseCode(item.name) === code)
    .filter((item) => /THE TIME OF BATTLE/i.test(item.name))
    .filter((item) => !/\[EN\]/i.test(item.name))
    .map((item) => ({
      code,
      locale: 'JP',
      apparelId: Number(item.id),
      name: normalizeText(item.name),
      setName: parseSetName(item.name),
      minPrice: Number(item.minPrice || 0),
      minPriceFormat: item.minPriceFormat || 'US $ -',
      listingCount: Number(item.listingCount || 0),
      sourceUrl: `https://snkrdunk.com/en/trading-cards/${item.id}?slide=right`,
      previewImageUrl: item.thumbnailUrl || ''
    }));
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function serializeModule(name, value) {
  return `const ${name} = ${JSON.stringify(value, null, 2)};\n\nexport default ${name};\n`;
}

function serializeCompactMarketCards(value) {
  const json = JSON.stringify(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `const e=JSON.parse(\`${json}\`);export{e as default};\n`;
}

async function main() {
  const cards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
  const op16Cards = cards.filter((card) => (
    seriesOf(card) === 'JP-OP16'
    || cardNoOf(card).startsWith('OP16-')
  ));
  const codes = [...new Set(op16Cards.map(cardNoOf).filter(Boolean))].sort();
  const marketByCode = new Map();
  const errors = [];
  const cache = readCache();

  for (const code of codes) {
    try {
      const cached = !refreshCache && Array.isArray(cache[code]);
      const items = cached ? cache[code] : await searchSnkrdunk(code);
      cache[code] = items;
      writeCache(cache);
      marketByCode.set(code, items);
      console.log(`${code} ${items.length}${cached ? ' cached' : ''}`);
      if (!cached) await wait(delayMs);
    } catch (error) {
      errors.push({ code, error: String(error.message || error) });
      console.log(`${code} error ${String(error.message || error)}`);
      await wait(delayMs);
    }
  }

  const op16MarketItems = [...marketByCode.values()].flat()
    .sort((a, b) => a.code.localeCompare(b.code, 'en') || a.apparelId - b.apparelId);
  const existingMarketIds = new Set(marketCards.map((item) => Number(item.apparelId)));
  const nextMarketCards = [
    ...marketCards.filter((item) => !/^OP16-\d{3}$/.test(String(item.code || ''))),
    ...op16MarketItems
  ].sort((a, b) => {
    const codeCompare = String(a.code || '').localeCompare(String(b.code || ''), 'en');
    if (codeCompare) return codeCompare;
    return Number(a.apparelId || 0) - Number(b.apparelId || 0);
  });

  const existingNonOp16Links = cardMarketLinks.filter((link) => (
    !String(link.cardId || '').includes('JP::OP16-')
    && !String(link.cardNo || '').startsWith('OP16-')
  ));
  const generatedLinks = op16Cards
    .map((card) => {
      const candidates = marketByCode.get(cardNoOf(card)) || [];
      const approved = findApprovedMarketForCard(card, candidates);
      return {
        cardId: card.id,
        cardNo: cardNoOf(card),
        locale: 'JP',
        variantKey: '',
        apparelId: approved ? approved.apparelId : null,
        status: approved ? 'approved' : 'pending',
        note: approved
          ? `OP16 auto approved: ${approved.name}`
          : `OP16 pending: ${candidates.length} SNKRDUNK candidate(s)`
      };
    });
  const nextLinks = [...existingNonOp16Links, ...generatedLinks];

  const approved = generatedLinks.filter((item) => item.status === 'approved').length;
  const pending = generatedLinks.filter((item) => item.status === 'pending').length;
  const result = {
    write: shouldWrite,
    op16Cards: op16Cards.length,
    codes: codes.length,
    op16MarketItems: op16MarketItems.length,
    newlyFoundMarketItems: op16MarketItems.filter((item) => !existingMarketIds.has(item.apparelId)).length,
    approved,
    pending,
    noCandidateCodes: codes.filter((code) => !(marketByCode.get(code) || []).length).length,
    errors,
    approvedExamples: generatedLinks.filter((item) => item.status === 'approved').slice(0, 10),
    pendingExamples: generatedLinks.filter((item) => item.status === 'pending').slice(0, 10)
  };

  if (shouldWrite) {
    fs.writeFileSync(MARKET_PATH, serializeCompactMarketCards(nextMarketCards));
    fs.writeFileSync(LINKS_PATH, serializeModule('cardMarketLinks', nextLinks));
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
