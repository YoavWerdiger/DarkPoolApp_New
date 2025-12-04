-- ============================================
-- טעינה מיידית של נתוני Benzinga
-- מפעיל את ה-Functions ידנית ללא המתנה ל-Cron
-- ============================================

-- ============================================
-- 1. טעינת Earnings מ-Benzinga
-- ============================================

SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as earnings_request;

-- המתן 5 שניות
SELECT pg_sleep(5);

-- ============================================
-- 2. טעינת Economic Calendar מ-Benzinga
-- ============================================

SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as economics_request;

-- ============================================
-- הודעות
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🚀 בקשות נשלחו!';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן כ-30 שניות ואז בדוק:';
  RAISE NOTICE '';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE '   SELECT COUNT(*) FROM economic_events_cache WHERE source = ''Benzinga'';';
  RAISE NOTICE '';
  RAISE NOTICE '📊 לצפייה בלוגים:';
  RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
END $$;

