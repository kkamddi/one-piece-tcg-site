import { extractCardCodes, normalizeScanCode } from './card-scan.js';

export function buildRecognitionCandidates({ matches = [], codes = [], locale = 'auto', market, links, cards }) {
  const byId = new Map(cards.map(card => [card.id, card]));
  const evidence = new Map(matches.filter(item => item.verified && item.score > 0).map(item => [item.key, item]));
  const numbers = new Set(codes.map(normalizeScanCode));
  const seen = new Set();
  return market.flatMap(item => {
    const key = `${item.locale}-${item.apparelId}`;
    if (seen.has(key) || !['JP', 'EN'].includes(item.locale) || (locale !== 'auto' && item.locale !== locale)) return [];
    const match = evidence.get(key);
    if (!match && !numbers.has(normalizeScanCode(item.code))) return [];
    seen.add(key);
    const catalogCards = [...new Set(links.filter(link => link.status === 'approved' && link.apparelId === item.apparelId && link.locale === item.locale && normalizeScanCode(link.cardNo) === normalizeScanCode(item.code)).map(link => link.cardId))]
      .map(id => byId.get(id)).filter(card => card && card.locale === item.locale && normalizeScanCode(card.baseCardNo || card.cardNo) === normalizeScanCode(item.code));
    const card = catalogCards.length === 1 ? catalogCards[0] : null;
    const thumbnail = card ? card.thumbnailUrl || `https://cards.optcgkorea.com/cards/${card.locale}/${encodeURIComponent(card.id.split('::')[1])}.webp` : null;
    return [{ key, code: item.code, locale: item.locale, name: item.name, setName: item.setName, images: [...new Set([thumbnail, card?.imageUrl, item.previewImageUrl].filter(Boolean))], apparelId: item.apparelId, catalogCards,
      artwork: Boolean(match), codeMatch: numbers.has(normalizeScanCode(item.code)), score: match?.score || 0, inliers: match?.inliers || 0 }];
  }).sort((a, b) => Number(b.artwork) - Number(a.artwork) || b.score - a.score || Number(b.codeMatch) - Number(a.codeMatch) || a.key.localeCompare(b.key));
}

export function recognitionPriceUrl(candidate, confirmed) {
  if (!confirmed || candidate?.catalogCards?.length !== 1) return null;
  return `/prices?${new URLSearchParams({ code: candidate.code, apparelId: String(candidate.apparelId), cardId: candidate.catalogCards[0].id })}`;
}

export function normalizedCrop(start, end) {
  const clamp = value => Math.max(0, Math.min(1, value));
  const x = Math.min(clamp(start.x), clamp(end.x)), y = Math.min(clamp(start.y), clamp(end.y));
  return { x, y, width: Math.abs(clamp(end.x) - clamp(start.x)), height: Math.abs(clamp(end.y) - clamp(start.y)) };
}

export async function recognizeForLab(canvas, { signal, locale = 'auto', code = '', onStage = () => {}, imageOptions, ocrOptions, referenceData }) {
  const [{ createCardImageSession }, { recognizeCardCodes }, { default: market }, { default: links }, { default: cards }, { default: special }] = await Promise.all([
    import('./card-image-match.js'), import('./card-scan-ocr.js'), import('../data/market-cards.js'), import('../data/card-market-links.js'), import('../data/cards.json'), import('../data/special-promo-cards.js')
  ]);
  signal.throwIfAborted();
  const session = createCardImageSession(signal, { ...(referenceData ? { readIndex: referenceData.readIndex } : {}), ...imageOptions });
  const warnings = [];
  const ocrController = new AbortController();
  const abortOcr = () => ocrController.abort();
  signal.addEventListener('abort', abortOcr, { once: true });
  const ocrTimer = setTimeout(abortOcr, 25000);
  onStage('카드번호 · 이미지 분석 중');
  const prepared = session.prepare(canvas).catch(() => { warnings.push('이미지 비교 엔진을 실행하지 못했습니다.'); return null; });
  let codes = extractCardCodes(code);
  try {
    if (!codes.length) {
      try { codes = await recognizeCardCodes(canvas, { signal: ocrController.signal, getFallbackCanvas: () => prepared, workerOptions: ocrOptions }); }
      catch { if (signal.aborted) signal.throwIfAborted(); warnings.push('카드번호를 읽지 못해 이미지로 검색했습니다.'); }
    }
    clearTimeout(ocrTimer);
    signal.throwIfAborted();
    const ready = await prepared;
    signal.throwIfAborted();
    const matches = [];
    if (ready) {
      for (const edition of locale === 'auto' ? ['JP', 'EN'] : [locale]) {
        onStage(`${edition} 이미지 후보 비교 중`);
        let editionMatches = [];
        for (const number of codes.slice(0, 3)) {
          try { const result = await session.match(number, edition); editionMatches.push(...result.matches); if (result.partial) warnings.push(`${edition} 일부 비교 자료를 불러오지 못했습니다.`); }
          catch { signal.throwIfAborted(); }
        }
        // Cross-check OCR against full-image retrieval, even when its candidates matched.
        {
          try { const result = await session.match('', edition); editionMatches.push(...result.matches); if (result.partial) warnings.push(`${edition} 일부 비교 자료를 불러오지 못했습니다.`); }
          catch { signal.throwIfAborted(); warnings.push(`${edition} 이미지 비교 자료를 불러오지 못했습니다.`); }
        }
        matches.push(...editionMatches);
      }
    }
    signal.throwIfAborted();
    return { codes, candidates: buildRecognitionCandidates({ matches, codes, locale, market: referenceData?.market || market, links, cards: [...cards, ...special] }), warnings: [...new Set(warnings)] };
  } finally { clearTimeout(ocrTimer); signal.removeEventListener('abort', abortOcr); ocrController.abort(); session.dispose(); }
}
