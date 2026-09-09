import { createWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { extractCardCodes } from './card-scan';

function prepareRegion(source, region) {
  const top = Math.floor(source.height * (region === 'footer' ? 0.88 : region === 'lower' ? 0.60 : 0));
  const scale = Math.min(3, 1800 / source.width);
  const border = 20;
  const width = Math.round(source.width * scale);
  const height = Math.round((source.height - top) * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width + border * 2;
  canvas.height = height + border * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, top, source.width, source.height - top, border, border, width, height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const gray = pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = contrast;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export async function recognizeCardCodes(canvas, { signal, onProgress = () => {} }) {
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
      errorHandler: () => {},
      logger: message => {
        if (!signal.aborted) onProgress({ phase: message.status === 'recognizing text' ? 'reading' : 'loading', progress: Math.round((pass + (message.progress || 0)) * 100 / 3) });
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
    // Card numbers are usually in the footer. Fall back to the whole photo.
    for (const area of ['footer', 'lower', 'full']) {
      const region = prepareRegion(canvas, area);
      try {
        const result = await Promise.race([worker.recognize(region), cancellation]);
        const codes = extractCardCodes(result.data.text);
        if (codes.length) return codes;
      } finally {
        region.width = region.height = 1;
      }
      pass += 1;
    }
    return [];
  } finally {
    signal.removeEventListener('abort', abort);
    if (worker) await worker.terminate();
  }
}
