create table if not exists public.deck_leader_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  region text not null check (region in ('KR', 'JP', 'EN')),
  card_no text not null check (char_length(card_no) between 1 and 80),
  nickname text not null check (char_length(nickname) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  content text not null check (char_length(content) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, region, card_no)
);

create table if not exists public.deck_leader_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  region text not null check (region in ('KR', 'JP', 'EN')),
  card_no text not null check (char_length(card_no) between 1 and 80),
  selected_at timestamptz not null default now(),
  primary key (user_id, region)
);

create index if not exists deck_leader_reviews_region_card_idx
  on public.deck_leader_reviews (region, card_no, updated_at desc);
create index if not exists deck_leader_usage_region_card_idx
  on public.deck_leader_usage (region, card_no, selected_at desc);

alter table public.deck_leader_reviews enable row level security;
alter table public.deck_leader_usage enable row level security;

revoke all on public.deck_leader_reviews from anon, authenticated;
revoke all on public.deck_leader_usage from anon, authenticated;

grant select, insert, update, delete on public.deck_leader_reviews to service_role;
grant select, insert, update, delete on public.deck_leader_usage to service_role;
