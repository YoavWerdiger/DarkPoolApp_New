-- 8 קרנות 13F נוספו (37 פרופילים בחישוב) — אצוות גם ב-offset 30/36.
select cron.schedule('materialize-darkpool-portfolios-daily', '30 2 * * *',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from generate_series(0, 36, 6) o; $$);
select cron.schedule('materialize-darkpool-portfolios-hot-f', '50 15,17,19,21 * * 1-5',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from (values (30),(36)) v(o); $$);
