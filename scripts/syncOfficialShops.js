import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const shopsPath = path.join(rootDir, 'src/data/shops.json');

const OFFICIAL_BASE = 'https://onepiece-cardgame.kr';
const USER_AGENT = 'one-piece-tcg-site-sync/0.2 (+internal tooling)';

const SOURCES = [
  {
    type: 'general',
    label: '공식 취급 점포',
    storesUrl: `${OFFICIAL_BASE}/api/stores?sido=&gungu=`,
    pageUrl: `${OFFICIAL_BASE}/shoplist.do`
  },
  {
    type: 'official',
    label: '공인/공식 점포',
    storesUrl: `${OFFICIAL_BASE}/api/officialstores?sido=&gungu=`,
    pageUrl: `${OFFICIAL_BASE}/officialshoplist.do`
  }
];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json,text/plain,*/*'
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function getExtraValue(store, key) {
  return store.extravars?.find((item) => item.eid === key)?.value?.trim() ?? '';
}

function normalizeStore(store, source) {
  const sido = getExtraValue(store, 'sido');
  const gungu = getExtraValue(store, 'gungu');
  const address = getExtraValue(store, 'address');

  return {
    id: `${source.type}-${store.boardNum}`,
    sourceType: source.type,
    sourceLabel: source.label,
    name: store.boardTitle?.trim() ?? '',
    address,
    sido,
    gungu,
    lat: store.lat ?? null,
    lng: store.lng ?? null,
    boardNum: store.boardNum,
    boardDate: store.boardDate ?? null,
    officialPageUrl: source.pageUrl,
    officialApiUrl: source.storesUrl
  };
}

async function main() {
  console.log('[sync:shops] starting official shop sync');
  const allStores = [];

  for (const source of SOURCES) {
    const stores = await fetchJson(source.storesUrl);
    const normalized = stores.map((store) => normalizeStore(store, source));
    allStores.push(...normalized);
    console.log(`[sync:shops] ${source.type}: ${normalized.length} stores`);
  }

  const finalStores = allStores.sort((a, b) => {
    return [a.sido, a.gungu, a.name].join(' ').localeCompare([b.sido, b.gungu, b.name].join(' '), 'ko');
  });

  await mkdir(path.dirname(shopsPath), { recursive: true });
  await writeFile(shopsPath, `${JSON.stringify(finalStores, null, 2)}\n`, 'utf8');
  console.log(`[sync:shops] wrote ${finalStores.length} stores`);
}

main().catch((error) => {
  console.error('[sync:shops] fatal:', error);
  process.exitCode = 1;
});
