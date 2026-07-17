const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function marketDateKeyFromTimestamp(timestamp) {
  const parsed = Number(timestamp || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return new Date(parsed + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function marketDateTimeLabelFromTimestamp(timestamp) {
  const parsed = Number(timestamp || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  const iso = new Date(parsed + KST_OFFSET_MS).toISOString();
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}

export function marketTradeDateKey(value) {
  const rawText = String(value || '').trim();
  if (!rawText) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawText)) return rawText;

  const directParsed = Date.parse(rawText);
  if (Number.isFinite(directParsed)) return marketDateKeyFromTimestamp(directParsed);

  const text = rawText.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const englishDate = text.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})$/);
  if (englishDate) {
    const month = new Date(`${englishDate[1]} 1, 2000 UTC`).getUTCMonth();
    if (Number.isFinite(month)) {
      return new Date(Date.UTC(Number(englishDate[3]), month, Number(englishDate[2]))).toISOString().slice(0, 10);
    }
  }

  const parsed = Date.parse(`${text} UTC`);
  return Number.isFinite(parsed) ? marketDateKeyFromTimestamp(parsed) : '';
}
