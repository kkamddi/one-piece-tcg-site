# Card Pone Scan (local prototype)

## Membership gate — 0.1.16

All signed-in, non-anonymous Card Pone members are eligible; no paid tier is required. Click the extension's Card Pone login button, sign in in the newly created website tab, then click connection check. Keep that tab open. Existing unrelated tabs are not searched or read.

The extension reads only the current access token from that tab's isolated top frame and sends it to `/api/extension-member`; the server verifies it with Supabase `auth.getUser`. Only the tab ID is kept in `chrome.storage.session`. No password or refresh token is exported, and no access token is persisted or logged. Authentication responses are private/no-store. Anonymous, missing, expired, unavailable and malformed authentication fails closed. Membership is checked before capture, before/after recognition and price requests, on panel focus and every 30 seconds. A changed account discards in-flight results.

Deploy the new site API before distributing this extension; until then membership verification fails closed. Update store authentication-data disclosures and reviewer instructions before submission. No production deployment or store submission is implied by this source update.

Public website APIs/reference files remain public. This gate restricts the official new extension, not old versions, modified source, public data access, or the developer-only loopback preview. Local recognition cannot provide tamper-proof access control. No DB schema, provider configuration, environment variable or paid feature changes are required.

The earlier no-credentials statement below describes versions before 0.1.16; authentication now follows this section. Captured images remain local.

## Build and Install

Run `node scripts/buildCardPoneExtension.mjs` from the site repository. This builds only the extension, not the website. The first build downloads the English OCR model from the versioned official Tesseract data repository. Dependencies already installed in this repository are reused.

In Chrome, open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `artifacts/card-pone-extension`. Pin Card Pone Scan. On an ordinary website, click its toolbar icon, then Scan and drag across one card. Escape or Cancel dismisses selection; selection expires after 20 seconds.

The side panel contains the Card Pone logo, Scan, and candidate results. The first candidate has a large image; each result has catalog and price links. Clicking a candidate's price link is explicit selection of that market product. There is no automatic top-result navigation. If scanning a different tab is denied, invoke the toolbar icon on that tab to grant temporary activeTab access.

## Scope

- Real Manifest V3 side-panel extension; no store submission.
- Uses existing JP/EN One Piece reference snapshots. KR and Riftbound recognition are not supported yet.
- Run `node scripts/auditCardScanCoverage.mjs` to compare local product and image-index coverage; `--strict` fails on any missing reference. This is not a live-market completeness check.
- Since 0.1.5, each scan checks Card Pone's data manifest, downloads changed reference JSON on demand, verifies SHA-256 hashes, and caches files locally. Only the Card Pone host has persistent data access. Captured images, credentials and visited page URLs are never sent. Remote code is prohibited. If the manifest/catalog cannot be loaded, recognition uses bundled references. Update failure can therefore leave newer cards unavailable.
- The `Card scan reference refresh` workflow exports the public JP/EN catalog from the existing authenticated collector, updates image references daily, commits only public reference data, and delegates publication to the production deploy workflow. Missing source images remain excluded. The initial extension update to 0.1.5 is required; later data updates do not require reinstallation.
- Artwork-verified products with nonstandard codes (such as DON cards) open prices by product ID without inventing a catalog route. Missing/placeholder images and same-art printings remain recognition limitations.
- Price actions are restricted to JP/EN. The recognition support link opens an email draft to optkr26@gmail.com with the extension version and up to three candidate codes/locales. It never attaches a capture or visited URL and never sends automatically.
- Since 0.1.8, visible candidates fetch the latest SNKRDUNK trading-day median by exact product ID from `summary=trade-latest`. Single and PSA10 retain separate trade dates. Prices display KRW using the website's fixed 9.4 KRW/JPY conversion. Listing-floor values never fill missing trades; request failures offer retry. Chart/trade detail links remain on the website.
- OCR plus geometric artwork matching, not a guaranteed exact-print classifier. Same-art reprints and languages may produce multiple candidates.
- Price links use the recognized market product ID, including products without an approved catalog mapping. Catalog links open an exact printing only for a unique approved mapping; otherwise they open the website's card-number search. No mapping is inferred from a shared card number. Old snapshot prices are never displayed as live values. Current prices are viewed on Card Pone.
- Captures stay in memory, are cropped locally, and are not uploaded or persisted. The screenshot temporarily includes the visible viewport; only the selected rectangle is analyzed.
- No account credentials, DB writes from the extension, arbitrary-site persistent permissions, analytics, or remote executable code.
- Reference images in results may be loaded from existing catalog image hosts. These requests contain no captured image and suppress the page referrer.
- OpenCV uses an isolated sandbox frame and private MessageChannel because its generated bindings require dynamic compilation. The frame has no extension APIs or network access. OCR workers and model data are bundled locally.
- Prototype intentionally ships the existing large image index. Package-size reduction and reference update delivery remain before store release.

## Checks

`node --test scripts/testCardPoneExtension.mjs scripts/testCardPoneResultLinks.mjs scripts/testCardRecognitionLab.mjs scripts/testCardImageMatch.mjs scripts/testCardScanner.mjs`

Local panel preview: run `node scripts/previewCardPoneExtension.mjs`, then open `http://127.0.0.1:4183/`. This dedicated loopback server applies the manifest's content security policies, including sandbox isolation. In this preview only, Scan opens an image picker instead of accessing a browser tab. It exercises the same bundled recognition assets and result UI, but does not prove Chrome permissions or tab capture. Those require loading the unpacked extension in Chrome.

Manual Chrome checks: ordinary website selection, Escape/timeout, switched tab, restricted page, high-DPI crop, no-match image, multiple printings, confirmed price link, and repeat scans. Existing user tabs must not be automated without permission.

API references: https://developer.chrome.com/docs/extensions/reference/api/sidePanel and https://developer.chrome.com/docs/extensions/reference/manifest/sandbox
