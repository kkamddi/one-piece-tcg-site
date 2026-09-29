// Curated only: require an organizer's dated announcement before adding an event.
// Fields: id, title, date (YYYY-MM-DD), endDate, locale, venue, url, sourceLabel,
// verifiedAt (YYYY-MM-DD), status (confirmed/cancelled). Do not guess a date.
export const cardShowEvents = [{
  id: 'cardshow-seoul-card-festa-20261114', title: 'Seoul Card Festa 2026',
  titleKo: '제3회 서울카드페스타 2026', date: '2026-11-14', locale: 'KR',
  venue: '고양 KINTEX 제2전시장 6 Hall A', region: 'capital', hours: '10:00–18:00 KST',
  url: 'https://seoulcardfesta.com/', sourceLabel: '서울카드페스타',
  verifiedAt: '2026-09-29', status: 'confirmed'
}];
export const cardShowSources = [
  { name: '서울카드페스타', url: 'https://seoulcardfesta.com/' },
  { name: 'Seoul Collectibles Show', url: 'https://www.seoulcollectiblesshow.com/28' }
];

export function confirmedCardShows(events = cardShowEvents) {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  return events.filter(event => event.status === 'confirmed' && event.id && event.title
    && validDate(event.date) && validDate(event.verifiedAt)
    && (!event.endDate || (validDate(event.endDate) && event.endDate >= event.date))
    && ['KR', 'JP'].includes(event.locale) && event.venue && event.sourceLabel
    && /^https:\/\//.test(event.url || ''))
    .map(event => ({ ...event, kind: 'cardshow', category: event.venue, priority: 'low', isSchedule: true }));
}
