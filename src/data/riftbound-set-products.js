// Official product art, separated by language. Never substitute another edition's packaging.
const home = 'https://playriftbound.com/en-us/';
const merch = 'https://merch.riotgames.com/en-us/product/';
const china = 'https://www.playloltcg.com/';
export const RIFTBOUND_SET_PRODUCTS = {
  EN: {
    OGN: { image: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/7a74b12bab6461ad720ab47e98b908a38213580c-844x844.png', source: home },
    OGS: { image: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/da48b48ebce3dfbbd8d706c145c24eccc4fb9c31-844x844.png', source: home },
    SFD: { image: 'https://cdn.sanity.io/images/dsfx7636/consumer_products_live/22aabf7f3ab0081cf42f6b4ebc4af4c5c92437f9-2560x2560.png?w=320&auto=format', source: `${merch}riftbound-spiritforged-booster-display/` },
    UNL: { image: 'https://cdn.sanity.io/images/dsfx7636/consumer_products_live/46c776a96cc14227a260d24489f10b4090cd2cd9-2560x2560.png?w=320&auto=format', source: `${merch}riftbound-unleashed-booster-display/` },
    VEN: { image: 'https://cdn.sanity.io/images/dsfx7636/consumer_products_live/3102667c372acb3a074f2ca9c2fdbc1caeaef923-2560x2560.png?w=320&auto=format', source: `${merch}riftbound-vendetta-booster-display/` },
    SGN: { image: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/88d4655295fc06ecdd110241329cad33c2ff8610-1050x795.jpg?w=320', source: `${home}news/announcements/products-and-sets-into-2027/` },
    T1S: { image: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/202eb6f0f1bcc9f990ed8140ff7fe4b3509cefce-1920x1080.jpg?w=320', source: `${home}news/announcements/the-riftbound-x-t1-2025-worlds-champion-collection/` },
    T1A: { image: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/33482baa7c6085e79a921b3ca4cf48e34720f41c-1920x1790.jpg?rect=30,40,1060,860&w=320', source: `${home}news/announcements/the-riftbound-x-t1-2025-worlds-champion-collection/` }
  },
  CN: {
    OGN: { image: 'https://cdn.playloltcg.com/lol/2025/12/2025-12-09/1d1649de6b924654ab131a3dbcb912d1.png', source: china },
    OGS: { image: 'https://cdn.playloltcg.com/lol/2025/12/2025-12-09/12f1bf237b0c4ed9a843eb4018a0016d.png', source: china },
    SFD: { image: 'https://cdn.playloltcg.com/lol/2025/12/2025-12-09/8c6744c72d394abc9f9436c3e64279a4.png', source: china },
    UNL: { image: 'https://cdn.playloltcg.com/lol/2026/04/2026-04-01/a45608e7d9e344b7b110937a5b2c2fe3.png', source: china },
    ARC: { image: 'https://cdn.playloltcg.com/lol/2025/12/2025-12-09/0d20ea83e9ee4cae932e0e354de10b01.png', source: china }
    // VEN product images currently contain the site logo, not packaging.
  }
};

export function getRiftboundSetName(set, locale) {
  if (locale !== 'EN') return set.name;
  return { OGN: 'Origins - Main Set', OGS: 'Origins - Proving Grounds' }[set.id] || set.name;
}
