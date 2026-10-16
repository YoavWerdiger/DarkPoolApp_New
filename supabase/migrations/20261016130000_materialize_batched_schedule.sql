-- materialize-darkpool-portfolios: ריצת 'full' אחת (כל 29 הפרופילים) קרסה על זיכרון (WORKER_RESOURCE_LIMIT) כבר ימים —
-- אף snapshot לא נשמר בלילה. עכשיו: 5 אצוות של 6 ('hot' עם offset), ובמהלך היום offsets 0/6/12/18/24
-- (קודם 0/8/16 עם תקרה 6 → פרופילים 6–7, 14–15 ו-22+ לא חושבו אף פעם).
select cron.schedule('materialize-darkpool-portfolios-daily', '30 2 * * *',
  $$ select public.invoke_materialize_darkpool_portfolios('hot', o) from generate_series(0, 24, 6) o; $$);
select cron.schedule('materialize-darkpool-portfolios-hot-b', '45 14-21 * * 1-5', $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 6); $$);
select cron.schedule('materialize-darkpool-portfolios-hot-c', '30 15,17,19,21 * * 1-5', $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 12); $$);
select cron.schedule('materialize-darkpool-portfolios-hot-d', '5 15,17,19,21 * * 1-5', $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 18); $$);
select cron.schedule('materialize-darkpool-portfolios-hot-e', '35 14,16,18,20 * * 1-5', $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 24); $$);
