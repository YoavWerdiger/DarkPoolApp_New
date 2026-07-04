-- ============================================
-- Cron Job: שליחת התראות ממתינות (process-pending-notifications)
-- ============================================
-- אם הטריגר על app_news_clean לא מצליח לקרוא ל-Edge Function (pg_net נכשל),
-- ה-cron הזה ישלח את כל ההתראות ב-pending_notifications כל 2 דקות.
--
-- דרישות: pg_net ו-pg_cron extensions מופעלים.
-- ⚠️ החלף את ה-Service Role Key אם עשית רוטציה (מאותו מקום כמו ב-setup_chat_notifications.sql)
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- הסרת cron קיים אם קיים
DO $$
BEGIN
  PERFORM cron.unschedule('process_pending_notifications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- הרצה כל 2 דקות
SELECT cron.schedule(
  'process_pending_notifications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- בדיקה
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'process_pending_notifications';
