-- 5 קרנות נוספו (Trian, Coatue, D1, TCI, Viking) + 3 משרדים משפחתיים → ~45 פרופילים בחישוב. אצוות עד offset 42.
select cron.schedule('materialize-darkpool-portfolios-daily', '30 2 * * *',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from generate_series(0, 42, 6) o; $$);
select cron.schedule('materialize-darkpool-portfolios-hot-f', '50 15,17,19,21 * * 1-5',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from (values (30),(36),(42)) v(o); $$);
