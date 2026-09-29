import { cardShowEvents, confirmedCardShows } from './data/card-show-events.js';

export function koreaToday(now = Date.now()) {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}
export function reviewedShows(events = cardShowEvents) {
  return events.filter(event => !event.reviewRequired && event.locale === 'KR' && ['confirmed', 'cancelled', 'postponed'].includes(event.status))
    .filter(event => confirmedCardShows([{ ...event, status: 'confirmed' }]).length === 1)
    .map(event => ({ ...event, endDate: event.endDate || event.date }));
}
export function filterShows(events, { tab = 'upcoming', region = 'all', today = koreaToday() } = {}) {
  return reviewedShows(events).filter(event => (tab === 'past' ? event.endDate < today : event.endDate >= today)
    && (region === 'all' || event.region === region))
    .sort((a, b) => (tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.id.localeCompare(b.id));
}
export function showRoute({ tab = 'upcoming', region = 'all', id = '' } = {}) {
  const params = new URLSearchParams({ section: 'cardshows' });
  if (tab === 'past') params.set('tab', tab);
  if (['capital', 'other'].includes(region)) params.set('region', region);
  if (id) params.set('event', id);
  return `/news?${params}`;
}
export function safeEventUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
