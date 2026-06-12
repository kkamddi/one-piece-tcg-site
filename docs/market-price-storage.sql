create extension if not exists pgcrypto;

create table if not exists public.market_collection_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'snkrdunk',
  collector_version text,
  schedule_interval text not null default '12h',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  target_count integer not null default 0,
  ok_count integer not null default 0,
  locked_count integer not null default 0,
  with_history_count integer not null default 0,
  with_chart_count integer not null default 0,
  error_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists market_collection_runs_source_started_idx
  on public.market_collection_runs (source, started_at desc);

create table if not exists public.market_products (
  source text not null default 'snkrdunk',
  apparel_id bigint not null,
  locale text not null default 'JP',
  code text not null,
  name text,
  set_name text,
  source_url text,
  preview_image_url text,
  latest_page_title text,
  latest_min_price_amount numeric,
  latest_min_price_currency text,
  latest_listing_count integer,
  latest_captured_at timestamptz,
  is_active boolean not null default true,
  raw_market_card jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source, apparel_id)
);

create index if not exists market_products_locale_code_idx
  on public.market_products (locale, code);

create index if not exists market_products_latest_captured_idx
  on public.market_products (latest_captured_at desc);

create table if not exists public.market_price_snapshots (
  id bigserial primary key,
  run_id uuid references public.market_collection_runs(id) on delete set null,
  source text not null default 'snkrdunk',
  apparel_id bigint not null,
  locale text not null default 'JP',
  code text not null,
  captured_at timestamptz not null,
  ok boolean not null default false,
  locked boolean not null default false,
  has_history boolean not null default false,
  has_chart boolean not null default false,
  page_title text,
  min_price_amount numeric,
  min_price_currency text,
  min_price_text text,
  listing_count integer,
  elapsed_ms integer,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, source, apparel_id)
);

create index if not exists market_price_snapshots_product_captured_idx
  on public.market_price_snapshots (source, apparel_id, captured_at desc);

create index if not exists market_price_snapshots_code_captured_idx
  on public.market_price_snapshots (locale, code, captured_at desc);

create table if not exists public.market_recent_trades (
  id bigserial primary key,
  source text not null default 'snkrdunk',
  apparel_id bigint not null,
  locale text not null default 'JP',
  code text not null,
  condition text,
  trade_date_text text not null,
  price_amount numeric,
  price_currency text,
  price_text text,
  first_seen_run_id uuid references public.market_collection_runs(id) on delete set null,
  last_seen_run_id uuid references public.market_collection_runs(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  unique (source, apparel_id, trade_date_text, condition, price_amount, price_currency)
);

create index if not exists market_recent_trades_product_seen_idx
  on public.market_recent_trades (source, apparel_id, last_seen_at desc);

create index if not exists market_recent_trades_code_seen_idx
  on public.market_recent_trades (locale, code, last_seen_at desc);

create table if not exists public.market_chart_snapshots (
  id bigserial primary key,
  run_id uuid references public.market_collection_runs(id) on delete set null,
  source text not null default 'snkrdunk',
  apparel_id bigint not null,
  locale text not null default 'JP',
  code text not null,
  captured_at timestamptz not null,
  chart_type text,
  svg_path text,
  x_labels jsonb not null default '[]'::jsonb,
  y_labels jsonb not null default '[]'::jsonb,
  raw_chart jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, source, apparel_id)
);

create index if not exists market_chart_snapshots_product_captured_idx
  on public.market_chart_snapshots (source, apparel_id, captured_at desc);

create table if not exists public.market_chart_points (
  id bigserial primary key,
  run_id uuid references public.market_collection_runs(id) on delete set null,
  source text not null default 'snkrdunk',
  apparel_id bigint not null,
  locale text not null default 'JP',
  code text not null,
  condition_key text not null,
  point_date timestamptz not null,
  price_amount numeric,
  price_currency text not null default 'JPY',
  raw_x numeric,
  raw_y numeric,
  raw_payload jsonb,
  unique (source, apparel_id, condition_key, point_date, price_amount)
);

create index if not exists market_chart_points_product_date_idx
  on public.market_chart_points (source, apparel_id, condition_key, point_date);

create index if not exists market_chart_points_code_date_idx
  on public.market_chart_points (locale, code, condition_key, point_date);

create or replace view public.market_product_latest as
select distinct on (source, apparel_id)
  source,
  apparel_id,
  locale,
  code,
  page_title,
  min_price_amount,
  min_price_currency,
  min_price_text,
  listing_count,
  has_history,
  has_chart,
  captured_at,
  raw_payload
from public.market_price_snapshots
order by source, apparel_id, captured_at desc;

alter table public.market_collection_runs enable row level security;
alter table public.market_products enable row level security;
alter table public.market_price_snapshots enable row level security;
alter table public.market_recent_trades enable row level security;
alter table public.market_chart_snapshots enable row level security;
alter table public.market_chart_points enable row level security;

drop policy if exists "market_collection_runs_public_read" on public.market_collection_runs;
create policy "market_collection_runs_public_read"
  on public.market_collection_runs for select
  using (true);

drop policy if exists "market_products_public_read" on public.market_products;
create policy "market_products_public_read"
  on public.market_products for select
  using (true);

drop policy if exists "market_price_snapshots_public_read" on public.market_price_snapshots;
create policy "market_price_snapshots_public_read"
  on public.market_price_snapshots for select
  using (true);

drop policy if exists "market_recent_trades_public_read" on public.market_recent_trades;
create policy "market_recent_trades_public_read"
  on public.market_recent_trades for select
  using (true);

drop policy if exists "market_chart_snapshots_public_read" on public.market_chart_snapshots;
create policy "market_chart_snapshots_public_read"
  on public.market_chart_snapshots for select
  using (true);

drop policy if exists "market_chart_points_public_read" on public.market_chart_points;
create policy "market_chart_points_public_read"
  on public.market_chart_points for select
  using (true);

notify pgrst, 'reload schema';
