create extension if not exists pgcrypto;

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_push_subscriptions enable row level security;

create index if not exists idx_user_push_subscriptions_user_id
  on public.user_push_subscriptions (user_id, active);
