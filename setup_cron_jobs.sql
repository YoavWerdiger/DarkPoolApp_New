-- הגדרת Cron Jobs עם pg_cron
-- הרץ את הקובץ הזה ב-SQL Editor של Supabase

-- הפעלת pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- הגדרת Cron Jobs

-- 1. Daily Economic Sync - כל יום ב-06:00
SELECT cron.schedule(
  'daily-economic-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-economic-sync',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
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
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-earnings-sync',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. Smart Poller - כל שעתיים
SELECT cron.schedule(
  'smart-economic-poller',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/smart-economic-poller',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- בדיקת Cron Jobs פעילים
SELECT * FROM cron.job;

-- עצירת Cron Jobs (אם צריך)
-- SELECT cron.unschedule('daily-economic-sync');
-- SELECT cron.unschedule('daily-earnings-sync');
-- SELECT cron.unschedule('smart-economic-poller');

