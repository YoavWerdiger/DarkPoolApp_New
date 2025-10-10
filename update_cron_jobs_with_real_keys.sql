-- עדכון Cron Jobs עם המפתחות האמיתיים
-- הרץ קובץ זה ב-SQL Editor של Supabase

-- מחיקת Cron Jobs ישנים
SELECT cron.unschedule('daily-economic-sync');
SELECT cron.unschedule('daily-earnings-sync');
SELECT cron.unschedule('smart-economic-poller');

-- יצירת Cron Jobs חדשים עם המפתחות הנכונים

-- 1. Daily Economic Sync - כל יום ב-06:00
SELECT cron.schedule(
  'daily-economic-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 2. Daily Earnings Sync - כל יום ב-07:00
SELECT cron.schedule(
  'daily-earnings-sync',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. Smart Economic Poller - כל שעתיים
SELECT cron.schedule(
  'smart-economic-poller',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-economic-poller',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- בדיקת Cron Jobs פעילים
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
ORDER BY jobid;

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ Cron Jobs עודכנו בהצלחה!';
  RAISE NOTICE '📅 daily-economic-sync: כל יום ב-06:00';
  RAISE NOTICE '📅 daily-earnings-sync: כל יום ב-07:00';
  RAISE NOTICE '📅 smart-economic-poller: כל שעתיים';
END $$;

