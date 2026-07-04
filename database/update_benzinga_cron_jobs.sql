-- ============================================
-- עדכון Cron Jobs ל-Benzinga API
-- ============================================

-- מחיקת Cron Jobs ישנים (עם טיפול בשגיאות)
DO $$
BEGIN
  -- נסה למחוק Cron Jobs ישנים (אם קיימים)
  BEGIN
    PERFORM cron.unschedule('earnings-daily-sync');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'earnings-daily-sync not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('earnings-results-morning');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'earnings-results-morning not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('earnings-results-evening');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'earnings-results-evening not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('daily-economic-sync');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-economic-sync not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('daily-economic-sync-simple');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-economic-sync-simple not found, skipping...';
  END;
  
  -- מחיקת Benzinga Jobs ישנים (במקרה שרצו כבר)
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-morning');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-evening');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-economics-sync');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-economic-scheduler');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RAISE NOTICE 'ניקוי Cron Jobs ישנים הושלם!';
END $$;

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
-- הצגת כל ה-Cron Jobs
-- ============================================

SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobname;

-- ============================================
-- סיכום
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Benzinga Cron Jobs הוגדרו בהצלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Earnings Sync (Benzinga):';
  RAISE NOTICE '   - בוקר: 06:00 ישראל (03:00 UTC)';
  RAISE NOTICE '   - ערב: 18:00 ישראל (15:00 UTC)';
  RAISE NOTICE '';
  RAISE NOTICE '📅 Economic Calendar Sync (Benzinga):';
  RAISE NOTICE '   - כל 6 שעות';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Economic Scheduler (גיבוי):';
  RAISE NOTICE '   - 01:00 UTC יומי';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 סה"כ: 4 Cron Jobs פעילים';
END $$;

