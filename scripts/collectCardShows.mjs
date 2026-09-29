import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const sources = [
  { id: 'seoul-card-festa', name: '서울카드페스타', url: 'https://seoulcardfesta.com/' },
  { id: 'collectible-con', name: 'Collectible Con', url: 'https://collectiblecon.xyz/' },
  { id: 'seoul-tcg-con', name: 'SEOUL TCG CON', url: 'https://seoultcgcon.com/' },
  { id: 'kccf', name: '코리아 카드 컬쳐 페어', url: 'https://www.kccf.net/global/application.php' }
];
const agent = 'CardPoneEvents/1.0';
const maxBytes = 1024 * 1024;
const plain = (value, limit = 240) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, limit) : '';
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];

// Conservative: any matching disallow wins a tie, including a wildcard agent.
// Unknown directives do not grant permission. No login, cookie, or browser fallback.
export function robotsAllowed(text, url) {
  if (/<html\b/i.test(text)) return false;
  const groups = [];
  let group = { agents: [], rules: [] };
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.split('#')[0].trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2].trim();
    if (key === 'user-agent') {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (['allow', 'disallow'].includes(key) && group.agents.length && value) group.rules.push({ key, value });
  }
  groups.push(group);
  const path = new URL(url).pathname + new URL(url).search;
  const matches = groups.filter(g => g.agents.some(a => a === '*' || agent.toLowerCase().includes(a)))
    .flatMap(g => g.rules).filter(rule => {
      const pattern = rule.value.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$');
      return new RegExp(`^${pattern}`).test(path);
    }).sort((a, b) => b.value.length - a.value.length || (a.key === 'disallow' ? -1 : 1));
  return matches[0]?.key !== 'disallow';
}

function localDate(value) {
  if (typeof value !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const stamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? value : '';
  }
  // Datetimes must carry their timezone; never infer a timezone from the host.
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !localDate(value.slice(0, 10))) return '';
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? new Date(stamp + 9 * 3600000).toISOString().slice(0, 10) : '';
}

export function extractEvents(html, source, checkedAt) {
  const events = [], issues = [];
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12) return;
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
    if (array(value['@type']).some(type => ['Event', 'ExhibitionEvent', 'SocialEvent'].includes(type))) events.push(value);
    for (const key of ['@graph', 'itemListElement', 'item', 'subEvent']) visit(value[key], depth + 1);
  }
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { issues.push('invalid_structured_data'); }
  }
  const candidates = [];
  for (const event of events) {
    const location = event.location;
    const country = typeof location?.address?.addressCountry === 'object' ? location.address.addressCountry.name : location?.address?.addressCountry;
    if (!['KR', 'KOR', 'South Korea', 'Republic of Korea', '대한민국'].includes(country)) { issues.push('country_unverified_or_not_korea'); continue; }
    const date = localDate(event.startDate), endDate = localDate(event.endDate || event.startDate);
    const title = plain(event.name), venue = plain(location?.name);
    if (!date || !endDate || endDate < date || !title || !venue) { issues.push('required_fields_invalid'); continue; }
    const status = String(event.eventStatus || '').split('/').at(-1);
    const offers = array(event.offers).slice(0, 12).map(offer => ({ name: plain(offer.name, 100),
      amount: offer.price !== undefined && offer.price !== null && String(offer.price).trim() !== '' && Number.isFinite(Number(offer.price)) && Number(offer.price) >= 0 ? Number(offer.price) : null,
      currency: ['KRW', 'USD', 'JPY'].includes(offer.priceCurrency) ? offer.priceCurrency : null }));
    candidates.push({ id: `cardshow-${source.id}-${date.replaceAll('-', '')}`, sourceId: source.id,
      title, date, endDate, locale: 'KR', venue,
      url: source.url, sourceLabel: source.name, checkedAt,
      sourceStatus: status || 'unknown', reviewRequired: true,
      reviewReason: status === 'EventCancelled' ? 'cancelled' : ['EventPostponed', 'EventRescheduled'].includes(status) ? 'schedule_changed' : 'verify_against_visible_announcement',
      offers });
  }
  // Two inconsistent records for the same date must never be silently collapsed.
  const unique = [...new Map(candidates.map(event => [JSON.stringify(event), event])).values()];
  if (new Set(unique.map(event => event.id)).size !== unique.length) issues.push('conflicting_event_records');
  if (!events.length) issues.push('no_structured_events');
  return { candidates: unique, issues: [...new Set(issues)] };
}

async function fetchBounded(url, fetcher) {
  const response = await fetcher(url, { headers: { 'user-agent': agent, accept: 'text/html,text/plain,application/xhtml+xml' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return { status: 404, text: '' };
  if (!response.ok) throw new Error(`http_${response.status}`);
  if (!/text\/(?:html|plain)|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) throw new Error('unsupported_content_type');
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('response_too_large');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('response_too_large');
      text += decoder.decode(value, { stream: true });
    }
    return { status: response.status, text: text + decoder.decode() };
  } finally { await reader.cancel().catch(() => {}); }
}

export async function collect({ fetcher = fetch, now = new Date() } = {}) {
  const checkedAt = now.toISOString();
  const results = [];
  for (const source of sources) {
    try {
      const robots = await fetchBounded(new URL('/robots.txt', source.url), fetcher);
      if (robots.status !== 404 && !robotsAllowed(robots.text, source.url)) throw new Error('robots_disallowed');
      const page = await fetchBounded(source.url, fetcher);
      if (page.status === 404) throw new Error('http_404');
      const parsed = extractEvents(page.text, source, checkedAt);
      results.push({ sourceId: source.id, url: source.url, state: parsed.issues.length ? 'needs_review' : 'collected', ...parsed });
    } catch (error) {
      const reason = /^(http_\d{3}|robots_disallowed|response_too_large|unsupported_content_type)$/.test(error.message) ? error.message : 'fetch_failed';
      results.push({ sourceId: source.id, url: source.url, state: 'failed', issues: [reason], candidates: [] });
    }
  }
  return { checkedAt, scope: 'KR', publication: 'review_only', results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await collect();
  if (process.argv.includes('--write-report')) {
    const folder = resolve('artifacts/card-show-collection');
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  }
  for (const result of report.results) console.log(`${result.sourceId}: ${result.state}; candidates=${result.candidates.length}; ${result.issues.join(',')}`);
  if (report.results.some(result => result.state === 'failed') || !report.results.some(result => result.candidates.length)) process.exitCode = 1;
}
