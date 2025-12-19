-- ============================================
-- הפעלה מיידית של Benzinga Sync
-- ============================================

-- Earnings
SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as earnings_sync;

-- המתן 5 שניות
SELECT pg_sleep(5);

-- Economics
SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as economics_sync;

-- הצלחה!
DO $$
BEGIN
  RAISE NOTICE '✅ שליחה הושלמה!';
  RAISE NOTICE '⏳ המתן 30-60 שניות ובדוק:';
  RAISE NOTICE '';
  RAISE NOTICE 'SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE 'SELECT COUNT(*) FROM economic_events_cache WHERE source = ''Benzinga'';';
END $$;








