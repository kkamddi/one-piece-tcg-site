import { readFile, writeFile } from 'node:fs/promises';
import { parseRiftboundCardNumber } from '../src/riftbound-catalog.js';
import { englishSupplementCards, englishSupplementSets } from '../src/data/riftbound-official-supplements.js';

// Local evaluation snapshot only. Production requires Riot authorization/API assets.
const gallery = JSON.parse(await readFile(new URL('../artifacts/riftbound-gallery-api.json', import.meta.url), 'utf8'));
if (gallery.source !== 'https://content.publishing.riotgames.com' || !gallery.pages?.length
  || gallery.pages.reduce((total, page) => total + page.count, 0) !== gallery.cards.length) {
  throw new Error('Run fetchRiftboundEnglishPreview.mjs to obtain a validated paginated snapshot');
}
const sets = [...gallery.sets, ...englishSupplementSets];
const selectedSets = new Map(sets.map((set) => [set.id, set]));
const cards = gallery.cards.map((card) => {
  const parsed = parseRiftboundCardNumber(card.publicCode);
  if (!parsed || !selectedSets.has(card.set.value.id) || parsed.set !== card.set.value.id) throw new Error(`Unknown set or card number: ${card.id}`);
  if (new URL(card.cardImage.url).hostname !== 'cmsassets.rgpub.io') throw new Error(`Unexpected image host: ${card.id}`);
  return {
  id: `riftbound:EN:${card.id}`,
  sourceId: card.id,
  code: card.publicCode,
  number: card.collectorNumber,
  name: card.name,
  set: card.set.value.id,
  rarity: card.rarity.value.id,
  rarityLabel: card.rarity.value.label,
  types: [...(card.cardType.type || []), ...(card.cardType.superType || [])].map((type) => type.label),
  domains: (card.domain?.values || []).map((domain) => domain.label),
  tags: card.tags?.tags || [],
  image: card.cardImage.url,
  description: card.cardImage.accessibilityText || card.name,
  orientation: card.orientation,
  artists: (card.illustrator?.values || []).map((artist) => artist.label),
  energy: card.energy?.value?.label ?? null,
  might: card.might?.value?.label ?? null,
  variant: parsed.signature ? 'signature'
    : parsed.prefix === 'SP' ? 'special'
      : !parsed.prefix && card.collectorNumber > selectedSets.get(card.set.value.id).collectorNumberMax ? 'overnumber'
        : parsed.alternate ? 'alternate' : 'base'
  };
}).concat(englishSupplementCards).sort((a, b) => a.set.localeCompare(b.set) || a.code.localeCompare(b.code, 'en', { numeric: true }));
if (!cards.length || new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error('Empty or duplicate card data');
const snapshot = {
  source: 'https://playriftbound.com/en-us/card-gallery/',
  capturedAt: gallery.capturedAt,
  locale: 'EN',
  scope: 'All records delivered by the paginated official English gallery API; not a complete promotional or regional print checklist.',
  sourceCount: gallery.cards.length,
  reportedCount: gallery.total,
  sourcePages: gallery.pages,
  supplementalCount: englishSupplementCards.length,
  sets, cards
};
const output = new URL('../src/data/riftbound-preview.json', import.meta.url);
const previous = JSON.parse(await readFile(output, 'utf8'));
const ids = new Set(cards.map((card) => card.id));
if (previous.cards.some((card) => !ids.has(card.id))) throw new Error('Existing card IDs would be removed; manual review required');
await writeFile(output, `${JSON.stringify(snapshot)}\n`);
console.log(JSON.stringify({ cards: cards.length, bytes: Buffer.byteLength(JSON.stringify(snapshot)), sets: sets.map((set) => ({ ...set, cards: cards.filter((card) => card.set === set.id).length })) }, null, 2));
