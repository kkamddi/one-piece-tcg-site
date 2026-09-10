import cvModule from '@techstark/opencv-js';
import { normalizeCardImage, imageSignature, extractImageFeatures, compareImageFeatures } from './card-image-features.js';

let photoFeatures;
const ready = Promise.resolve(cvModule);
self.onmessage = async ({ data: message }) => {
  try {
    const cv = await ready;
    if (message.type === 'prepare') {
      const source = cv.matFromImageData({ data: new Uint8ClampedArray(message.pixels), width: message.width, height: message.height });
      let normalized, ocrImage;
      const rotated = new cv.Mat();
      try {
        normalized = normalizeCardImage(cv, source);
        photoFeatures = extractImageFeatures(cv, normalized, 600);
        const signatures = [imageSignature(cv, normalized)];
        for (const direction of [cv.ROTATE_90_CLOCKWISE, cv.ROTATE_180, cv.ROTATE_90_COUNTERCLOCKWISE]) {
          cv.rotate(normalized, rotated, direction);
          signatures.push(imageSignature(cv, rotated));
        }
        ocrImage = normalizeCardImage(cv, source, 1080);
        const pixels = new Uint8ClampedArray(ocrImage.data).buffer;
        self.postMessage({ id: message.id, result: { width: ocrImage.cols, height: ocrImage.rows, pixels, signatures } }, [pixels]);
      } finally { rotated.delete(); ocrImage?.delete(); normalized?.delete(); source.delete(); }
    } else if (message.type === 'rank') {
      if (!photoFeatures) throw new Error('photo_not_prepared');
      const results = message.items.map(item => {
        const reference = { ...item, descriptors: Uint8Array.from(atob(item.descriptors), c => c.charCodeAt(0)) };
        return { key: item.key, code: item.code, ...compareImageFeatures(cv, reference, photoFeatures) };
      }).sort((a, b) => b.score - a.score);
      self.postMessage({ id: message.id, result: results });
    }
  } catch (error) { self.postMessage({ id: message.id, error: String(error?.message || error) }); }
};
