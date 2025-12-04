-- ============================================
-- טעינה פשוטה של נתוני Benzinga
-- ============================================

-- 1. Earnings
SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );

-- המתן
SELECT pg_sleep(10);

-- 2. Economics
SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );

-- המתן לעיבוד
SELECT pg_sleep(30);

-- ============================================
-- ספירה
-- ============================================

SELECT 
  'earnings_calendar' as table_name,
  COUNT(*) as total_records,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar

UNION ALL

SELECT 
  'economic_events_cache' as table_name,
  COUNT(*) as total_records,
  MIN(date)::text as earliest_date,
  MAX(date)::text as latest_date
FROM economic_events_cache
WHERE source = 'Benzinga';

-- ============================================
-- הודעה
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ סיימתי לשלוח בקשות!';
  RAISE NOTICE '⏳ המתן עוד 20 שניות ואז בדוק את התוצאות';
  RAISE NOTICE '';
  RAISE NOTICE '📊 לוגים:';
  RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
END $$;

