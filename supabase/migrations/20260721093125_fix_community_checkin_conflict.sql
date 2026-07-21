create or replace function public.record_community_daily_checkin(
  p_user_id uuid,
  p_checkin_date date
)
returns table (
  checked_today boolean,
  total_points bigint,
  streak integer,
  checkin_date date,
  awarded boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.community_daily_checkins (user_id, checkin_date)
  values (p_user_id, p_checkin_date)
  on conflict on constraint community_daily_checkins_pkey do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    insert into public.community_point_ledger (user_id, amount, reason, source_key, metadata)
    values (
      p_user_id,
      1,
      'daily_checkin',
      p_user_id::text || ':' || p_checkin_date::text,
      jsonb_build_object('checkin_date', p_checkin_date)
    )
    on conflict (reason, source_key) do nothing;
  end if;

  return query
  select
    status.checked_today,
    status.total_points,
    status.streak,
    status.checkin_date,
    inserted_count = 1
  from public.get_community_point_status(p_user_id, p_checkin_date) status;
end;
$$;
