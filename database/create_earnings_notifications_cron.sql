-- ============================================
-- יצירת Cron Job להתראות דיווחי Earnings
-- ============================================
-- 
-- סקריפט זה יוצר cron job אחד:
-- 1. בדיקת דיווחים קרובים (כל 5 דקות) - התראות לפני דיווח
--
-- הערה: התראות על תוצאות נשלחות דרך database trigger (לא cron)
-- ראה: create_earnings_notifications_trigger.sql
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. הסרת cron jobs קיימים (אם יש)
-- ============================================

DO $$
DECLARE
  job_id INTEGER;
BEGIN
  -- הסרת cron job לדיווחים קרובים
  SELECT jobid INTO job_id
  FROM cron.job
  WHERE jobname = 'earnings_notifications_upcoming';
  
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule('earnings_notifications_upcoming');
    RAISE NOTICE '🗑️ הסרתי cron job קיים: earnings_notifications_upcoming';
  END IF;

END $$;

-- ============================================
-- 2. יצירת Cron Job לדיווחים קרובים
-- ============================================

-- Cron Job שיריץ את הפונקציה כל 5 דקות
-- בודק דיווחים ב-15 דקות הקרובות ושולח התראות
SELECT cron.schedule(
  'earnings_notifications_upcoming',     -- שם ה-job
  '*/5 * * * *',                         -- כל 5 דקות
  $$
  SELECT
    net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================
-- 3. בדיקת Cron Job
-- ============================================

SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'earnings_notifications_upcoming';

-- ============================================
-- 4. הערות
-- ============================================
-- 
-- Cron Schedule Format: 'minute hour day month weekday'
-- 
-- '*/5 * * * *'  - כל 5 דקות (דיווחים קרובים)
-- 
-- התראות על תוצאות נשלחות דרך database trigger
-- (ראה: create_earnings_notifications_trigger.sql)
-- 
-- כדי להסיר את ה-cron job:
-- SELECT cron.unschedule('earnings_notifications_upcoming');





