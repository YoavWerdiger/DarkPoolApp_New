-- ========================================
-- עדכון Cron Job ליומן כלכלי משופר
-- ========================================
-- 
-- קובץ זה מעדכן את ה-Cron Job להשתמש בפונקציה המשופרת
-- עם תיקון תאריכים, שעות ופריסה נכונה לימים
--
-- הרץ קובץ זה ב-SQL Editor של Supabase
--

-- מחיקת Cron Jobs ישנים
SELECT cron.unschedule('daily-economic-sync');
SELECT cron.unschedule('daily-economic-sync-simple');

-- ======================================
-- אופציה 1: sync-economic-calendar (מומלץ!)
-- ======================================
-- כולל: תיקון תאריכים + תרגום לעברית

SELECT cron.schedule(
  'sync-economic-calendar',
  '0 6 * * *',  -- כל יום ב-06:00 (שעון UTC)
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/sync-economic-calendar',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ======================================
-- אופציה 2: daily-economic-sync-simple (אם מעדיפים)
-- ======================================
-- כולל: תיקון תאריכים בלבד (ללא תרגום)

-- SELECT cron.schedule(
--   'daily-economic-sync-simple',
--   '0 6 * * *',  -- כל יום ב-06:00 (שעון UTC)
--   $$
--   SELECT net.http_post(
--     url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync-simple',
--     headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000
--   );
--   $$
-- );

-- ======================================
-- בדיקה - רשימת כל ה-Cron Jobs הפעילים
-- ======================================

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;

-- ======================================
-- בדיקה - לוגים אחרונים
-- ======================================

-- SELECT 
--   runid,
--   jobid,
--   job_pid,
--   database,
--   username,
--   command,
--   status,
--   return_message,
--   start_time,
--   end_time
-- FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%economic%')
-- ORDER BY start_time DESC
-- LIMIT 10;


