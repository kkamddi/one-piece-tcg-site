-- Review-only draft: NOT applied. Generate a CLI migration and test locally before deployment.
-- Existing cards default to card. Existing ownership RLS and purchase foreign keys stay intact.
begin;
alter table public.portfolio_holdings
  add column asset_type text not null default 'card'
  check (asset_type in ('card', 'box'));
alter table public.portfolio_holdings
  add constraint portfolio_holdings_box_grade_check check (asset_type <> 'box' or grade = 'a');
-- Keep the existing product/grade uniqueness: an apparel ID identifies one product.
-- Prevent a conflict-upsert from silently changing a previously saved asset's type.
create function public.keep_portfolio_asset_type() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.asset_type is distinct from old.asset_type then
    raise exception 'portfolio_asset_type_conflict';
  end if;
  return new;
end;
$$;
create trigger portfolio_asset_type_immutable before update of asset_type
on public.portfolio_holdings for each row execute function public.keep_portfolio_asset_type();
commit;
