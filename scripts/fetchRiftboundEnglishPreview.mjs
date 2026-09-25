import { readFile, writeFile } from 'node:fs/promises';

const html = await readFile(new URL('../artifacts/riftbound-gallery.html', import.meta.url), 'utf8');
const marker = html.indexOf('__NEXT_DATA__');
const page = JSON.parse(html.slice(html.indexOf('>', marker) + 1, html.indexOf('</script>', marker))).props.pageProps.page;
const gallery = page.blades.find((blade) => blade.cards && blade.sets);
const origin = new URL(page.pcsUrl).origin;
if (origin !== 'https://content.publishing.riotgames.com') throw new Error('Unexpected official content host');
const cards = [];
const pages = [];
let next = gallery.cards.async.linkdata.first;
let total;
while (next && pages.length < 10) {
  const url = new URL(next, origin);
  if (url.origin !== origin || !url.pathname.includes('/public/channel/riftbound_website/list/')) throw new Error('Unexpected pagination URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Gallery HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.data) || !Number.isInteger(data.metadata?.totalItems)) throw new Error('Invalid gallery page');
  if (total !== undefined && total !== data.metadata.totalItems) throw new Error('Gallery changed during pagination; retry');
  total = data.metadata.totalItems;
  pages.push({ from: data.metadata.from, count: data.data.length });
  cards.push(...data.data);
  next = data.linkdata?.next;
}
if (next || new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error(`Incomplete or duplicate gallery pagination: ${JSON.stringify({ total, pages, received: cards.length, next })}`);
const previous = new Set(gallery.cards.items.map((card) => card.id));
const added = cards.filter((card) => !previous.has(card.id));
await writeFile(new URL('../artifacts/riftbound-gallery-api.json', import.meta.url), JSON.stringify({ capturedAt: new Date().toISOString(), source: origin, total, pages, sets: gallery.sets.items, cards }));
console.log(JSON.stringify({ total, received: cards.length, pages, added: added.map((card) => ({ id: card.id, code: card.publicCode, name: card.name, set: card.set, image: card.cardImage?.url })) }, null, 2));
