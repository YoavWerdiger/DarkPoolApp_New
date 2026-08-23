-- ============================================
-- יצירת Cron Job לעדכון תוצאות Earnings בלייב
-- ============================================
-- 
-- סקריפט זה יוצר cron job שיריץ את הפונקציה
-- update-earnings-results-live כל 10 דקות כדי לעדכן תוצאות בפועל
--
-- הפונקציה משתמשת ב-endpoint: update_actuals_for_today
-- ומעדכנת רק דיווחים של היום
--
-- הפונקציה עצמה בודקת אם זה בשעות דיווחים:
-- - BMO: 12:30-16:45 שעון ישראל (~07:00–09:30 ET)
-- - AMC: 21:30-00:30 שעון ישראל (~16:05 ET)
-- אם זה לא בשעות האלה, הפונקציה תדלג על העדכון
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. הסרת cron job קיים (אם יש)
-- ============================================

DO $$
DECLARE
  job_id INTEGER;
BEGIN
  -- חיפוש cron job קיים
  SELECT jobid INTO job_id
  FROM cron.job
  WHERE jobname = 'update_earnings_results_live';
  
  IF job_id IS NOT NULL THEN
    -- הסרת cron job קיים
    PERFORM cron.unschedule('update_earnings_results_live');
    RAISE NOTICE '🗑️ הסרתי cron job קיים';
  END IF;
END $$;

-- ============================================
-- 2. יצירת Cron Job חדש
-- ============================================

-- Cron Job שיריץ את הפונקציה כל 10 דקות
-- הפונקציה עצמה בודקת אם זה בשעות דיווחים (BMO 12:30-16:45 או AMC 21:30-00:30 שעון ישראל)
SELECT cron.schedule(
  'update_earnings_results_live',           -- שם ה-job
  '*/10 * * * *',                            -- כל 10 דקות
  $$
  SELECT
    net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/update-earnings-results-live',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================
-- 3. בדיקת Cron Jobs
-- ============================================

SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'update_earnings_results_live';

-- ============================================
-- 4. הערות
-- ============================================
-- 
-- Cron Schedule Format: 'minute hour day month weekday'
-- 
-- Cron Job זה ירוץ כל 10 דקות
-- הפונקציה עצמה בודקת אם זה בשעות דיווחים:
-- - BMO: 12:30-16:45 שעון ישראל (~07:00–09:30 ET)
-- - AMC: 21:30-00:30 שעון ישראל (~16:05 ET)
-- 
-- אם זה לא בשעות האלה, הפונקציה תדלג על העדכון
-- 
-- דוגמאות:
-- '*/10 * * * *'  - כל 10 דקות (מה שאנחנו משתמשים)
-- '0 * * * *'     - כל שעה (בדקה 0)
-- '0 */2 * * *'  - כל 2 שעות
-- '0 9,12,15 * * *' - בשעות 9, 12, 15
-- 
-- כדי להסיר את ה-cron job:
-- SELECT cron.unschedule('update_earnings_results_live');





