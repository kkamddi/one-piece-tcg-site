alter table public.community_point_ledger
  drop constraint if exists community_point_ledger_reason_check;

alter table public.community_point_ledger
  add constraint community_point_ledger_reason_check
  check (reason in ('daily_checkin', 'post_created', 'post_like', 'admin_adjustment'));

create or replace function public.award_community_post_created_point(
  p_user_id uuid,
  p_post_id text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if p_user_id is null or nullif(trim(p_post_id), '') is null then
    return false;
  end if;

  insert into public.community_point_ledger (user_id, amount, reason, source_key, metadata)
  values (
    p_user_id,
    1,
    'post_created',
    p_user_id::text || ':post:' || p_post_id,
    jsonb_build_object('post_id', p_post_id)
  )
  on conflict (reason, source_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.award_community_post_created_point(uuid, text) from public, anon, authenticated;
grant execute on function public.award_community_post_created_point(uuid, text) to service_role;
