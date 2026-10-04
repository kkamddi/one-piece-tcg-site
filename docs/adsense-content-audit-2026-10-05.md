# AdSense content audit: 2026-10-05

Read-only check of production (https://www.optcgkorea.com) after repeated "low-value content" rejections. No code changed. Google's actual reasoning is not visible; the items below are measured risk signals, not a confirmed cause.

## Settings that are fine

- ads.txt, the `google-adsense-account` meta tag and the ad script all use `pub-1064116148043091` (changed 2026-09-18 for the Pageworks account).
- robots.txt allows Googlebot and Mediapartners-Google. Every sitemap URL returns 200 without `noindex`.

## Findings

### 1. Most indexed pages are template-generated (main risk)

`sitemap.xml` has 155 URLs (`sitemap-jp.xml` has 99 more).

| Group | Pages | Initial HTML text | Shared wording between pages |
| --- | --- | --- | --- |
| `/guides/series/*` | 88 | 823–1,005 chars | 74% of word 3-grams (numbers normalized) |
| `/guide/box-recommendation/series/*` | 24 | ~620 chars | 93% |
| Everything else | 43 | 180–2,960 chars | — |

112 of 155 pages (72%) follow one sentence template with the series name, dates and card counts swapped, e.g. "한글판 부스터 팩으로 등록된 {시리즈}의 상품 정보와 수록 카드를 한곳에서 확인하는 페이지입니다." This matches Google's description of scaled, low-value content.

### 2. Original articles are short

Measured on the rendered page (Aside, Card Pone profile, `main` innerText after JavaScript):

| Page | Rendered `main` text |
| --- | --- |
| `/` | 944 |
| `/guide/collection` | 915 |
| `/news/guide` | 650 |
| `/guide/card-price` | 1,485 |
| `/guides/series/krop01` | 731 |
| `/guide/box-recommendation/series/op-02` | 1,225 |
| `/cards/jp` | 4,040 (card list) |

Most guide pages render roughly 700–1,500 characters, which is about one screen of Korean text. Tool pages (calculators, simulators, scanner) are useful but carry little text and do not count as articles.

### 3. Card and price detail pages are not in the sitemap

Thousands of catalog/price pages are reachable by links but are not listed. They are data pages built from SNKRDUNK prices and catalog fields, so adding them would increase the thin-page share rather than reduce it.

## Recommendations

1. Template pages: keep them for users but take them out of the sitemap and mark them `noindex` until each one has real, page-specific content. Then rewrite the most-viewed ones (latest boosters) by hand. Needs user approval because it affects search traffic.
2. Write 10–15 original articles of about 2,000–4,000 Korean characters each in the 정보 tab, using the site's own price and catalog data as evidence. Examples: reading Single vs PSA10 and the latest-trade-day median; telling parallels, reprints and promos apart for the same card number; per-booster key cards and price movement; counterfeit checklist; storage and sleeves.
3. Expand the existing core guides (`/news/guide`, `/guide/card-price`, `/guide/collection`) to the same depth.
4. Follow AGENTS.md: no mass-generated text, no crawler-only or hidden text, no invented experiences or numbers. Request a new review only after the changes are live; approval is not guaranteed.

## Method

- Initial HTML: fetched every `sitemap.xml` URL, removed scripts and styles, and counted the remaining body text.
- Template overlap: average pairwise share of number-normalized word 3-grams within each group.
- Rendered text: one diagnostic tab in the existing Card Pone Aside window (profile path verified, closed afterwards; tab count 4 → 5 → 4).
