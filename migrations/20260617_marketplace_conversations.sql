-- Marketplace conversation and notification tables.
-- Run this after 20260617_marketplace.sql.

create extension if not exists pgcrypto;

create table if not exists public.market_conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  seller_user_id uuid not null,
  buyer_user_id uuid not null,
  status text not null default 'open' check (status in ('open', 'closed', 'deleted')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_user_id)
);

alter table public.market_conversations enable row level security;

create index if not exists idx_market_conversations_seller_user_id
  on public.market_conversations (seller_user_id, last_message_at desc);

create index if not exists idx_market_conversations_buyer_user_id
  on public.market_conversations (buyer_user_id, last_message_at desc);

create table if not exists public.market_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.market_conversations(id) on delete cascade,
  sender_user_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.market_messages enable row level security;

create index if not exists idx_market_messages_conversation_id
  on public.market_messages (conversation_id, created_at asc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  link_url text,
  payload_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_notifications enable row level security;

create index if not exists idx_user_notifications_user_id
  on public.user_notifications (user_id, created_at desc);

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
