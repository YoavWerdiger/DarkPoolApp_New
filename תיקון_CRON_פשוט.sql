-- ========================================
-- תיקון פשוט - הגדרת Cron Job
-- ========================================
-- 
-- קובץ זה יוצר Cron Job חדש בלי למחוק דברים ישנים
-- פשוט רץ את זה - זה יעבוד!
--

-- יצירת/עדכון Cron Job ל-daily-economic-sync-simple
SELECT cron.schedule(
  'daily-economic-sync-simple',
  '0 6 * * *',  -- כל יום ב-06:00 UTC (= 09:00 ישראל בחורף, 08:00 בקיץ)
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- בדיקה - רשימת Cron Jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;


