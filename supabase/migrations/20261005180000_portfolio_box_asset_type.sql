-- Sealed boxes share portfolio_holdings with cards; existing rows default to card.
-- Ownership RLS, the (user_id, apparel_id, grade) uniqueness and purchase foreign keys stay as they are.
alter table public.portfolio_holdings
  add column if not exists asset_type text not null default 'card'
  check (asset_type in ('card', 'box'));

alter table public.portfolio_holdings
  drop constraint if exists portfolio_holdings_box_grade_check;
alter table public.portfolio_holdings
  add constraint portfolio_holdings_box_grade_check check (asset_type <> 'box' or grade = 'a');

-- An apparel ID identifies one product, so a conflict upsert must not flip a saved asset's type.
create or replace function public.keep_portfolio_asset_type() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.asset_type is distinct from old.asset_type then
    raise exception 'portfolio_asset_type_conflict';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_asset_type_immutable on public.portfolio_holdings;
create trigger portfolio_asset_type_immutable before update of asset_type
on public.portfolio_holdings for each row execute function public.keep_portfolio_asset_type();
