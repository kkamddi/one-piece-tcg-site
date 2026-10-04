# Card-show production deployment — 2026-09-29

- User explicitly approved production deployment of the dedicated card-show page.
- Production commit: `74c12b8da5464853d46946e21444dc6087b50ada`, parent `fe13c00419d24e2b2f0e51b79cc03d039c0f22d2`. Applied only the card-show UI delta from archive `07abaa0` and its curated-data dependency; preserved current main catalog/topics. No force push or history rewrite. The existing working branch and normal index were retained.
- Box portfolio changes and earlier calendar event integration were not included. The secondary calendar button opens the existing production calendar.
- Production workflow succeeded: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36549383246
- Secret scan succeeded: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36549383359
- Cloudflare deployment: https://7c976ce3.optcgkorea-static.pages.dev
- Local page/collector tests: 17 passed. CI auth/catalog checks and full production build passed. D1 revisions were unchanged and no import was performed.
- Homepage, `/news?section=cardshows`, and the Seoul Card Festa detail URL returned HTTP 200. The public domain and deployment served identical `card-pone-app-UNZUTqBs.js` assets containing the new route and curated event.
- Public entry: https://www.optcgkorea.com/news?section=cardshows
- Actual browser layout and interactive production navigation remain unverified. HTTP/asset checks are not visual validation. No authentication, environment, DNS, or collector settings changed.
- This record supersedes the local-only deployment status in `card-shows-page.md`; its remaining visual-review and collector-publication limitations still apply.
