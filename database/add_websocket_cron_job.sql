-- ============================================
-- הוספת Cron Job ל-WebSocket Earnings Stream
-- ============================================
-- 
-- הערה: WebSocket צריך connection מתמשך, אז זה רק מפעיל את ה-function
-- ה-function עצמו צריך לרוץ ברקע (אולי דרך n8n או service אחר)

-- מחיקת Cron Job ישן (אם קיים)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('benzinga-websocket-stream');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-websocket-stream not found, skipping...';
  END;
END $$;

-- יצירת Cron Job חדש - פעם ביום (06:00 ישראל = 03:00 UTC)
-- הערה: זה רק מפעיל את ה-function, אבל WebSocket צריך לרוץ ברקע
SELECT cron.schedule(
  'benzinga-websocket-stream',
  '0 3 * * *', -- 06:00 ישראל
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-websocket-stream',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- בדיקה
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'benzinga-websocket-stream';

-- הודעה
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ WebSocket Cron Job הוגדר!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  חשוב:';
  RAISE NOTICE '   WebSocket צריך connection מתמשך, אז זה רק מפעיל את ה-function';
  RAISE NOTICE '   ה-function צריך לרוץ ברקע (אולי דרך n8n או service אחר)';
  RAISE NOTICE '   או להריץ ידנית: npm run supabase:functions:serve benzinga-websocket-stream';
  RAISE NOTICE '';
END $$;








