export const IMAGE_INDEX_VERSION = 3;

// Keep the same preprocessing in the offline indexer and the browser worker.
export function normalizeCardImage(cv, rgba) {
  const owned = [];
  const keep = value => { owned.push(value); return value; };
  try {
    const small = keep(new cv.Mat());
    const scale = Math.min(1, 900 / Math.max(rgba.cols, rgba.rows));
    cv.resize(rgba, small, new cv.Size(Math.round(rgba.cols * scale), Math.round(rgba.rows * scale)));
    const gray = keep(new cv.Mat());
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    const edges = keep(new cv.Mat());
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 35, 110);
    const kernel = keep(cv.Mat.ones(3, 3, cv.CV_8U));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
    const contours = keep(new cv.MatVector());
    const hierarchy = keep(new cv.Mat());
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let best = null;
    let bestArea = small.cols * small.rows * 0.16;
    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const polygon = new cv.Mat();
      try {
        cv.approxPolyDP(contour, polygon, cv.arcLength(contour, true) * 0.025, true);
        const area = Math.abs(cv.contourArea(polygon));
        if (polygon.rows !== 4 || area <= bestArea || !cv.isContourConvex(polygon)) continue;
        const points = Array.from({ length: 4 }, (_, n) => ({ x: polygon.data32S[n * 2], y: polygon.data32S[n * 2 + 1] }));
        const center = points.reduce((a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }), { x: 0, y: 0 });
        points.sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
        const start = points.reduce((n, p, j) => p.x + p.y < points[n].x + points[n].y ? j : n, 0);
        const ordered = [...points.slice(start), ...points.slice(0, start)];
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const width = (distance(ordered[0], ordered[1]) + distance(ordered[2], ordered[3])) / 2;
        const height = (distance(ordered[1], ordered[2]) + distance(ordered[3], ordered[0])) / 2;
        const ratio = Math.min(width, height) / Math.max(width, height);
        if (ratio < 0.48 || ratio > 0.88) continue;
        if (width > height) ordered.push(ordered.shift());
        best = ordered; bestArea = area;
      } finally { contour.delete(); polygon.delete(); }
    }
    const normalized = new cv.Mat();
    if (best) {
      const src = keep(cv.matFromArray(4, 1, cv.CV_32FC2, best.flatMap(p => [p.x, p.y])));
      const dst = keep(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 359, 0, 359, 503, 0, 503]));
      const transform = keep(cv.getPerspectiveTransform(src, dst));
      cv.warpPerspective(small, normalized, transform, new cv.Size(360, 504));
    } else {
      // Marketplace thumbnails can contain a small card plus a separate mark close-up.
      const foreground = keep(new cv.Mat());
      cv.threshold(gray, foreground, 240, 255, cv.THRESH_BINARY_INV);
      const regions = keep(new cv.MatVector());
      cv.findContours(foreground, regions, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      let bounds = null, area = small.cols * small.rows * .14;
      const boxes = [];
      for (let i = 0; i < regions.size(); i += 1) {
        const region = regions.get(i);
        try {
          const rect = cv.boundingRect(region);
          if (rect.width * rect.height >= small.cols * small.rows * .015) boxes.push(rect);
        } finally { region.delete(); }
      }
      for (const seed of boxes) {
        let left = seed.x, right = seed.x + seed.width, top = seed.y, bottom = seed.y + seed.height;
        for (const rect of boxes) {
          const overlap = Math.min(right, rect.x + rect.width) - Math.max(left, rect.x);
          const gap = Math.max(0, rect.y - bottom, top - rect.y - rect.height);
          if (overlap < Math.min(seed.width, rect.width) * .65 || rect.width > seed.width * 1.8 || rect.width < seed.width * .5 || gap > small.rows * .25) continue;
          left = Math.min(left, rect.x); right = Math.max(right, rect.x + rect.width);
          top = Math.min(top, rect.y); bottom = Math.max(bottom, rect.y + rect.height);
        }
        const rect = new cv.Rect(left, top, right - left, bottom - top), ratio = rect.width / rect.height;
        if (ratio >= .48 && ratio <= .88 && rect.width * rect.height > area) { bounds = rect; area = rect.width * rect.height; }
      }
      const content = bounds ? keep(small.roi(bounds)) : small;
      const factor = Math.min(1, 600 / Math.max(content.cols, content.rows));
      cv.resize(content, normalized, new cv.Size(Math.round(content.cols * factor), Math.round(content.rows * factor)));
    }
    return normalized;
  } finally { owned.reverse().forEach(value => value.delete()); }
}

export function imageSignature(cv, rgba) {
  const thumb = new cv.Mat();
  try {
    cv.resize(rgba, thumb, new cv.Size(8, 12), 0, 0, cv.INTER_AREA);
    const signature = [];
    for (let i = 0; i < thumb.data.length; i += 4) signature.push(thumb.data[i], thumb.data[i + 1], thumb.data[i + 2]);
    return signature;
  } finally { thumb.delete(); }
}

export function extractImageFeatures(cv, rgba, maxFeatures = 180) {
  const gray = new cv.Mat();
  const mask = cv.Mat.zeros(rgba.rows, rgba.cols, cv.CV_8U);
  const keypoints = new cv.KeyPointVector();
  const descriptors = new cv.Mat();
  const orb = new cv.ORB();
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, gray);
    // Exclude the shared number / rules area from artwork evidence.
    cv.rectangle(mask, new cv.Point(Math.round(rgba.cols * .05), Math.round(rgba.rows * .08)), new cv.Point(Math.round(rgba.cols * .95), Math.round(rgba.rows * .76)), new cv.Scalar(255), -1);
    orb.setMaxFeatures(maxFeatures);
    orb.setFastThreshold(10);
    orb.detectAndCompute(gray, mask, keypoints, descriptors);
    const points = [];
    for (let i = 0; i < keypoints.size(); i += 1) {
      const point = keypoints.get(i).pt;
      points.push(Math.round(point.x * 10) / 10, Math.round(point.y * 10) / 10);
    }
    return { width: rgba.cols, height: rgba.rows, points, descriptors: Array.from(descriptors.data) };
  } finally { orb.delete(); descriptors.delete(); keypoints.delete(); mask.delete(); gray.delete(); }
}

export function compareImageFeatures(cv, reference, photo) {
  if (reference.points.length < 20 || photo.points.length < 20) return { score: 0, inliers: 0, verified: false };
  const owned = [];
  const keep = value => { owned.push(value); return value; };
  try {
    const a = keep(cv.matFromArray(reference.points.length / 2, 32, cv.CV_8U, reference.descriptors));
    const b = keep(cv.matFromArray(photo.points.length / 2, 32, cv.CV_8U, photo.descriptors));
    const matcher = keep(new cv.BFMatcher(cv.NORM_HAMMING, false));
    const matches = keep(new cv.DMatchVectorVector());
    matcher.knnMatch(a, b, matches, 2);
    const src = [], dst = [];
    const used = new Set();
    for (let i = 0; i < matches.size(); i += 1) {
      const pair = matches.get(i);
      try {
        if (pair.size() < 2) continue;
        const first = pair.get(0), second = pair.get(1);
        if (first.distance > 64 || first.distance >= second.distance * .76 || used.has(first.trainIdx)) continue;
        used.add(first.trainIdx);
        src.push(reference.points[first.queryIdx * 2], reference.points[first.queryIdx * 2 + 1]);
        dst.push(photo.points[first.trainIdx * 2], photo.points[first.trainIdx * 2 + 1]);
      } finally { pair.delete(); }
    }
    if (src.length < 16) return { score: 0, inliers: 0, verified: false };
    const source = keep(cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, src));
    const target = keep(cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, dst));
    const mask = keep(new cv.Mat());
    const transform = keep(cv.findHomography(source, target, cv.RANSAC, 4, mask));
    if (transform.empty()) return { score: 0, inliers: 0, verified: false };
    const x = [], y = [];
    for (let i = 0; i < mask.data.length; i += 1) if (mask.data[i]) { x.push(src[i * 2]); y.push(src[i * 2 + 1]); }
    const inliers = x.length;
    const ratio = inliers / (src.length / 2);
    const coverage = inliers ? (Math.max(...x) - Math.min(...x)) * (Math.max(...y) - Math.min(...y)) / (reference.width * reference.height) : 0;
    const verified = inliers >= 10 && ratio >= .45 && coverage >= .08;
    return { score: verified ? inliers * ratio : 0, inliers, verified };
  } finally { owned.reverse().forEach(value => value.delete()); }
}

export function signatureDistance(a, b) {
  if (!a?.length || a.length !== b?.length) return Infinity;
  const meanA = a.reduce((s, n) => s + n, 0) / a.length;
  const meanB = b.reduce((s, n) => s + n, 0) / b.length;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) { const x = a[i] - meanA, y = b[i] - meanB; dot += x * y; aa += x * x; bb += y * y; }
  return aa && bb ? 1 - dot / Math.sqrt(aa * bb) : 2;
}
