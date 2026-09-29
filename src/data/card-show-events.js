// Curated only: require an organizer's dated announcement before adding an event.
// Fields: id, title, date (YYYY-MM-DD), endDate, locale, venue, url, sourceLabel,
// verifiedAt (YYYY-MM-DD), status (confirmed/cancelled). Do not guess a date.
export const cardShowEvents = [{
  id: 'cardshow-seoul-card-festa-20261114', title: 'Seoul Card Festa 2026',
  titleKo: '제3회 서울카드페스타 2026', date: '2026-11-14', locale: 'KR',
  venue: '고양 KINTEX 제2전시장 6 Hall A', region: 'capital', hours: '10:00–18:00 KST',
  url: 'https://seoulcardfesta.com/', sourceLabel: '서울카드페스타',
  verifiedAt: '2026-09-29', status: 'confirmed',
  posterUrl: 'https://seoulcardfesta.com/images/og-image.jpg',
  posterSourceUrl: 'https://seoulcardfesta.com/', posterVerifiedAt: '2026-09-29'
}, {
  id: 'cardshow-collectible-con-20261002', title: 'Collectible Con Seoul 2026',
  titleKo: '콜렉터블 콘 서울 2026', date: '2026-10-02', endDate: '2026-10-03',
  locale: 'KR', region: 'capital', venue: '서울 성동구 성수이로 72 · 스테이지 엑스 성수 차봇',
  hours: '시작 시간 확인 필요 · 20:00 종료',
  scheduleNote: '공식 이미지에는 10:00, 공식 본문과 등록 페이지에는 11:00 시작으로 안내되어 있습니다. 방문 전 주최 측 최신 안내를 확인해 주세요.',
  admission: '무료 · 사전등록 필요', onePieceConfirmed: true,
  url: 'https://collectiblecon.xyz/', sourceLabel: 'Collectible Con',
  registrationUrl: 'https://collectiblecon.xyz/#details',
  verifiedAt: '2026-09-29', status: 'confirmed',
  posterUrl: 'https://collectiblecon.xyz/kv/ticket-stage_en.png',
  posterSourceUrl: 'https://collectiblecon.xyz/', posterVerifiedAt: '2026-09-29'
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
