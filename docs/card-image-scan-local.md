# Card Image Scan: Local Implementation

## Flow

- Mobile scan opens the camera; capture or file selection starts analysis.
- OpenCV runs in a disposable worker, extracts the card region and compares artwork using ORB features and geometric consistency.
- OCR narrows the lookup to a card number. Without a number, a small image-signature index selects a shortlist before geometric matching.
- Matching artwork is promoted, never treated as a confirmed print. Reprints and small-mark variants remain separate, with explicit selection before price lookup.
- Photos stay in browser memory. Only static reference data is fetched; scanning does not query or write D1.
- Missing image data or an uncertain match falls back to manual number / version selection.

## Reference Coverage

Index format: version 3. Catalog: 9,690 entries; image comparison: 9,650 entries.

- 35 images were excluded because a reliable card region could not be extracted, including some product-information placeholders.
- 3 image URLs returned HTTP 404.
- 2 product / bundle identifiers were outside the single-card index scope.
- Details: `public/card-scan/report.json`. Excluded entries are not removed from the market catalog.

The generated data is approximately 90.7 MiB across locale indexes and per-card-number files. A scan fetches the relevant files, not the entire descriptor collection. The image engine is loaded only when scanning starts. First-use mobile download and memory costs still require real-device testing.

## Reproduction

```sh
node scripts/generateCardImageIndex.mjs
node --test scripts/testCardImageMatch.mjs scripts/testCardScanner.mjs scripts/testMarketDetailPresentation.mjs
node scripts/verifyCardImageSamples.mjs
```

Index generation reuses local downloaded-image / feature caches in `artifacts/card-image-index-cache`. A subset requires an explicit output folder, e.g. `--codes=OP01-120 --out=artifacts/card-scan-index-test`, to avoid replacing the full index.

Validation performed locally: 25 focused tests passed; 11 JP/EN samples across OP, EB, ST and promo cards matched at rank 1 after synthetic perspective and brightness changes. The fixture `artifacts/card-scan-OP01-120.png` is used by the focused image tests. Browser testing also found the original and reprint artwork as separate suggestions.

These are not all-card accuracy measurements or physical-phone tests. Sleeve glare, foil reflections, occlusion, blur, unsupported reference images and handset performance remain validation work before release. No production deployment, Android build or database changes were made.

Generated reference/cache folders are excluded from Tailwind source detection. The local debug Vite config also excludes them from change watching.
