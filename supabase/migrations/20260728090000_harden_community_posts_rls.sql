drop policy if exists "community auth insert" on public.community_posts;
drop policy if exists "community owner update" on public.community_posts;
drop policy if exists "community owner delete" on public.community_posts;

create policy "community auth insert"
on public.community_posts
for insert
to authenticated
with check (
  board_id not like '__%'
  and author_token in (
    (select auth.uid())::text,
    'user:' || (select auth.uid())::text
  )
);

create policy "community owner update"
on public.community_posts
for update
to authenticated
using (
  board_id not like '__%'
  and author_token in (
    (select auth.uid())::text,
    'user:' || (select auth.uid())::text
  )
)
with check (
  board_id not like '__%'
  and author_token in (
    (select auth.uid())::text,
    'user:' || (select auth.uid())::text
  )
);

create policy "community owner delete"
on public.community_posts
for delete
to authenticated
using (
  board_id not like '__%'
  and author_token in (
    (select auth.uid())::text,
    'user:' || (select auth.uid())::text
  )
);
