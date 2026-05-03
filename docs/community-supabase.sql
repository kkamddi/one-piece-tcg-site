create table if not exists public.community_posts (
  id text primary key,
  board_id text not null,
  nickname text not null,
  title text not null,
  card_name text,
  image_url text,
  content text not null,
  likes integer not null default 0,
  views integer not null default 0,
  author_token text not null,
  liked_tokens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists community_posts_created_at_idx on public.community_posts (created_at desc);
create index if not exists community_posts_board_id_idx on public.community_posts (board_id);
