-- ============================================
-- יצירת Cron Job לעדכון תוצאות בלייב - כל 15 דקות
-- ============================================
-- 
-- הפונקציה בודקת אירועים של היום (ואתמול) ומעדכנת תוצאות (actual)
-- רצה כל 15 דקות במהלך היום

-- מחיקת Cron Job ישן (אם קיים)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('benzinga-update-results-live');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-update-results-live not found, skipping...';
  END;
END $$;

-- יצירת Cron Job חדש - כל 15 דקות
-- 15 דקות = */15 * * * * (כל 15 דקות בכל שעה, כל יום)
SELECT cron.schedule(
  'benzinga-update-results-live',
  '*/15 * * * *', -- כל 15 דקות
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-update-results-live',
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
WHERE jobname = 'benzinga-update-results-live';

-- הודעה
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Live Results Cron Job הוגדר!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Job Details:';
  RAISE NOTICE '   ├─ Name: benzinga-update-results-live';
  RAISE NOTICE '   ├─ Schedule: כל 15 דקות (*/15 * * * *)';
  RAISE NOTICE '   └─ Function: benzinga-update-results-live';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 מה הפונקציה עושה:';
  RAISE NOTICE '   ├─ בודקת אירועים של היום ואתמול';
  RAISE NOTICE '   ├─ מעדכנת תוצאות (actual) כשהן מתפרסמות';
  RAISE NOTICE '   └─ Realtime Subscription מעדכן את האפליקציה אוטומטית';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Latency:';
  RAISE NOTICE '   └─ עד 15 דקות מהפרסום עד העדכון באפליקציה';
  RAISE NOTICE '';
END $$;









