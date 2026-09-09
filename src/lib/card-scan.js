export const MAX_SCAN_BYTES = 15 * 1024 * 1024;

export const normalizeScanCode = value => String(value || '').normalize('NFKC').toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');

export function getScanVariants(items, code, locale) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.apparelId}-${item.locale}`;
    if (!item.apparelId || normalizeScanCode(item.code) !== normalizeScanCode(code) || item.locale !== locale || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractCardCodes(text = '') {
  const normalized = String(text).normalize('NFKC').toUpperCase().replace(/[\u2010-\u2015\u2212]/g, '-');
  const codes = [];
  const digits = value => value.replace(/[O]/g, '0').replace(/[IL|]/g, '1');
  // OCR often joins the adjacent rarity label to the printed card number.
  const pattern = /(?:^|[^A-Z0-9])((?:PRB|OP|0P|EB|ST)\s*([0-9OIL|]{2})\s*[- ]\s*([0-9OIL|]{3})|P\s*-\s*([0-9OIL|]{3}))(?![0-9])/g;
  for (const match of normalized.matchAll(pattern)) {
    const code = match[4]
      ? `P-${digits(match[4])}`
      : `${match[1].match(/^(PRB|OP|0P|EB|ST)/)[1].replace('0P', 'OP')}${digits(match[2])}-${digits(match[3])}`;
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

export function validateScanFile(file) {
  if (!file || file.size === 0) return 'file';
  if (file.size > MAX_SCAN_BYTES) return 'size';
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type || '') && !(!file.type && /\.(jpe?g|png|webp|hei[cf])$/i.test(file.name || ''))) return 'file';
  return '';
}

// Map the visible card frame through the video's object-fit: cover transform.
export function getCameraCrop(videoWidth, videoHeight, viewWidth, viewHeight, frame) {
  if (![videoWidth, videoHeight, viewWidth, viewHeight, frame?.width, frame?.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('camera');
  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
  const offsetX = (videoWidth * scale - viewWidth) / 2;
  const offsetY = (videoHeight * scale - viewHeight) / 2;
  const x = Math.max(0, Math.min(videoWidth - 1, (frame.x + offsetX) / scale));
  const y = Math.max(0, Math.min(videoHeight - 1, (frame.y + offsetY) / scale));
  return { x, y, width: Math.min(videoWidth - x, frame.width / scale), height: Math.min(videoHeight - y, frame.height / scale) };
}
