-- חברות ציבוריות שמגישות 13F (NVIDIA, Alphabet, SoftBank...) — אותו צינור של הקרנות (sync-fund-13f-sec),
-- עם סימון entity_type='company' + הטיקר של החברה עצמה (לוגו / תת-כותרת «חברה ציבורית · NVDA»).
-- תוספתי בלבד: עמודות חדשות עם ברירת מחדל, בלי לגעת בשורות קיימות.
alter table public.dark_pool_fund_managers
  add column if not exists entity_type text not null default 'fund',
  add column if not exists ticker text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dark_pool_fund_managers_entity_type_check'
  ) then
    alter table public.dark_pool_fund_managers
      add constraint dark_pool_fund_managers_entity_type_check check (entity_type in ('fund', 'company'));
  end if;
end $$;

-- materialize: 45 יעדים קיימים + 19 חברות = 64 → אצוות של 6 עד offset 66
select cron.schedule('materialize-darkpool-portfolios-daily', '30 2 * * *',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from generate_series(0, 66, 6) o; $$);
-- רענון מחירים תוך-יומי ליעדים החדשים (offset 48–66) — כמו hot-f לקרנות
select cron.schedule('materialize-darkpool-portfolios-hot-g', '20 15,17,19,21 * * 1-5',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from (values (48),(54),(60),(66)) v(o); $$);
