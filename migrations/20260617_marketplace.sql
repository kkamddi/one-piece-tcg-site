-- Marketplace MVP tables for user-to-user trade listings.
-- Run this in Supabase SQL Editor after review.

create extension if not exists pgcrypto;

create table if not exists public.market_seller_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cafe_nickname text not null,
  cafe_profile_url text not null,
  cafe_grade text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_seller_verifications enable row level security;

create index if not exists idx_market_seller_verifications_user_id
  on public.market_seller_verifications (user_id, created_at desc);

create index if not exists idx_market_seller_verifications_status
  on public.market_seller_verifications (status, created_at desc);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null,
  seller_display_name text not null,
  card_id text,
  card_no text,
  locale text,
  card_name text,
  title text not null,
  trade_type text not null default '판매',
  condition text not null default '일반',
  price_krw integer,
  negotiable boolean not null default false,
  delivery text not null default '택배',
  region text,
  description text,
  image_url text,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'hidden', 'closed', 'deleted')),
  likes_count integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_listings enable row level security;

create index if not exists idx_market_listings_status_created_at
  on public.market_listings (status, created_at desc);

create index if not exists idx_market_listings_card_id
  on public.market_listings (card_id) where card_id is not null and card_id <> '';

create index if not exists idx_market_listings_seller_user_id
  on public.market_listings (seller_user_id, created_at desc);

create table if not exists public.market_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.market_listing_images enable row level security;

create index if not exists idx_market_listing_images_listing_id
  on public.market_listing_images (listing_id, sort_order asc);

create table if not exists public.market_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  buyer_user_id uuid not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'deleted')),
  created_at timestamptz not null default now()
);

alter table public.market_inquiries enable row level security;

create index if not exists idx_market_inquiries_listing_id
  on public.market_inquiries (listing_id, created_at desc);

create index if not exists idx_market_inquiries_buyer_user_id
  on public.market_inquiries (buyer_user_id, created_at desc);
