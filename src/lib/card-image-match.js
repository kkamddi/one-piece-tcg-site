import { IMAGE_INDEX_VERSION, shortlistImageCodes } from './card-image-features.js';

// Comparison files change at most daily; keep parsed copies for the rest of the page visit.
const loaded = new Map();
const LOADED_LIMIT = 200;
// One OpenCV worker is compiled ahead of the first scan and reused by later scans.
let idleWorker = null;
const createWorker = () => new Worker(new URL('./card-image-worker.js', import.meta.url), { type: 'module' });

// Shared between the warm-up and scans, so a file is never downloaded twice in one visit.
function fetchIndex(file) {
  if (loaded.has(file)) return loaded.get(file);
  const read = async cache => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`/card-scan/${file}.json`, { signal: controller.signal, ...(cache ? { cache } : {}) });
      if (!response.ok) throw new Error('image_index_unavailable');
      return await response.json();
    } finally { clearTimeout(timer); }
  };
  const promise = (async () => {
    let value = await read();
    // A browser copy from before a format change must not break the scan.
    if (value.version !== IMAGE_INDEX_VERSION) value = await read('reload');
    if (value.version !== IMAGE_INDEX_VERSION || !Array.isArray(value.items)) throw new Error('image_index_version');
    return value;
  })();
  promise.catch(() => { if (loaded.get(file) === promise) loaded.delete(file); });
  if (loaded.size >= LOADED_LIMIT) loaded.delete(loaded.keys().next().value);
  loaded.set(file, promise);
  return promise;
}

export function warmCardImageEngine() {
  idleWorker ||= createWorker();
  // Recognition searches JP first; EN's index is only needed when JP verifies nothing.
  fetchIndex('index-JP').catch(() => {});
}

export function releaseCardImageEngine() {
  idleWorker?.terminate(); idleWorker = null;
}

export function createCardImageSession(signal, { worker: suppliedWorker, readIndex: suppliedReadIndex } = {}) {
  const worker = suppliedWorker || idleWorker || createWorker();
  if (worker === idleWorker) idleWorker = null;
  const pending = new Map();
  const shortlists = new Map();
  let id = 0, stopped = false, failed = false, signatures = [];
  function dispose() {
    if (stopped) return;
    stopped = true;
    // A finished scan leaves the compiled engine idle for the next one; cancelled or failed work is discarded.
    if (!suppliedWorker && !failed && !signal.aborted && !pending.size && !idleWorker) idleWorker = worker;
    else worker.terminate();
    signal.removeEventListener('abort', dispose);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new DOMException('Cancelled', 'AbortError')); }
    pending.clear();
  }
  signal.addEventListener('abort', dispose, { once: true });
  worker.onmessage = ({ data }) => {
    const entry = pending.get(data.id);
    if (!entry) return;
    clearTimeout(entry.timer); pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error)); else entry.resolve(data.result);
  };
  worker.onerror = () => {
    failed = true;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('image_engine_failed')); }
    pending.clear(); dispose();
  };
  function request(type, data, transfer = []) {
    if (stopped || signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); failed = true; reject(new Error('image_engine_timeout')); dispose(); }, 35000);
      pending.set(requestId, { resolve, reject, timer });
      worker.postMessage({ id: requestId, type, ...data }, transfer);
    });
  }
  async function readIndex(file) {
    if (suppliedReadIndex) return suppliedReadIndex(file);
    signal.throwIfAborted();
    let abort;
    const cancelled = new Promise((_, reject) => { abort = () => reject(new DOMException('Cancelled', 'AbortError')); signal.addEventListener('abort', abort, { once: true }); });
    try { return await Promise.race([fetchIndex(file), cancelled]); }
    finally { signal.removeEventListener('abort', abort); }
  }
  return {
    dispose,
    async prepare(canvas) {
      const resized = document.createElement('canvas');
      const scale = Math.min(1, 2200 / Math.max(canvas.width, canvas.height));
      resized.width = Math.round(canvas.width * scale); resized.height = Math.round(canvas.height * scale);
      const context = resized.getContext('2d', { willReadFrequently: true });
      context.drawImage(canvas, 0, 0, resized.width, resized.height);
      const pixels = context.getImageData(0, 0, resized.width, resized.height).data.buffer;
      const result = await request('prepare', { pixels, width: resized.width, height: resized.height }, [pixels]);
      signatures = result.signatures;
      resized.width = result.width; resized.height = result.height;
      resized.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0);
      return resized;
    },
    // Without a code, `from`/`to` take a slice of the image shortlist, best candidates first.
    async match(code, locale, { from = 0, to } = {}) {
      if (!['JP', 'EN'].includes(locale) || (code && !/^[A-Z0-9-]+$/.test(code))) throw new Error('invalid_image_query');
      let codes = code ? [code] : [], remaining = 0;
      if (!code) {
        if (!shortlists.has(locale)) shortlists.set(locale, shortlistImageCodes((await readIndex(`index-${locale}`)).items, signatures));
        const shortlist = shortlists.get(locale);
        codes = shortlist.slice(from, to);
        remaining = Math.max(0, shortlist.length - (to ?? shortlist.length));
        if (!codes.length) return { matches: [], partial: false, remaining };
      }
      const references = [];
      let cursor = 0, missing = 0;
      await Promise.all(Array.from({ length: Math.min(4, codes.length) }, async () => {
        while (cursor < codes.length) {
          const next = codes[cursor++];
          try { references.push(...(await readIndex(`${locale}/${next}`)).items); }
          catch (error) { if (signal.aborted) throw error; missing += 1; }
        }
      }));
      if (!references.length) throw new Error('image_index_unavailable');
      const ranked = await request('rank', { items: references });
      return { matches: ranked.filter(item => item.verified), partial: missing > 0, remaining };
    }
  };
}
