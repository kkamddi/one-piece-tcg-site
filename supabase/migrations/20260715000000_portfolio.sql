create extension if not exists pgcrypto;

create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apparel_id bigint not null check (apparel_id > 0),
  card_id text,
  code text not null,
  name text,
  set_name text,
  image_url text,
  source_url text,
  grade text not null check (grade in ('a', 'psa10')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, apparel_id, grade),
  unique (id, user_id)
);

create table if not exists public.portfolio_purchases (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'later' check (mode in ('manual', 'estimate', 'later')),
  quantity integer not null default 1 check (quantity between 1 and 9999),
  purchase_date date,
  original_currency text not null default 'KRW' check (original_currency in ('KRW', 'JPY', 'USD')),
  original_unit_price numeric(18, 2) not null default 0 check (original_unit_price >= 0),
  unit_price_jpy bigint not null default 0 check (unit_price_jpy >= 0),
  reference_date date,
  reference_source text check (reference_source is null or reference_source in ('listing', 'trade')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (holding_id, user_id)
    references public.portfolio_holdings(id, user_id)
    on delete cascade
);

create index if not exists idx_portfolio_holdings_user
  on public.portfolio_holdings (user_id, updated_at desc);

create index if not exists idx_portfolio_purchases_user_holding
  on public.portfolio_purchases (user_id, holding_id, created_at asc);

alter table public.portfolio_holdings enable row level security;
alter table public.portfolio_purchases enable row level security;

drop policy if exists portfolio_holdings_select_own on public.portfolio_holdings;
create policy portfolio_holdings_select_own on public.portfolio_holdings for select using (auth.uid() = user_id);
drop policy if exists portfolio_holdings_insert_own on public.portfolio_holdings;
create policy portfolio_holdings_insert_own on public.portfolio_holdings for insert with check (auth.uid() = user_id);
drop policy if exists portfolio_holdings_update_own on public.portfolio_holdings;
create policy portfolio_holdings_update_own on public.portfolio_holdings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists portfolio_holdings_delete_own on public.portfolio_holdings;
create policy portfolio_holdings_delete_own on public.portfolio_holdings for delete using (auth.uid() = user_id);

drop policy if exists portfolio_purchases_select_own on public.portfolio_purchases;
create policy portfolio_purchases_select_own on public.portfolio_purchases for select using (auth.uid() = user_id);
drop policy if exists portfolio_purchases_insert_own on public.portfolio_purchases;
create policy portfolio_purchases_insert_own on public.portfolio_purchases for insert with check (auth.uid() = user_id);
drop policy if exists portfolio_purchases_update_own on public.portfolio_purchases;
create policy portfolio_purchases_update_own on public.portfolio_purchases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists portfolio_purchases_delete_own on public.portfolio_purchases;
create policy portfolio_purchases_delete_own on public.portfolio_purchases for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.portfolio_holdings to authenticated;
grant select, insert, update, delete on public.portfolio_purchases to authenticated;
