import assert from 'node:assert/strict';
import test from 'node:test';
import { publishCardShows, renderAutoModule, toPublishedShow } from '../scripts/publishCardShows.mjs';
import { confirmedCardShows } from '../src/data/card-show-events.js';

const candidate = (overrides = {}) => ({
  id: 'cardshow-seoul-card-festa-20261114', sourceId: 'seoul-card-festa', title: '2026 Seoul Card Festa',
  date: '2026-11-14', endDate: '2026-11-14', locale: 'KR', venue: 'KINTEX 제 2 전시장 6 Hall A',
  url: 'https://seoulcardfesta.com/', sourceLabel: '서울카드페스타', checkedAt: '2026-10-12T00:43:00.000Z',
  sourceStatus: 'EventScheduled', reviewRequired: true, ...overrides
});
const report = (results) => ({ checkedAt: '2026-10-12T00:43:00.000Z', results });
const ok = (sourceId, candidates) => ({ sourceId, state: 'collected', issues: [], candidates });

test('a scheduled organizer event becomes a confirmed show that the site lists', () => {
  const show = toPublishedShow(candidate());
  assert.equal(show.status, 'confirmed');
  assert.equal(show.region, 'capital');
  assert.equal(show.verifiedAt, '2026-10-12');
  assert.equal(show.endDate, undefined);
  assert.equal(confirmedCardShows([show]).length, 1);
});

test('cancelled and postponed events are published with that status, never as confirmed', () => {
  assert.equal(toPublishedShow(candidate({ sourceStatus: 'EventCancelled' })).status, 'cancelled');
  assert.equal(toPublishedShow(candidate({ sourceStatus: 'EventPostponed' })).status, 'postponed');
  assert.equal(confirmedCardShows([toPublishedShow(candidate({ sourceStatus: 'EventCancelled' }))]).length, 0);
});

test('a failed source keeps its upcoming shows and past shows always stay', () => {
  const previous = [
    { ...toPublishedShow(candidate()), sourceId: 'seoul-card-festa' },
    { ...toPublishedShow(candidate({ id: 'cardshow-collectible-con-20261002', sourceId: 'collectible-con', date: '2026-10-02', endDate: '2026-10-03' })), sourceId: 'collectible-con' }
  ];
  const shows = publishCardShows(report([{ sourceId: 'seoul-card-festa', state: 'failed', issues: ['fetch_failed'], candidates: [] }, ok('collectible-con', [])]), previous, '2026-10-12');
  assert.deepEqual(shows.map((show) => show.id), ['cardshow-collectible-con-20261002', 'cardshow-seoul-card-festa-20261114']);
});

test('an answering source that dropped an upcoming show removes it', () => {
  const previous = [{ ...toPublishedShow(candidate()), sourceId: 'seoul-card-festa' }];
  assert.equal(publishCardShows(report([ok('seoul-card-festa', [])]), previous, '2026-10-12').length, 0);
});

test('an unchanged show keeps its first check date so the file does not churn', () => {
  const first = publishCardShows(report([ok('seoul-card-festa', [candidate()])]), [], '2026-10-12');
  const next = publishCardShows(report([ok('seoul-card-festa', [candidate({ checkedAt: '2026-10-13T00:43:00.000Z' })])]), first, '2026-10-13');
  assert.equal(renderAutoModule(next), renderAutoModule(first));
  const moved = publishCardShows(report([ok('seoul-card-festa', [candidate({ venue: 'COEX Hall C', checkedAt: '2026-10-13T00:43:00.000Z' })])]), first, '2026-10-13');
  assert.equal(moved[0].venue, 'COEX Hall C');
  assert.equal(moved[0].verifiedAt, '2026-10-13');
});
