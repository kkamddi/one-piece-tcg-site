import { filterCards, readCards } from '../../lib/cards-store.js';

function hasHangul(value = '') {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value));
}

function getCardKeySet(cards = []) {
  return new Set(
    cards
      .flatMap((card) => [card.baseCardNo, card.cardNo])
      .filter(Boolean)
  );
}

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.\u30fb\u00b7]/g, '')
    .trim();
}

function uniqueById(cards = []) {
  const seen = new Set();
  return cards.filter((card) => {
    if (!card?.id || seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function getJapaneseAliasQueries(value = '') {
  const query = String(value || '').normalize('NFKC').trim();
  const aliases = new Set();
  const hasJapaneseText = (text) => /[ぁ-んァ-ヶー一-龯]/.test(String(text || ''));
  if (hasJapaneseText(query) && /^[ぁ-んァ-ヶー一-龯・･·\s.．DＤ]+$/i.test(query) && query.replace(/[・･·\s.．]/g, '').length >= 2) {
    aliases.add(query);
  }
  const parts = query.split(/[・･·\s.．]+/).map((part) => part.trim()).filter(Boolean);
  const lastPart = parts.at(-1);
  const dNameMatch = query.match(/[DＤ][・･·\s.．]*([ァ-ヶー]+)$/i);

  if (lastPart && hasJapaneseText(lastPart) && lastPart.length >= 2 && lastPart !== query) aliases.add(lastPart);
  if (dNameMatch?.[1] && dNameMatch[1].length >= 2) aliases.add(dNameMatch[1]);

  return [...aliases];
}

function getJapaneseAliasesFromCards(cards = []) {
  const aliases = new Set();
  cards.forEach((card) => {
    getJapaneseAliasQueries(card?.name).forEach((alias) => aliases.add(alias));
  });
  return [...aliases];
}

export default async function handler(request, response) {
  const { q = '', locale = '' } = request.query ?? {};

  if (locale === 'JP' && hasHangul(q)) {
    const [cards, krCards, jpCards] = await Promise.all([
      readCards({ q, locale }),
      readCards({ q, locale: 'KR' }),
      readCards({ locale: 'JP' })
    ]);
    const results = filterCards(cards, { q, locale });
    const krMatches = filterCards(krCards, { q, locale: 'KR' });
    const normalizedHangulQuery = normalizeSearch(q);
    const krNameMatches = krMatches.filter((card) => normalizeSearch(card.name).includes(normalizedHangulQuery));
    const matchedCardNos = getCardKeySet(krNameMatches.length ? krNameMatches : krMatches);

    if (matchedCardNos.size) {
      const aliasMatches = jpCards.filter((card) => (
        matchedCardNos.has(card.baseCardNo) || matchedCardNos.has(card.cardNo)
      ));
      const japaneseAliases = getJapaneseAliasesFromCards(aliasMatches);
      const expandedAliasMatches = japaneseAliases.flatMap((alias) => filterCards(jpCards, { q: alias, locale }));
      response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      response.status(200).json(uniqueById([
        ...results,
        ...(expandedAliasMatches.length ? expandedAliasMatches : aliasMatches)
      ]));
      return;
    }

    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.status(200).json(results);
    return;
  }

  const aliasQueries = locale === 'JP' ? getJapaneseAliasQueries(q) : [];
  const [cards, ...aliasCardsList] = await Promise.all([
    readCards({ q, locale }),
    ...aliasQueries.map((aliasQuery) => readCards({ q: aliasQuery, locale }))
  ]);
  const results = uniqueById([
    ...filterCards(cards, { q, locale }),
    ...aliasCardsList.flatMap((aliasCards, index) => filterCards(aliasCards, { q: aliasQueries[index], locale }))
  ]);

  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  response.status(200).json(results);
}
