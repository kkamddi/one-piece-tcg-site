import { readFile, writeFile } from 'node:fs/promises';
import { parseRiftboundCardNumber } from '../src/riftbound-catalog.js';

const raw = JSON.parse(await readFile(new URL('../artifacts/riftbound-china-raw.json', import.meta.url), 'utf8'));
const english = JSON.parse(await readFile(new URL('../src/data/riftbound-preview.json', import.meta.url), 'utf8'));
const rarityIds = { rune_dust: 'common', rune_glimmer: 'uncommon', rune_shard: 'rare', rune_core: 'epic', rune_legend: 'showcase' };
const variants = { base_inscript: 'base', legacy_etching: 'alternate', exalted_script: 'overnumber', runemaster_mark: 'signature' };
const englishByCode = new Map(english.cards.map((card) => [card.code, card]));
const heroTags = new Map();
for (const card of raw.cards) {
  const counterpart = englishByCode.get(card.cardNo.replace('·', '-'));
  if (card.hero && counterpart?.tags.length) {
    heroTags.set(card.hero, [...new Set([...(heroTags.get(card.hero) || []), ...counterpart.tags])]);
  }
}
const setNames = { OGN: '起源', OGS: '起源 试炼之地', SFD: '铸魂淬炼', UNL: '破限系列', VEN: '化神争锋', ARC: '双城之战主题礼盒', SGN: 'SGN', T1S: 'T1S', FND: 'FND' };
const cards = raw.cards.map((card) => {
  const code = card.cardNo.replace('·', '-');
  const parsed = parseRiftboundCardNumber(code);
  if (!parsed || !Object.hasOwn(setNames, parsed.set)) throw new Error(`Unknown set or card number: ${card.id}`);
  const counterpart = englishByCode.get(code);
  if (!rarityIds[card.rarity] || !variants[card.extendRarity]) throw new Error(`Unknown classification: ${card.id}`);
  if (new URL(card.frontImage).hostname !== 'cdn.playloltcg.com') throw new Error('Unexpected image host');
  return {
    id: `riftbound:CN:${card.id}`, sourceId: String(card.id), locale: 'CN', code,
    number: parsed.number, name: [card.cardName, card.subTitle].filter(Boolean).join(', '),
    set: parsed.set, rarity: rarityIds[card.rarity], rarityLabel: card.rarityName,
    types: card.cardCategoryNameList, domains: card.cardColorList,
    tags: [...new Set([card.hero, card.region, card.tag, ...(heroTags.get(card.hero) || []), ...(counterpart?.tags || []), counterpart?.name].filter(Boolean))],
    image: card.frontImage, description: card.cardEffect, errata: card.errata || '',
    orientation: card.cardCategoryList.includes('battlefield') ? 'landscape' : 'portrait',
    artists: card.artist ? [card.artist] : [], energy: card.energy, might: card.power,
    variant: variants[card.extendRarity], preview: card.isPreview === true
  };
}).sort((a, b) => a.set.localeCompare(b.set) || a.code.localeCompare(b.code, 'en', { numeric: true }) || a.id.localeCompare(b.id));
if (!cards.length || new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error('Empty or duplicate Chinese records');
const snapshot = {
  source: 'https://www.playloltcg.com/card.html', capturedAt: raw.capturedAt, locale: 'CN',
  scope: 'All official Chinese gallery print records, including source-marked previews. Set codes without verified product names are retained as codes.',
  sourceCount: raw.cards.length,
  sets: Object.entries(setNames).filter(([id]) => cards.some((card) => card.set === id)).map(([id, name]) => ({ id, name })), cards
};
const output = new URL('../src/data/riftbound-preview-cn.json', import.meta.url);
const previous = JSON.parse(await readFile(output, 'utf8'));
const ids = new Set(cards.map((card) => card.id));
if (previous.cards.some((card) => !ids.has(card.id))) throw new Error('Existing card IDs would be removed; manual review required');
await writeFile(output, `${JSON.stringify(snapshot)}\n`);
console.log(JSON.stringify({ cards: cards.length, previews: cards.filter((card) => card.preview).length }));
