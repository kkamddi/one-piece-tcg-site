// Printed identities verified from official announcement renders on 2026-09-15.
const assets = 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/';
const t1Source = 'https://playriftbound.com/en-us/news/announcements/the-riftbound-x-t1-2025-worlds-champion-collection/';
const gardenSource = 'https://playriftbound.com/en-us/news/announcements/products-and-sets-into-2027/';
export const englishSupplementSets = [
  { id: 'SGN', name: 'Secret Garden', collectorNumberMax: 3 },
  { id: 'T1S', name: 'T1 Worlds Champion Signature Edition', collectorNumberMax: 5 },
  { id: 'T1A', name: 'T1 Worlds Champion Player Bundle', collectorNumberMax: 5 }
];

function printing(set, number, name, image, rect, options) {
  const total = set === 'SGN' ? 3 : 5;
  const code = `${set}-${String(number).padStart(3, '0')}/${String(total).padStart(3, '0')}`;
  return {
    id: `riftbound:EN:${set.toLowerCase()}-${String(number).padStart(3, '0')}-${String(total).padStart(3, '0')}`,
    sourceId: code, locale: 'EN', code, number, name, set,
    rarity: 'promo', rarityLabel: '프로모', orientation: 'portrait',
    image: `${assets}${image}?rect=${rect}&w=744&fit=clip`,
    variant: 'special', printedMark: set === 'SGN' ? 'P · EN' : 'EN',
    source: set === 'SGN' ? gardenSource : t1Source,
    ...options
  };
}

const gardenImage = 'cc21f40cf7969ff4a82f8e37fc34f0fac8830489-1039x584.jpg';
export const englishSupplementCards = [
  printing('SGN', 1, 'Bashful Bloom', gardenImage, '355,62,329,461', {
    types: ['Legend'], domains: ['Calm', 'Mind'], tags: ['Lillia', '릴리아', 'Secret Garden'],
    artists: ['Fireball Studio'], energy: null, might: null, preview: false,
    description: 'Lillia, Bashful Bloom. Secret Garden alternate artwork.', variantLabel: '얼터너트 아트'
  }),
  printing('SGN', 2, 'Green Father', gardenImage, '15,62,329,461', {
    types: ['Legend'], domains: ['Calm', 'Order'], tags: ['Ivern', '아이번', 'Secret Garden'],
    artists: ['Fireball Studio'], energy: null, might: null, preview: false,
    description: 'Ivern, Green Father. Secret Garden alternate artwork.', variantLabel: '얼터너트 아트'
  }),
  printing('SGN', 3, 'Ultrasoft Poro', gardenImage, '695,62,329,461', {
    types: ['Unit'], domains: ['Order'], tags: ['Freljord', 'Poro', '포로', 'Secret Garden'],
    artists: ['Fireball Studio'], energy: 5, might: 5, preview: false,
    description: 'Ultrasoft Poro. Secret Garden alternate artwork.', variantLabel: '얼터너트 아트'
  })
];

const champions = [
  ['Ambessa, The Wolf', 'Ambessa', '암베사', 'Doran', 'Fury', 4, 4, '17,20,419,584', ['Noxus']],
  ['Xin Zhao, Vigilant', 'Xin Zhao', '신 짜오', 'Oner', 'Order', 3, 4, '453,20,420,584', ['Demacia']],
  ['Galio, Indefatigable', 'Galio', '갈리오', 'Faker', 'Order', 3, 6, '889,20,419,584', ['Demacia']],
  ['Miss Fortune, Buccaneer', 'Miss Fortune', '미스 포츈', 'Gumayusi', 'Chaos', 4, 4, '244,622,418,584', ['Bilgewater', 'Pirate']],
  ['Seraphine, Not Alone', 'Seraphine', '세라핀', 'Keria', 'Order', 5, 1, '670,622,418,584', ['Piltover']]
];
for (const [set, file, artist, variantLabel] of [
  ['T1S', '3eb6c2b57002f85ce99e3125c56e7ef997086ebe-1327x1220.jpg', 'Pandart Studio', 'T1 Signature Edition'],
  ['T1A', '8ed88a16e1b47185c773672e7e6c647167e1ecf4-1327x1220.jpg', 'League Splash Team', 'T1 Player Bundle']
]) {
  for (const [index, [name, champion, alias, player, domain, energy, might, rect, tags]] of champions.entries()) {
    englishSupplementCards.push(printing(set, index + 1, name, file, rect, {
      types: ['Champion Unit'], domains: [domain], tags: [champion, alias, player, 'T1', ...tags],
      artists: [artist], energy, might, preview: true, variantLabel,
      description: `${name}. ${player}'s card in the T1 2025 Worlds Champion Collection. Official preview render.`
    }));
  }
}
