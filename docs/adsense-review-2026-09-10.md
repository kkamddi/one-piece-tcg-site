# AdSense review: 2026-09-10

## Observed evidence

- User screenshot: low-value content, ads.txt not found; last update 2026-08-24. This is not proof of a fresh review of the September site.
- Both https://optcgkorea.com/ads.txt and https://www.optcgkorea.com/ads.txt return 200 text/plain after the apex redirects to www.
- Publisher line matches the site's AdSense meta tag: pub-5802425633398708. The publisher ID in the signed-in AdSense account still needs comparison; it was not shown in the screenshot.
- robots.txt does not disallow Googlebot or Mediapartners-Google. An ordinary HTTP check cannot prove that Cloudflare permits every real Google crawler request.
- The collection overview had explanatory initial HTML, but React replaced it with mostly a manga catalog. This content mismatch is an independently verified issue, not a proven explanation of Google's rejection.

## Local improvement

- Share the collection editorial between React and initial HTML so users receive the same substantive article after loading.
- Add collection boundaries, four collecting approaches, an OP01-120 version-comparison example, random-pack versus single-card decisions, price-comparison conditions and a purchase checklist.
- Link official card/product evidence beside the relevant claims. Editorial advice is distinguished from official facts; no invented print runs, prices, opening odds or returns.
- Keep the existing card lists and user interface. No mass-generated pages, hidden review-only text, new ad placements or crawler-specific content.

## Before requesting another review

1. Review the local article for collecting terminology and usefulness, then deploy through the normal synchronized-main workflow.
2. Compare the publisher ID in AdSense with ads.txt. Request its update/check from the site's AdSense detail screen where available.
3. Confirm the deployed article remains visible after JavaScript loads on mobile and desktop; retain crawl access and functioning links.
4. Improve the next core article with similarly verifiable examples: Single versus PSA10 / transaction date reading, then promo supplement versus application distribution. Do not manufacture purchase experience or article counts for approval.
5. Submit for review only after the changes are live. Approval is Google's decision and is not guaranteed by these fixes.

## References

- https://support.google.com/adsense/answer/12176698?hl=ko
- https://support.google.com/adsense/answer/12171612
- https://support.google.com/adsense/answer/12170222
- https://www.onepiece-cardgame.com/products/boosters/prb01.php
- https://asia-en.onepiece-cardgame.com/cardlist/?search=true&series=556101
