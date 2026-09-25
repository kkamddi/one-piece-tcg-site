import { createWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { extractCardCodes, getOcrRegions } from './card-scan';

function prepareRegion(source, region) {
  const left = Math.floor(source.width * region.x);
  const top = Math.floor(source.height * region.y);
  const sourceWidth = Math.max(1, Math.round(source.width * region.width));
  const sourceHeight = Math.max(1, Math.round(source.height * region.height));
  const scale = Math.min(4, 1800 / sourceWidth, 2400 / sourceHeight);
  const border = 20;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width + border * 2;
  canvas.height = height + border * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, left, top, sourceWidth, sourceHeight, border, border, width, height);
  if (!region.contrast) return canvas;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const gray = pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = contrast;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export async function recognizeCardCodes(canvas, { signal, onProgress = () => {}, getFallbackCanvas = async () => null, onAttempt = () => {}, workerOptions = {} }) {
  let worker;
  let pass = 0;
  let abort;
  const aborted = () => new DOMException('Scan cancelled', 'AbortError');
  const cancellation = new Promise((_, reject) => {
    abort = () => reject(aborted());
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    if (signal.aborted) throw aborted();
    const pendingWorker = createWorker('eng', 1, {
      workerPath,
      ...workerOptions,
      errorHandler: () => {},
      logger: message => {
        if (!signal.aborted) onProgress({ phase: message.status === 'recognizing text' ? 'reading' : 'loading', progress: Math.min(99, Math.round((pass + (message.progress || 0)) * 100 / 12)) });
      }
    }).then(created => {
      if (signal.aborted) {
        void created.terminate();
        throw aborted();
      }
      worker = created;
      return created;
    });
    await Promise.race([pendingWorker, cancellation]);
    await Promise.race([worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' }), cancellation]);
    async function readSource(source) {
      for (const area of getOcrRegions(source.width, source.height)) {
        if (signal.aborted) throw aborted();
        await Promise.race([worker.setParameters({ tessedit_pageseg_mode: area.mode }), cancellation]);
        const region = prepareRegion(source, area);
        try {
          const result = await Promise.race([worker.recognize(region), cancellation]);
          onAttempt({ area, text: result.data.text });
          const codes = extractCardCodes(result.data.text);
          if (codes.length) return codes;
        } finally {
          region.width = region.height = 1;
        }
        pass += 1;
      }
      return [];
    }
    const original = await readSource(canvas);
    if (original.length) return original;
    const fallback = await Promise.race([getFallbackCanvas(), cancellation]);
    return fallback && fallback !== canvas ? await readSource(fallback) : [];
  } finally {
    signal.removeEventListener('abort', abort);
    if (worker) await worker.terminate();
  }
}
