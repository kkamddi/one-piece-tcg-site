import { writeFile } from 'node:fs/promises';

// Read-only requests used by the official public gallery. Local evaluation only.
const cards = [];
let total = 0;
for (let pageNum = 1; pageNum <= 30; pageNum += 1) {
  const response = await fetch('https://lol-api.playloltcg.com/xcx/card/searchCardCraftWeb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageNum, pageSize: 100, searchContent: '', cardCategoryList: [], cardColorList: [], rarityList: [], productCodeList: [] }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Official gallery HTTP ${response.status}`);
  const data = await response.json();
  if (data.code !== 0 || !Array.isArray(data.result?.list)) throw new Error('Unexpected gallery response');
  total = data.result.total;
  cards.push(...data.result.list);
  if (cards.length >= total) break;
  if (!data.result.list.length) throw new Error('Incomplete gallery pagination');
}
if (cards.length !== total || new Set(cards.map((card) => card.id)).size !== total) throw new Error('Incomplete or duplicate gallery records');
await writeFile(new URL('../artifacts/riftbound-china-raw.json', import.meta.url), JSON.stringify({ capturedAt: new Date().toISOString(), cards }));
console.log(JSON.stringify({ total, prefixes: [...new Set(cards.map((card) => card.cardNo.split(/[·-]/)[0]))], rarities: [...new Set(cards.map((card) => `${card.rarity}:${card.rarityName}`))], crafts: [...new Set(cards.map((card) => `${card.extendRarity}:${card.extendRarityName}`))], sample: cards.find((card) => card.cardNo.startsWith('OGN')) }, null, 2));
