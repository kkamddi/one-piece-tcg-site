# Card DB Redesign Plan

This plan moves card data from bundled static JSON to Supabase-backed APIs while keeping the current user-facing features intact.

## Goals

- Keep existing account data compatible.
- Support only Korean and Japanese card catalogs.
- Keep card images loading reliably through Cloudflare cache.
- Avoid loading the full card catalog on initial page load.
- Keep card price lookup connected by card number.
- Keep collection value, owned cards, wishlist, deck simulator, and card modal behavior working.

## Non-Goals For First Migration

- English card catalog.
- Korean keyword search over Japanese cards.
- Storing image binaries in Supabase.
- Reworking the UI before the data/API layer is stable.

## Current State

- Card data is bundled in `src/data/cards.json` and emitted into a large client asset.
- Series data is bundled in `src/data/series.json`.
- Card images are stored as official image URLs in each card object.
- Cloudflare has `/api/card-image` proxy/caching for official image URLs.
- User state depends on stable `card.id` values:
  - `ownedCardIds`
  - `wishlistCardIds`
  - `ownedCardGrades`
  - `valuationCardGrades`
  - `valuationMarketItems`
  - `deckEntries`
  - `leaderCardId`

## Required Compatibility Rule

`card.id` must not change during the migration.

Examples:

```txt
KR::OP05-119
KR::OP05-119_p1
JP::OP05-119
JP::OP05-119_p1
JP::OP05-119_r1
```

If an official card source changes variant identifiers, the importer must preserve the old ID when possible. New variant IDs can be added, but existing IDs should not be renamed.

## Data Flow

```txt
Official KR/JP card sites
  -> internal sync/import script
  -> Supabase tables
  -> Cloudflare Functions API
  -> React frontend
  -> /api/card-image proxy
  -> Cloudflare image cache
```

## Tables

### `card_series`

One row per language-specific series.

Primary key: `id`

Examples:

```txt
KR-OP05
JP-OP05
KR-PROMO
JP-PROMO
```

### `cards`

One row per card print/variant.

Primary key: `id`

The `card_no_base` column is used for market lookup. For variants such as `OP05-119_p1`, `card_no_base` is `OP05-119`.

### `card_search_aliases`

Optional table for future aliases. For the first migration, keep search simple:

- KR searches Korean fields.
- JP searches Japanese fields.
- Unicode normalization handles full-width/half-width differences.

This table is kept in the design so aliases can be added later without changing the main card schema.

## API Contract

### List Cards

```txt
GET /api/cards?locale=JP&series=JP-OP15&page=1&pageSize=60
GET /api/cards?locale=JP&scope=all&page=1&pageSize=60
```

Response:

```json
{
  "cards": [],
  "page": 1,
  "pageSize": 60,
  "total": 152,
  "hasMore": true
}
```

### Search Cards

```txt
GET /api/cards/search?locale=JP&q=ルフィ&scope=all&page=1&pageSize=60
GET /api/cards/search?locale=JP&q=ルフィ&scope=series&series=JP-OP15&page=1&pageSize=60
```

Response shape is the same as list cards.

### Card By ID

```txt
GET /api/cards/JP%3A%3AOP05-119
```

Response:

```json
{
  "card": {}
}
```

### Cards By IDs

Used for account-owned cards and collection value cards without loading the full catalog.

```txt
POST /api/cards/by-ids
{
  "ids": ["JP::OP05-119", "KR::OP01-001"]
}
```

Response:

```json
{
  "cards": []
}
```

## Card 도감 Behavior

### Current Series

Query:

```txt
locale + selected series
```

Initial load:

```txt
pageSize 40-60
```

### All Series

All series should not eagerly show every card. It exists mainly for cross-series search.

Initial behavior:

- show a small first page only, or
- show an empty state encouraging search.

Preferred first implementation:

```txt
All Series + no search -> first 60 cards with More button
All Series + search -> paginated search results
```

This keeps the UI predictable and avoids a sudden empty page.

## Search Rules

First migration:

- Korean catalog: Korean search only.
- Japanese catalog: Japanese search only.
- Search fields:
  - card number
  - card name
  - type/feature
  - effect text

Normalization:

- `NFKC`
- lowercase
- remove spaces
- normalize middle dot differences where needed
- preserve Japanese text search behavior

Example expected consistency:

```txt
モンキー・Ｄ・ルフィ
モンキー・D・ルフィ
ルフィ
```

These should not split due only to full-width/half-width `D`.

## Market Price Linkage

Card price lookup remains based on base card number.

```txt
cards.card_no_base -> market code
```

Examples:

```txt
JP::OP05-119      -> OP05-119
JP::OP05-119_p1   -> OP05-119
KR::OP05-119      -> OP05-119
```

Collection value records should keep both:

- `card_id`
- `market_code`

This protects user collection value if a card has variants but shares the same market code.

## Image Strategy

Do not store image binaries in Supabase for the first migration.

Store:

```txt
cards.image_url
```

Render:

```txt
/api/card-image?src=<encoded official image URL>
```

Cloudflare should cache the proxied image response.

Recommended columns for observability:

```txt
image_status
image_checked_at
```

Valid statuses:

```txt
unknown
ok
missing
failed
```

## Migration Phases

### Phase 1: Internal Only

- Define Supabase schema.
- Convert existing JSON data into database seed files.
- Validate:
  - duplicate IDs
  - missing image URLs
  - invalid official URLs
  - missing series references
  - invalid market base codes

### Phase 2: Read API

- Add DB-backed Cloudflare API.
- Keep JSON fallback behind a feature flag.
- Verify API output matches current frontend expectations.

### Phase 3: Frontend Integration

- Replace bundled full-card imports with paginated API reads.
- Keep current UI behavior.
- Verify:
  - current series
  - all series
  - search
  - card modal
  - owned/wishlist
  - collection value
  - market page linkage

### Phase 4: Preview Testing

- Deploy to preview URL only.
- Test desktop and mobile.
- Compare with production before switching main domain.

### Phase 5: Production Deploy

- Deploy only after account state and card image checks pass.

## Release Gate

Do not deploy unless all are true:

- Existing `ownedCardIds` still resolve through `/api/cards/by-ids`.
- Existing valuation cards still resolve to images and market codes.
- Current series loads without full catalog download.
- All series does not freeze.
- JP search works with Japanese terms.
- KR search works with Korean terms.
- No image regression above accepted threshold.
