import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterRiftboundCards, getRiftboundCategories, sanitizeCollection, collectionSummary, RIFTBOUND_EDITIONS, normalizeRiftboundLocale, parseRiftboundCardNumber } from '../src/riftbound-catalog.js';
import { RIFTBOUND_SET_PRODUCTS, getRiftboundSetName } from '../src/data/riftbound-set-products.js';

const { cards, sets } = JSON.parse(await readFile(new URL('../src/data/riftbound-preview.json', import.meta.url), 'utf8'));
const ids = new Set(cards.map((card) => card.id));
const chinese = JSON.parse(await readFile(new URL('../src/data/riftbound-preview-cn.json', import.meta.url), 'utf8'));
const korean = JSON.parse(await readFile(new URL('../src/data/riftbound-preview-kr.json', import.meta.url), 'utf8'));

test('product-family navigation retains empty groups and maps each known set once', () => {
  for (const snapshot of [{ sets }, chinese, korean]) {
    const groups = getRiftboundCategories(snapshot.sets);
    assert.deepEqual(groups.slice(0, 4).map((group) => group.id), ['booster', 'starter', 'special', 'promo']);
    assert.deepEqual(groups.flatMap((group) => group.sets.map((set) => set.id)).sort(), snapshot.sets.map((set) => set.id).sort());
  }
  const englishGroups = getRiftboundCategories(sets);
  assert.deepEqual(englishGroups[0].sets.map((set) => set.id), ['VEN', 'UNL', 'SFD', 'OGN']);
  assert.deepEqual(englishGroups[1].sets.map((set) => set.id), ['OGS']);
  assert.deepEqual(englishGroups[2].sets.map((set) => set.id), ['SGN', 'T1S', 'T1A']);
  assert.equal(englishGroups[3].sets.length, 0);
  assert.equal(getRiftboundCategories(korean.sets)[3].sets[0].id, 'PR');
  assert.equal(filterRiftboundCards(korean.cards, {}).length, 4);
  assert.equal(getRiftboundCategories(korean.sets)[0].sets[0].id, 'OGN');
  assert.ok(filterRiftboundCards(chinese.cards, { query: 'SGN' }).length > 0);
});

test('set art is sourced per edition with no cross-language fallback', () => {
  for (const locale of ['EN', 'CN']) {
    for (const product of Object.values(RIFTBOUND_SET_PRODUCTS[locale])) {
      assert.ok(product.source.startsWith('https://'));
      assert.ok((locale === 'CN' ? ['cdn.playloltcg.com'] : ['cmsassets.rgpub.io', 'cdn.sanity.io']).includes(new URL(product.image).hostname));
    }
  }
  assert.equal(Object.keys(RIFTBOUND_SET_PRODUCTS.EN).length, 8);
  assert.equal(Object.keys(RIFTBOUND_SET_PRODUCTS.CN).length, 5);
  assert.equal(RIFTBOUND_SET_PRODUCTS.CN.VEN, undefined);
  assert.equal(RIFTBOUND_SET_PRODUCTS.KR, undefined);
  assert.equal(getRiftboundSetName({ id: 'OGS', name: 'Proving Grounds' }, 'EN'), 'Origins - Proving Grounds');
});

test('snapshot uses unique game/locale IDs and official image URLs', () => {
  assert.equal(ids.size, cards.length);
  assert.ok(cards.length > 300);
  assert.ok(cards.every((card) => card.id.startsWith('riftbound:EN:') && new URL(card.image).hostname === 'cmsassets.rgpub.io'));
  assert.deepEqual(sets.map((set) => set.id), ['OGN', 'OGS', 'SFD', 'UNL', 'VEN', 'SGN', 'T1S', 'T1A']);
  assert.equal(cards.length, 1202);
});

test('official supplement printings have separate IDs, sources and cropped English artwork', () => {
  const supplement = cards.filter((card) => ['SGN', 'T1S', 'T1A'].includes(card.set));
  assert.equal(supplement.length, 13);
  for (const card of supplement) {
    assert.ok(card.source.startsWith('https://playriftbound.com/en-us/'));
    assert.ok(new URL(card.image).searchParams.has('rect'));
    assert.ok(card.printedMark.endsWith('EN'));
    assert.equal(card.preview, card.set !== 'SGN');
  }
  assert.equal(filterRiftboundCards(cards, { set: 'T1S', query: 'Faker' })[0].code, 'T1S-003/005');
  assert.equal(filterRiftboundCards(cards, { set: 'T1A', query: 'Faker' })[0].code, 'T1A-003/005');
});

test('Korean champion aliases and normalized collector numbers', () => {
  const ahri = filterRiftboundCards(cards, { query: '아리' });
  assert.ok(ahri.length > 1);
  assert.ok(ahri.every((card) => card.name.includes('Ahri') || card.tags.includes('Ahri')));
  assert.ok(filterRiftboundCards(cards, { query: 'ogn001' }).some((card) => card.code.startsWith('OGN-001/')));
  assert.equal(filterRiftboundCards(cards, { query: 'not-a-real-card-12345' }).length, 0);
});

test('alternate artwork and overnumbered printings remain independent', () => {
  const alternate = cards.find((card) => card.code === 'OGN-066a/298');
  const base = cards.find((card) => card.code === 'OGN-066/298');
  assert.ok(alternate && base);
  assert.notEqual(alternate.id, base.id);
  assert.equal(alternate.variant, 'alternate');
  assert.equal(base.variant, 'base');
  const overnumbered = filterRiftboundCards(cards, { variant: 'overnumber' });
  assert.ok(overnumbered.length > 0);
  assert.ok(overnumbered.every((card) => card.number > sets.find((set) => set.id === card.set).collectorNumberMax));
  const signatures = filterRiftboundCards(cards, { variant: 'signature' });
  assert.ok(signatures.length > 0);
  assert.ok(signatures.every((card) => card.code.includes('*')));
});

test('local state ignores One Piece IDs and malformed quantities', () => {
  const result = sanitizeCollection({
    'JP::OP01-001': { quantity: 10 },
    [cards[0].id]: { quantity: -2, wished: 'true' },
    [cards[1].id]: { quantity: 10000, wished: true },
    [cards[2].id]: { quantity: 1.9 },
    [cards[3].id]: { quantity: 'bad' }
  }, ids);
  assert.equal(result['JP::OP01-001'], undefined);
  assert.deepEqual(result[cards[0].id], { quantity: 0, wished: false });
  assert.equal(result[cards[1].id].quantity, 999);
  assert.equal(result[cards[2].id].quantity, 1);
  assert.equal(result[cards[3].id].quantity, 0);
  assert.deepEqual(sanitizeCollection(null, ids), {});
});

test('set/view/rarity filters compose and summary counts variants, not copies', () => {
  const card = cards[0];
  const collection = { [card.id]: { quantity: 3, wished: true } };
  assert.deepEqual(filterRiftboundCards(cards, { set: card.set, rarity: card.rarity, view: 'owned' }, collection), [card]);
  assert.deepEqual(filterRiftboundCards(cards, { view: 'wishlist' }, collection), [card]);
  assert.deepEqual(collectionSummary(cards, collection), { owned: 1, quantity: 3, wished: 1 });
});

test('only KR/EN/CN editions are supported; unsupported locales normalize to EN', () => {
  assert.deepEqual(RIFTBOUND_EDITIONS.map((edition) => edition.id), ['KR', 'EN', 'CN']);
  for (const locale of ['JP', 'FR', null, 'invalid']) assert.equal(normalizeRiftboundLocale(locale), 'EN');
  for (const locale of ['KR', 'EN', 'CN']) assert.equal(normalizeRiftboundLocale(locale), locale);
});

test('Chinese records use official Chinese images and remain edition-isolated', () => {
  assert.equal(chinese.cards.length, 1266);
  assert.equal(new Set(chinese.cards.map((card) => card.id)).size, chinese.cards.length);
  assert.ok(chinese.cards.every((card) => card.id.startsWith('riftbound:CN:') && new URL(card.image).hostname === 'cdn.playloltcg.com'));
  assert.ok(chinese.cards.every((card) => /[\u4e00-\u9fff]/.test(card.name)));
  const all = [...cards, ...chinese.cards];
  assert.deepEqual(filterRiftboundCards(all, { locale: 'EN' }), cards);
  assert.deepEqual(filterRiftboundCards(all, { locale: 'CN' }), chinese.cards);
  assert.deepEqual(filterRiftboundCards(all, { locale: 'KR' }), []);
  assert.ok(filterRiftboundCards(chinese.cards, { locale: 'CN', query: '아리' }).length > 0);
  assert.ok(filterRiftboundCards(chinese.cards, { query: 'OGN·001' }).length > 0);
  assert.equal(chinese.cards.filter((card) => card.preview).length, 14);
});

test('expanded sets include runes, tokens and special numbered cards without losing old sets', () => {
  assert.equal(cards.filter((card) => ['OGN', 'OGS'].includes(card.set)).length, 376);
  assert.equal(chinese.cards.filter((card) => ['OGN', 'OGS'].includes(card.set)).length, 388);
  for (const set of ['SFD', 'UNL', 'VEN']) {
    assert.ok(filterRiftboundCards(cards, { set }).length > 200);
    assert.ok(filterRiftboundCards(chinese.cards, { set }).length > 200);
  }
  assert.ok(chinese.cards.some((card) => /-R\d+a$/.test(card.code) && card.variant === 'alternate'));
  assert.ok(cards.some((card) => /-T\d+$/.test(card.code)));
  assert.ok(cards.some((card) => /-SP\d+\//.test(card.code) && card.variant === 'special'));
  assert.ok(chinese.cards.some((card) => card.code.startsWith('SGN-') && card.code.endsWith('·P·SC')));
  assert.ok([...cards, ...chinese.cards].every((card) => Number.isFinite(card.number) && parseRiftboundCardNumber(card.code)?.set === card.set));
});

test('collector parser distinguishes rune/token prefixes, artwork suffixes and signatures', () => {
  assert.deepEqual(parseRiftboundCardNumber('UNL-R01a'), { set: 'UNL', prefix: 'R', number: 1, alternate: true, signature: false, total: null });
  assert.equal(parseRiftboundCardNumber('VEN-SP3/006').prefix, 'SP');
  assert.equal(parseRiftboundCardNumber('SFD·T03').prefix, 'T');
  assert.equal(parseRiftboundCardNumber('OGN-303*/298').signature, true);
  assert.equal(parseRiftboundCardNumber('SGN·003/003·P·SC').set, 'SGN');
  assert.equal(parseRiftboundCardNumber('invalid'), null);
});

test('ownership and wishes survive edition changes without crossing edition boundaries', () => {
  const en = cards[0];
  const cn = chinese.cards.find((card) => card.code === en.code);
  assert.ok(cn);
  const all = [...cards, ...chinese.cards];
  const allowedIds = new Set(all.map((card) => card.id));
  const saved = sanitizeCollection({ [en.id]: { quantity: 2, wished: true }, [cn.id]: { quantity: 1, wished: false } }, allowedIds);
  assert.deepEqual(filterRiftboundCards(all, { locale: 'EN', view: 'owned' }, saved), [en]);
  assert.deepEqual(filterRiftboundCards(all, { locale: 'CN', view: 'owned' }, saved), [cn]);
  assert.deepEqual(filterRiftboundCards(all, { locale: 'CN', view: 'wishlist' }, saved), []);
  assert.deepEqual(sanitizeCollection(JSON.parse(JSON.stringify(saved)), allowedIds), saved);
});

test('Korean launch promos preserve verified printing identities and official artwork', () => {
  assert.equal(korean.cards.length, 4);
  const launchPromos = korean.cards.filter((card) => !card.preview);
  assert.deepEqual(launchPromos.map((card) => card.code), ['OGN-030/298', 'OGN-076b/298']);
  assert.ok(launchPromos.every((card) => card.variant === 'promo' && card.printedMark === 'P · KR'));
  assert.ok(korean.cards.every((card) => card.id.startsWith('riftbound:KR:') && new URL(card.image).hostname === 'cmsassets.rgpub.io'));
  assert.equal(filterRiftboundCards(korean.cards, { set: 'OGN' })[0].code, 'OGN-303a/298');
  assert.equal(filterRiftboundCards(korean.cards, { set: 'PR', query: '티모' })[0].code, 'OGN-197b/298');
  assert.equal(filterRiftboundCards(korean.cards, { locale: 'KR', query: '징크스', set: 'PR' })[0].name, '징크스, 폭파광');
  assert.equal(filterRiftboundCards(korean.cards, { locale: 'KR', query: '야스오' })[0].code, 'OGN-076b/298');
  const all = [...cards, ...chinese.cards, ...korean.cards];
  assert.equal(new Set(all.map((card) => card.id)).size, all.length);
  const promo = korean.cards[0];
  const englishBase = cards.find((card) => card.code === promo.code);
  assert.ok(englishBase);
  const saved = sanitizeCollection({ [promo.id]: { quantity: 2, wished: true }, [englishBase.id]: { quantity: 1, wished: false } }, new Set(all.map((card) => card.id)));
  assert.deepEqual(filterRiftboundCards(all, { locale: 'KR', view: 'owned' }, saved), [promo]);
  assert.deepEqual(filterRiftboundCards(all, { locale: 'EN', view: 'wishlist' }, saved), []);
  assert.deepEqual(collectionSummary(korean.cards, saved), { owned: 1, quantity: 2, wished: 1 });
});
