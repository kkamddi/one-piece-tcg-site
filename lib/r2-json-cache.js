const inFlightLoads = new Map();

function getBucket() {
  const bucket = process.env?.CARD_THUMBNAILS;
  return bucket && typeof bucket.get === 'function' && typeof bucket.put === 'function'
    ? bucket
    : null;
}

async function readObject(bucket, key) {
  try {
    const object = await bucket.get(key);
    if (!object) return null;
    const parsed = JSON.parse(await object.text());
    if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) return null;
    return {
      generatedAt: Number(parsed.generatedAt || 0),
      value: parsed.value
    };
  } catch {
    return null;
  }
}

async function loadOnce(key, loader) {
  if (inFlightLoads.has(key)) return inFlightLoads.get(key);
  const promise = Promise.resolve()
    .then(loader)
    .finally(() => inFlightLoads.delete(key));
  inFlightLoads.set(key, promise);
  return promise;
}

export async function readThroughR2Json(key, maxAgeMs, loader) {
  const bucket = getBucket();
  if (!bucket) return loader();

  const cached = await readObject(bucket, key);
  if (cached && Date.now() - cached.generatedAt < maxAgeMs) return cached.value;

  try {
    return await loadOnce(key, async () => {
      const value = await loader();
      if (value === null || value === undefined) return cached?.value ?? value;
      const generatedAt = Date.now();
      try {
        await bucket.put(key, JSON.stringify({ generatedAt, value }), {
          httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'private, no-store'
          },
          customMetadata: {
            generatedAt: String(generatedAt)
          }
        });
      } catch {
        // A fresh D1 response is still usable when the supplemental R2 write fails.
      }
      return value;
    });
  } catch (error) {
    if (cached) return cached.value;
    throw error;
  }
}
