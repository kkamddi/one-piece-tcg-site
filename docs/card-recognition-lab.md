# Local Card Recognition Lab

URL: http://127.0.0.1:4182/dev/card-recognition

Development-only, loopback-host route. No production entry, extension installation, database migration, new package or external AI call was added.

## Flow

1. Upload, drop or paste a raster image; optionally crop or rotate it.
2. Select JP, EN or both; optionally provide a card number.
3. OCR extracts numbers. Existing OpenCV ORB/homography matching ranks artwork candidates; an unsuccessful number match retries the image-only index.
4. Show three candidates initially, with remaining candidates expandable. Scores are not presented as confidence percentages. Language and exact printing remain user decisions.
5. Cross-reference product IDs with approved card-market links and the local catalog snapshot. Never infer a printing from its number alone.
6. Only one valid, approved catalog link plus explicit user confirmation enables the existing price-page link. Bundled historical product prices are never shown as current prices.

## Boundaries

- Photos remain in browser memory. Reference files, OCR models and result thumbnails are fetched; user images are not uploaded or persisted.
- Reference coverage is the existing JP/EN market-product image index, not every card in the catalog and not KR.
- The catalog connection is checked against bundled catalog data and approved mappings, not a new live DB recognition service.
- Identical-art reprints, foil/stamp distinctions, language and authenticity are not automatically resolved.
- Card thumbnails fall back to original and marketplace image URLs when available.
- Existing public scanner remains disabled and unchanged.

## Validation (2026-09-21)

Command: `node --test scripts/testCardRecognitionLab.mjs scripts/testCardImageMatch.mjs scripts/testCardScanner.mjs`

32 focused tests pass: OCR parsing, wrong-number image evidence, locale isolation, approved mapping restrictions, duplicate handling, crop bounds, cancellation, artwork matching, perspective/rotation/darkening and blank images.

In-app Codex Debug tab checks: sample upload, file upload, image paste via virtual clipboard, rotation, crop application, cancellation, blank-image zero results, JP and combined JP/EN analysis, pre-confirmation disabled price action, exact selected-card URL, loaded candidate images. Desktop 1280px and mobile 390px were checked; no horizontal overflow was found at 390px. A full-page screenshot was unavailable; viewport screenshots were inspected instead.

This is not a measured all-card accuracy result or a test of arbitrary marketplace photos. Next validation needs labeled real screenshots across normal/parallel/manga/event cards, PSA cases, glare and partial occlusion before an extension is built.

## Changed Files

- `src/main.jsx`: dev-only route and lazy load.
- `src/CardRecognitionLab.jsx`, `src/card-recognition-lab.css`: local input and candidate UI.
- `src/lib/card-recognition-lab.js`: orchestration, approved catalog identity checks and confirmation gate.
- `scripts/testCardRecognitionLab.mjs`: focused safeguards.
