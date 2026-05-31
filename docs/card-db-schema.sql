create table if not exists public.card_series (
  id text primary key,
  locale text not null check (locale in ('KR', 'JP')),
  base_series_id text not null,
  name text not null,
  name_en text,
  kind_ko text,
  kind_en text,
  official_series_keyword text,
  official_url text,
  description text,
  release_order integer not null default 0,
  card_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_series_locale_order_idx
  on public.card_series (locale, release_order, base_series_id);

create table if not exists public.cards (
  id text primary key,
  locale text not null check (locale in ('KR', 'JP')),
  card_no text not null,
  card_no_base text not null,
  variant_key text not null default 'base',
  series_id text not null references public.card_series(id),
  base_series_id text not null,
  origin_series_id text references public.card_series(id),
  origin_base_series_id text,
  name text not null,
  name_en text,
  name_normalized text not null,
  search_text_normalized text not null default '',
  rarity text,
  category text,
  category_ko text,
  color text,
  color_ko text,
  cost text,
  power text,
  counter text,
  attribute text,
  attribute_ko text,
  type text,
  effect text,
  image_url text,
  official_url text,
  image_status text not null default 'unknown' check (image_status in ('unknown', 'ok', 'missing', 'failed')),
  image_checked_at timestamptz,
  market_code text not null,
  is_reprint boolean not null default false,
  sort_order integer not null default 0,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_locale_series_sort_idx
  on public.cards (locale, series_id, sort_order, card_no);

create index if not exists cards_locale_card_no_base_idx
  on public.cards (locale, card_no_base);

create index if not exists cards_locale_name_normalized_idx
  on public.cards (locale, name_normalized);

create index if not exists cards_locale_search_text_normalized_idx
  on public.cards (locale, search_text_normalized);

create index if not exists cards_market_code_idx
  on public.cards (market_code);

create table if not exists public.card_search_aliases (
  id bigserial primary key,
  card_id text not null references public.cards(id) on delete cascade,
  locale text not null check (locale in ('KR', 'JP')),
  alias text not null,
  alias_normalized text not null,
  source text not null default 'generated',
  created_at timestamptz not null default now()
);

create index if not exists card_search_aliases_locale_alias_idx
  on public.card_search_aliases (locale, alias_normalized);

create index if not exists card_search_aliases_card_id_idx
  on public.card_search_aliases (card_id);
