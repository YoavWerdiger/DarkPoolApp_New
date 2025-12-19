-- ============================================
-- בדיקת Economics API עם לוגים
-- ============================================

SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ בקשה נשלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 צפה בלוגים:';
  RAISE NOTICE 'https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
  RAISE NOTICE '';
  RAISE NOTICE 'סנן ל: benzinga-economics-sync';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 חפש:';
  RAISE NOTICE '   - API URL';
  RAISE NOTICE '   - Response status';
  RAISE NOTICE '   - Content-Type';
  RAISE NOTICE '   - Error details';
END $$;








