-- (הוחל בשרת דרך MCP ב-2026-10-10; נשמר כאן לגיבוי הריפו)
-- השבתת סנכרון Colmex Pro: עדיין לא מוכן להשקה לציבור, ובבדיקת העומס התגלה שהוא הצרכן הכבד
-- ביותר של המסד (כתיבה מחדש של ~35K שורות broker_instrument_map כל 15 דקות, בשביל 2 חיבורים).
-- הפעלה מחדש: select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'broker-colmex-sync-every-15-min'), active := true);
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'broker-colmex-sync-every-15-min'),
  active := false
);
