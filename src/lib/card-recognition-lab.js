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

// Most photos are verified within the best 12 image candidates; the rest are only fetched when none is.
const FIRST_IMAGE_PASS = 12;
const loadRecognition = () => Promise.all([
  import('./card-image-match.js'), import('./card-scan-ocr.js'), import('../data/market-cards.js'), import('../data/card-market-links.js'), import('../data/cards.json'), import('../data/special-promo-cards.js')
]);

// Opening the scanner starts the engines and data downloads while the user frames the card.
let warmTicket = 0;
export function warmRecognition() {
  const ticket = ++warmTicket;
  return loadRecognition().then(([image, ocr]) => { if (ticket === warmTicket) { image.warmCardImageEngine(); ocr.warmCardCodeReader(); } }).catch(() => {});
}

export function releaseRecognition() {
  warmTicket += 1;
  return Promise.all([import('./card-image-match.js'), import('./card-scan-ocr.js')]).then(([image, ocr]) => { image.releaseCardImageEngine(); ocr.releaseCardCodeReader(); }).catch(() => {});
}

export async function recognizeForLab(canvas, { signal, locale = 'auto', code = '', onStage = () => {}, imageOptions, ocrOptions, referenceData }) {
  const [{ createCardImageSession }, { recognizeCardCodes, warmCardCodeReader }, { default: market }, { default: links }, { default: cards }, { default: special }] = await loadRecognition();
  signal.throwIfAborted();
  const session = createCardImageSession(signal, { ...(referenceData ? { readIndex: referenceData.readIndex } : {}), ...imageOptions });
  const warnings = [];
  const ocrController = new AbortController();
  const abortOcr = () => ocrController.abort();
  signal.addEventListener('abort', abortOcr, { once: true });
  const ocrTimer = setTimeout(abortOcr, 25000);
  onStage('카드번호 · 이미지 분석 중');
  const prepared = session.prepare(canvas).catch(() => { warnings.push('이미지 비교 엔진을 실행하지 못했습니다.'); return null; });
  const editions = locale === 'auto' ? ['JP', 'EN'] : [locale];
  let codes = extractCardCodes(code);
  const typed = codes.length > 0;
  let ocrSkipped = false;
  // Image retrieval starts as soon as the photo is prepared, alongside OCR; verified artwork ends OCR early,
  // which matters most when the number is unreadable and OCR would try every region.
  const firstPass = prepared.then(ready => ready && session.match('', editions[0], { to: FIRST_IMAGE_PASS }))
    .catch(() => { if (!signal.aborted) warnings.push(`${editions[0]} 이미지 비교 자료를 불러오지 못했습니다.`); return null; });
  if (!typed) void firstPass.then(result => { if (result?.matches.length) { ocrSkipped = true; ocrController.abort(); } });
  try {
    if (!typed) {
      try { codes = await recognizeCardCodes(canvas, { signal: ocrController.signal, getFallbackCanvas: () => prepared, workerOptions: ocrOptions }); }
      catch { if (signal.aborted) signal.throwIfAborted(); if (!ocrSkipped) warnings.push('카드번호를 읽지 못해 이미지로 검색했습니다.'); }
    }
    clearTimeout(ocrTimer);
    signal.throwIfAborted();
    const ready = await prepared;
    const first = await firstPass;
    signal.throwIfAborted();
    const matches = [];
    if (ready) {
      for (const [position, edition] of editions.entries()) {
        onStage(`${edition} 이미지 후보 비교 중`);
        const editionMatches = position === 0 && first ? [...first.matches] : [];
        if (position === 0 && first?.partial) warnings.push(`${edition} 일부 비교 자료를 불러오지 못했습니다.`);
        // Numbers the previous edition verified by artwork carry the same artwork in this one.
        const verifiedCodes = [...new Set(matches.map(item => item.code))].filter(value => /^[A-Z0-9-]+$/.test(value || '') && !codes.slice(0, 3).includes(value)).slice(0, 3);
        for (const number of [...codes.slice(0, 3), ...verifiedCodes]) {
          try { const result = await session.match(number, edition); editionMatches.push(...result.matches); if (result.partial) warnings.push(`${edition} 일부 비교 자료를 불러오지 못했습니다.`); }
          catch { signal.throwIfAborted(); }
        }
        // OCR is cross-checked against full-image retrieval (the first edition's best slice ran above), even when its candidates matched.
        // A verified match is the right card in practice, so the long tail is only searched while nothing is verified,
        // and the second edition skips full retrieval (and its index download) once the first verified the artwork.
        if (position === 0) {
          if (first?.remaining && !editionMatches.length) try {
            const rest = await session.match('', edition, { from: FIRST_IMAGE_PASS });
            editionMatches.push(...rest.matches);
            if (rest.partial) warnings.push(`${edition} 일부 비교 자료를 불러오지 못했습니다.`);
          } catch { signal.throwIfAborted(); warnings.push(`${edition} 이미지 비교 자료를 불러오지 못했습니다.`); }
        } else if (!matches.length) try {
          const head = await session.match('', edition, { to: FIRST_IMAGE_PASS });
          editionMatches.push(...head.matches);
          let partial = head.partial;
          if (head.remaining && !editionMatches.length) {
            const rest = await session.match('', edition, { from: FIRST_IMAGE_PASS });
            editionMatches.push(...rest.matches); partial ||= rest.partial;
          }
          if (partial) warnings.push(`${edition} 일부 비교 자료를 불러오지 못했습니다.`);
        } catch { signal.throwIfAborted(); warnings.push(`${edition} 이미지 비교 자료를 불러오지 못했습니다.`); }
        matches.push(...editionMatches);
      }
    }
    signal.throwIfAborted();
    return { codes, candidates: buildRecognitionCandidates({ matches, codes, locale, market: referenceData?.market || market, links, cards: [...cards, ...special] }), warnings: [...new Set(warnings)] };
  } finally {
    clearTimeout(ocrTimer); signal.removeEventListener('abort', abortOcr); ocrController.abort(); session.dispose();
    // An OCR worker stopped early is discarded; load the next one for the site's following scan.
    if (ocrSkipped && !ocrOptions && !signal.aborted) warmCardCodeReader();
  }
}
