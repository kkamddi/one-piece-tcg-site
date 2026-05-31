# OPTCG Korea

OPTCG Korea is an unofficial One Piece Card Game archive, market price, and collection management web service.

Live site: https://www.optcgkorea.com

## Features

- Card archive for Korean and Japanese card data
- Series, rarity, ownership, and wishlist filters
- Card detail modal with official information and market price navigation
- SNKRDUNK-based market price lookup and curated product mappings
- Portfolio value tracking for A grade and PSA10 cards
- User collection and wishlist storage through Supabase
- Update notices, shop information, and responsive mobile/desktop UI

## Tech Stack

- React
- Vite
- Cloudflare Pages
- Cloudflare Pages Functions
- Supabase

## Project Structure

- `src/`: frontend application and UI logic
- `src/data/`: public card, series, market, and mapping data
- `functions/`: Cloudflare Pages Functions API routes
- `public/`: static assets
- `scripts/`: utility scripts for data and maintenance tasks
- `docs/`: SQL and service notes

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

Use project or platform secrets for real values. Do not commit production secrets.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_COMMUNITY_TABLE=
```

Cloudflare Pages production variables are managed outside this repository.

## Data and Rights Notice

This repository may include publicly structured metadata used by the OPTCG Korea service. ONE PIECE CARD GAME names, card images, card text, logos, characters, trademarks, and related intellectual property belong to their respective rights holders.

OPTCG Korea is an unofficial fan service and is not affiliated with, approved by, sponsored by, or endorsed by BANDAI, Shueisha, Toei Animation, or related rights holders.

The MIT license in this repository applies only to the original source code and project files authored for this service. It does not grant any rights to third-party card images, names, text, logos, trademarks, or other protected materials.

## License

Code in this repository is released under the MIT License. See [LICENSE](LICENSE).
