import { IMAGE_INDEX_VERSION, shortlistImageCodes } from './card-image-features.js';

export function createCardImageSession(signal, { worker: suppliedWorker, readIndex: suppliedReadIndex } = {}) {
  const worker = suppliedWorker || new Worker(new URL('./card-image-worker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  let id = 0, stopped = false, signatures = [];
  function dispose() {
    if (stopped) return;
    stopped = true; worker.terminate();
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
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('image_engine_failed')); }
    pending.clear(); dispose();
  };
  function request(type, data, transfer = []) {
    if (stopped || signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('image_engine_timeout')); dispose(); }, 35000);
      pending.set(requestId, { resolve, reject, timer });
      worker.postMessage({ id: requestId, type, ...data }, transfer);
    });
  }
  async function readIndex(file) {
    if (suppliedReadIndex) return suppliedReadIndex(file);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 12000);
    try {
      if (signal.aborted) controller.abort();
      const response = await fetch(`/card-scan/${file}.json`, { signal: controller.signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('image_index_unavailable');
      const value = await response.json();
      if (value.version !== IMAGE_INDEX_VERSION || !Array.isArray(value.items)) throw new Error('image_index_version');
      return value;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
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
    async match(code, locale) {
      if (!['JP', 'EN'].includes(locale) || (code && !/^[A-Z0-9-]+$/.test(code))) throw new Error('invalid_image_query');
      let codes = code ? [code] : [];
      if (!code) {
        const index = await readIndex(`index-${locale}`);
        codes = shortlistImageCodes(index.items, signatures);
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
      return { matches: ranked.filter(item => item.verified), partial: missing > 0 };
    }
  };
}
