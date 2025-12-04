-- ============================================
-- יצירת Cron Jobs חדשים ל-Benzinga API
-- (ללא מחיקת Jobs ישנים)
-- ============================================

-- ============================================
-- 1. Earnings Sync (Benzinga) - פעמיים ביום
-- ============================================

-- בוקר - 06:00 ישראל = 03:00 UTC
SELECT cron.schedule(
  'benzinga-earnings-sync-morning',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ערב - 18:00 ישראל = 15:00 UTC
SELECT cron.schedule(
  'benzinga-earnings-sync-evening',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 2. Economic Calendar Sync (Benzinga) - כל 6 שעות
-- ============================================

SELECT cron.schedule(
  'benzinga-economics-sync',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 3. Economic Scheduler (גיבוי) - פעם ביום
-- ============================================

SELECT cron.schedule(
  'benzinga-economic-scheduler',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/economic-scheduler/update-economic-data',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- בדיקת Cron Jobs חדשים
-- ============================================

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  nodename
FROM cron.job
WHERE jobname LIKE '%benzinga%'
ORDER BY jobname;

-- ============================================
-- סיכום
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Benzinga Cron Jobs נוצרו בהצלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Earnings Sync (Benzinga):';
  RAISE NOTICE '   ├─ benzinga-earnings-sync-morning';
  RAISE NOTICE '   │  └─ 06:00 ישראל (03:00 UTC)';
  RAISE NOTICE '   └─ benzinga-earnings-sync-evening';
  RAISE NOTICE '      └─ 18:00 ישראל (15:00 UTC)';
  RAISE NOTICE '';
  RAISE NOTICE '📅 Economic Calendar Sync (Benzinga):';
  RAISE NOTICE '   └─ benzinga-economics-sync';
  RAISE NOTICE '      └─ כל 6 שעות';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Economic Scheduler (גיבוי):';
  RAISE NOTICE '   └─ benzinga-economic-scheduler';
  RAISE NOTICE '      └─ 01:00 UTC יומי';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 סה"כ: 4 Cron Jobs פעילים';
  RAISE NOTICE '';
  RAISE NOTICE '📊 כדי לראות את כל ה-Jobs:';
  RAISE NOTICE '   SELECT jobname, schedule FROM cron.job;';
END $$;

