create extension if not exists pgcrypto;

create table if not exists public.deck_game_environments (
  id uuid primary key default gen_random_uuid(),
  environment_key text not null unique check (char_length(environment_key) between 3 and 80),
  region text not null check (region in ('KR', 'JP', 'EN')),
  format text not null default 'STANDARD' check (format in ('STANDARD', 'EXTRA')),
  name text not null check (char_length(name) between 1 and 120),
  rules_version text,
  effective_from date,
  effective_to date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.deck_leaders (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('KR', 'JP', 'EN')),
  card_id text not null check (char_length(card_id) between 1 and 160),
  card_no text not null check (char_length(card_no) between 1 and 80),
  card_name text not null check (char_length(card_name) between 1 and 200),
  colors text[] not null default '{}',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region, card_id),
  unique (region, card_no)
);

create table if not exists public.deck_archetypes (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.deck_game_environments(id) on delete cascade,
  leader_id uuid not null references public.deck_leaders(id) on delete restrict,
  slug text not null check (char_length(slug) between 1 and 100),
  nickname text not null check (char_length(nickname) between 1 and 120),
  summary text,
  play_style text,
  difficulty smallint check (difficulty between 1 and 5),
  offense smallint check (offense between 1 and 5),
  defense smallint check (defense between 1 and 5),
  control smallint check (control between 1 and 5),
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  recommended_for text[] not null default '{}',
  starter_based boolean not null default false,
  budget_min_krw integer check (budget_min_krw is null or budget_min_krw >= 0),
  budget_max_krw integer check (budget_max_krw is null or budget_max_krw >= 0),
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment_id, slug),
  check (
    budget_max_krw is null
    or budget_min_krw is null
    or budget_max_krw >= budget_min_krw
  )
);

create table if not exists public.deck_templates (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.deck_archetypes(id) on delete cascade,
  template_type text not null check (
    template_type in ('STARTER', 'BEGINNER', 'BUDGET', 'COMPETITIVE', 'OFFICIAL', 'TOURNAMENT')
  ),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (archetype_id, template_type, title)
);

create table if not exists public.deck_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.deck_templates(id) on delete cascade,
  environment_id uuid not null references public.deck_game_environments(id) on delete restrict,
  version_label text not null check (char_length(version_label) between 1 and 100),
  notes text,
  published_at timestamptz,
  is_current boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version_label)
);

create table if not exists public.deck_template_cards (
  version_id uuid not null references public.deck_template_versions(id) on delete cascade,
  card_id text not null check (char_length(card_id) between 1 and 160),
  card_no text not null check (char_length(card_no) between 1 and 80),
  card_name text,
  quantity smallint not null check (quantity between 1 and 4),
  role_tags text[] not null default '{}',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (version_id, card_id)
);

create table if not exists public.deck_legality_rules (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.deck_game_environments(id) on delete cascade,
  card_no text not null check (char_length(card_no) between 1 and 80),
  restriction_type text not null check (restriction_type in ('BANNED', 'RESTRICTED')),
  max_copies smallint not null check (max_copies between 0 and 3),
  effective_from date not null,
  effective_to date,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment_id, card_no, effective_from),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (restriction_type = 'BANNED' and max_copies = 0)
    or (restriction_type = 'RESTRICTED' and max_copies between 1 and 3)
  )
);

create index if not exists deck_game_environments_region_active_idx
  on public.deck_game_environments (region, is_active, effective_from desc);
create index if not exists deck_leaders_region_card_no_idx
  on public.deck_leaders (region, card_no);
create index if not exists deck_archetypes_environment_leader_idx
  on public.deck_archetypes (environment_id, leader_id);
create index if not exists deck_templates_archetype_type_idx
  on public.deck_templates (archetype_id, template_type);
create index if not exists deck_template_versions_template_current_idx
  on public.deck_template_versions (template_id, is_current, published_at desc);
create index if not exists deck_legality_rules_environment_card_idx
  on public.deck_legality_rules (environment_id, card_no, effective_from desc);

alter table public.deck_game_environments enable row level security;
alter table public.deck_leaders enable row level security;
alter table public.deck_archetypes enable row level security;
alter table public.deck_templates enable row level security;
alter table public.deck_template_versions enable row level security;
alter table public.deck_template_cards enable row level security;
alter table public.deck_legality_rules enable row level security;

revoke all on public.deck_game_environments from anon, authenticated;
revoke all on public.deck_leaders from anon, authenticated;
revoke all on public.deck_archetypes from anon, authenticated;
revoke all on public.deck_templates from anon, authenticated;
revoke all on public.deck_template_versions from anon, authenticated;
revoke all on public.deck_template_cards from anon, authenticated;
revoke all on public.deck_legality_rules from anon, authenticated;

grant select, insert, update, delete on public.deck_game_environments to service_role;
grant select, insert, update, delete on public.deck_leaders to service_role;
grant select, insert, update, delete on public.deck_archetypes to service_role;
grant select, insert, update, delete on public.deck_templates to service_role;
grant select, insert, update, delete on public.deck_template_versions to service_role;
grant select, insert, update, delete on public.deck_template_cards to service_role;
grant select, insert, update, delete on public.deck_legality_rules to service_role;
