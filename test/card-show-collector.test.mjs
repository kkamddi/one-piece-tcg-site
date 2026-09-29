import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { collect, extractEvents, robotsAllowed, sources } from '../scripts/collectCardShows.mjs';

const checkedAt = '2026-09-29T00:00:00.000Z';
const event = { '@type': 'Event', name: 'Test domestic card show', startDate: '2026-10-02T11:00:00+09:00', endDate: '2026-10-03T20:00:00+09:00',
  eventStatus: 'https://schema.org/EventScheduled', location: { name: 'Public venue', address: { addressCountry: 'KR' } },
  offers: [{ name: 'Admission', price: '0', priceCurrency: 'KRW' }, { name: 'Vendor table', price: '100', priceCurrency: 'USD' }] };
const html = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const extract = value => extractEvents(html(value), sources[0], checkedAt);
const reply = (body, status = 200, type = 'text/html') => new Response(body, { status, headers: { 'content-type': type } });

test('collects KR event facts only; admission and vendor fees stay separate and require review', () => {
  const result = extract(event);
  assert.equal(result.candidates.length, 1);
  const item = result.candidates[0];
  assert.equal(item.date, '2026-10-02');
  assert.equal(item.locale, 'KR');
  assert.equal(item.reviewRequired, true);
  assert.equal(item.offers[0].amount, 0);
  assert.equal(item.offers[1].amount, 100);
  assert.equal(item.url, sources[0].url);
  assert.equal(item.status, undefined); // Never produces a published confirmed record.
});

test('handles graph/list nesting and duplicate events without trusting remote navigation links', () => {
  const item = { ...event, url: 'http://127.0.0.1/private' };
  const result = extract({ '@graph': [item, { itemListElement: [{ item }] }] });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].url, sources[0].url);
  const conflict = extract([event, { ...event, location: { ...event.location, name: 'Different venue' } }]);
  assert.ok(conflict.issues.includes('conflicting_event_records'));
});

test('rejects invalid dates, timezone ambiguity, missing venues, and overseas locations', () => {
  for (const patch of [{ startDate: '2026-02-30' }, { startDate: '2026-10-02T11:00:00' },
    { endDate: '2026-01-01' }, { location: {} }, { location: { name: 'Venue', address: { addressCountry: 'JP' } } }]) {
    assert.equal(extract({ ...event, ...patch }).candidates.length, 0);
  }
  assert.equal(extract({ ...event, startDate: '2026-10-01T18:00:00Z' }).candidates[0].date, '2026-10-02');
});

test('cancelled and rescheduled events cannot be automatically confirmed', () => {
  for (const status of ['EventCancelled', 'EventRescheduled', 'EventPostponed']) {
    const item = extract({ ...event, eventStatus: `https://schema.org/${status}` }).candidates[0];
    assert.equal(item.sourceStatus, status);
    assert.equal(item.reviewRequired, true);
    assert.ok(['cancelled', 'schedule_changed'].includes(item.reviewReason));
  }
});

test('missing/invalid structured data produces an explicit review issue, never guessed dates', () => {
  assert.ok(extractEvents('<p>October 2 at Seoul</p>', sources[0], checkedAt).issues.includes('no_structured_events'));
  assert.ok(extractEvents('<script type="application/ld+json">broken</script>', sources[0], checkedAt).issues.includes('invalid_structured_data'));
  assert.equal(extract({ ...event, offers: [{ price: '', priceCurrency: 'KRW' }] }).candidates[0].offers[0].amount, null);
});

test('robots allows public paths but blocks forbidden matching paths and invalid HTML responses', () => {
  const url = 'https://example.com/global/application.php';
  assert.ok(robotsAllowed('User-agent: *\nDisallow: /board/\nDisallow: /webmng/', url));
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /', url), false);
  assert.ok(robotsAllowed('User-agent: *\nDisallow: /\nAllow: /global/', url));
  assert.equal(robotsAllowed('User-agent: CardPoneEvents\nDisallow: /*application.php$', url), false);
  assert.equal(robotsAllowed('<html>error</html>', url), false);
});

test('bounded requests use no credentials or redirects and skip a blocked source without deleting anything', async () => {
  const calls = [];
  const report = await collect({ now: new Date(checkedAt), fetcher: async (url, options) => {
    const address = String(url);
    calls.push(address);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    assert.equal(options.headers.authorization, undefined);
    if (address.endsWith('/robots.txt')) return reply(address.includes('collectiblecon') ? 'User-agent: *\nDisallow: /' : 'User-agent: *\nAllow: /', 200, 'text/plain');
    return reply(html(event));
  } });
  assert.equal(report.publication, 'review_only');
  assert.equal(report.results[1].state, 'failed');
  assert.ok(!calls.includes(sources[1].url));
  assert.equal(report.results.filter(item => item.state === 'collected').length, 3);
  assert.equal(calls.length, 7);
});

test('network/robots failures do not erase successful source results or leak exception contents', async () => {
  const report = await collect({ fetcher: async url => {
    if (String(url).includes('collectiblecon')) throw new Error('do-not-log-arbitrary-response');
    if (String(url).endsWith('/robots.txt')) return reply('', 404);
    return reply(html(event));
  } });
  assert.equal(report.results[1].issues[0], 'fetch_failed');
  assert.ok(!JSON.stringify(report).includes('do-not-log'));
  assert.equal(report.results[0].candidates.length, 1);
});

test('oversized responses are rejected', async () => {
  const report = await collect({ fetcher: async url => String(url).endsWith('/robots.txt') ? reply('', 404) : reply('x'.repeat(1024 * 1024 + 1)) });
  assert.ok(report.results.every(item => item.issues.includes('response_too_large')));
});

test('schedule has no push trigger, repository write permission, publication, or deploy command', async () => {
  const workflow = await readFile('.github/workflows/card-show-collector.yml', 'utf8');
  assert.match(workflow, /43 0 \* \* \*/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /CARD_SHOW_COLLECTOR_ENABLED == 'true'/);
  assert.doesNotMatch(workflow, /\bpush:|contents: write|git push|wrangler|deploy-production/);
});
