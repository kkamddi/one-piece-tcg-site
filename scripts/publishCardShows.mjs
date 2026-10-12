// Publishes card shows that organizers mark up as schema.org Events on their own sites.
// Curated entries in src/data/card-show-events.js still win when ids match.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collect } from './collectCardShows.mjs';

export const AUTO_FILE = 'src/data/card-show-events.auto.js';
const CAPITAL = /서울|경기|인천|고양|킨텍스|KINTEX|코엑스|COEX|성수|Seoul|Seongsu|Incheon|Goyang|Gyeonggi/i;

const statusOf = (sourceStatus) => (sourceStatus === 'EventCancelled' ? 'cancelled'
  : ['EventPostponed', 'EventRescheduled'].includes(sourceStatus) ? 'postponed' : 'confirmed');

export function toPublishedShow(candidate) {
  return {
    id: candidate.id,
    title: candidate.title,
    date: candidate.date,
    ...(candidate.endDate && candidate.endDate !== candidate.date ? { endDate: candidate.endDate } : {}),
    locale: 'KR',
    region: CAPITAL.test(candidate.venue) ? 'capital' : 'other',
    venue: candidate.venue,
    url: candidate.url,
    sourceLabel: candidate.sourceLabel,
    verifiedAt: candidate.checkedAt.slice(0, 10),
    status: statusOf(candidate.sourceStatus),
    autoCollected: true
  };
}

// A source that answered replaces its upcoming shows; past shows and shows from sources
// that failed today are kept, so one bad fetch never wipes the calendar.
export function publishCardShows(report, previous = [], today) {
  const answered = new Set(report.results.filter((result) => result.state !== 'failed').map((result) => result.sourceId));
  const kept = previous.filter((show) => show.endDate ? show.endDate < today : show.date < today)
    .concat(previous.filter((show) => !answered.has(show.sourceId) && (show.endDate || show.date) >= today));
  const previousById = new Map(previous.map((show) => [show.id, show]));
  const sameExceptCheck = (a, b) => JSON.stringify({ ...a, verifiedAt: '' }) === JSON.stringify({ ...b, verifiedAt: '' });
  const fresh = report.results.filter((result) => answered.has(result.sourceId))
    .flatMap((result) => result.candidates.map((candidate) => {
      const show = { ...toPublishedShow(candidate), sourceId: result.sourceId };
      // Keep the first check date while nothing else changed, so the file (and a deploy) only changes with the facts.
      const before = previousById.get(show.id);
      return before && sameExceptCheck(before, show) ? before : show;
    }));
  const byId = new Map([...kept, ...fresh].map((show) => [show.id, show]));
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function renderAutoModule(shows) {
  return `// Generated daily by scripts/publishCardShows.mjs from organizers' schema.org Event data. Do not edit by hand.\nexport const autoCardShowEvents = ${JSON.stringify(shows, null, 2)};\n`;
}

async function readPrevious() {
  try {
    const module = await import(`${pathToFileURL(resolve(AUTO_FILE)).href}?t=${Date.now()}`);
    return module.autoCardShowEvents || [];
  } catch { return []; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await collect();
  const folder = resolve('artifacts/card-show-collection');
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const shows = publishCardShows(report, await readPrevious(), today);
  const next = renderAutoModule(shows);
  const current = await readFile(resolve(AUTO_FILE), 'utf8').catch(() => '');
  if (next !== current) await writeFile(resolve(AUTO_FILE), next);
  for (const result of report.results) console.log(`${result.sourceId}: ${result.state}; candidates=${result.candidates.length}; ${result.issues.join(',')}`);
  console.log(`published ${shows.length} shows${next === current ? ' (unchanged)' : ''}`);
  if (report.results.every((result) => result.state === 'failed')) process.exitCode = 1;
}
