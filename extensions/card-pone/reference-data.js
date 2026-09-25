const BASE = 'https://www.optcgkorea.com/card-scan/';
const CACHE = 'card-pone-references-v1';
const safeFile = /^(?:catalog|index-(?:JP|EN)|(?:JP|EN)\/[A-Z0-9-]+)\.json$/;

export function resilientReferenceReader(remote, signal, { baseUrl, fetcher = fetch }) {
  let offline = !remote;
  return async file => {
    signal.throwIfAborted();
    if (!safeFile.test(`${file}.json`)) throw new Error('reference_path_invalid');
    if (!offline) {
      try { return await remote.readIndex(file); }
      catch { signal.throwIfAborted(); offline = true; }
    }
    // Packaged files are a trusted, versioned fallback, never an unchecked remote response.
    const response = await fetcher(new URL(`${file}.json`, baseUrl).href, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), credentials: 'omit' });
    if (!response.ok) throw new Error('bundled_reference_unavailable');
    const value = await response.json();
    if (value.version !== 3 || !Array.isArray(value.items)) throw new Error('bundled_reference_invalid');
    return value;
  };
}

export async function loadReferenceData(signal, { fetcher = fetch, cacheStorage = caches } = {}) {
  const cache = await cacheStorage.open(CACHE);
  const response = await fetcher(`${BASE}manifest.json`, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('reference_manifest_unavailable');
  const manifest = await response.json();
  if (manifest.schema !== 1 || manifest.indexVersion !== 3 || !/^[a-f0-9]{64}$/.test(manifest.revision)
    || !manifest.files || !manifest.files['catalog.json'] || Object.keys(manifest.files).length > 20000) throw new Error('reference_manifest_invalid');
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (!safeFile.test(file) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('reference_path_invalid');
  }
  async function read(file) {
    if (!safeFile.test(file) || !manifest.files[file]) throw new Error('reference_missing');
    const url = `${BASE}${file}?v=${manifest.files[file]}`;
    let stored = await cache.match(url);
    if (!stored) {
      const result = await fetcher(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!result.ok) throw new Error('reference_download_failed');
      const bytes = await result.arrayBuffer();
      if (bytes.byteLength > 16000000) throw new Error('reference_too_large');
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
      if (digest !== manifest.files[file]) throw new Error('reference_integrity_failed');
      stored = new Response(bytes, { headers: { 'content-type': 'application/json' } });
      await cache.put(url, stored.clone());
    }
    const value = await stored.json();
    if (value.version !== manifest.indexVersion || !Array.isArray(value.items)) throw new Error('reference_format_invalid');
    return value;
  }
  const catalog = await read('catalog.json');
  if (catalog.items.length > 30000 || catalog.items.some(item => !['JP', 'EN'].includes(item.locale)
    || !Number.isSafeInteger(item.apparelId) || item.apparelId <= 0 || typeof item.code !== 'string')) throw new Error('reference_catalog_invalid');
  // Keep unchanged files, discard superseded revisions rather than growing storage indefinitely.
  const allowed = new Set(Object.entries(manifest.files).map(([file, hash]) => `${BASE}${file}?v=${hash}`));
  for (const request of await cache.keys()) if (!allowed.has(request.url)) await cache.delete(request);
  return { market: catalog.items, readIndex: file => read(`${file}.json`) };
}
