-- ============================================
-- עדכון Cron Jobs - פעם אחת ביום
-- ============================================

-- מחיקת Cron Jobs קיימים
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-morning');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-evening');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-economics-sync');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-economic-scheduler');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  RAISE NOTICE '🗑️  Cron Jobs ישנים נמחקו';
END $$;

-- ============================================
-- Cron Jobs חדשים - פעם ביום
-- ============================================

-- 1. Earnings - בוקר בלבד (06:00 ישראל = 03:00 UTC)
SELECT cron.schedule(
  'benzinga-daily-earnings',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 2. Economics - בוקר בלבד (06:00 ישראל = 03:00 UTC)
SELECT cron.schedule(
  'benzinga-daily-economics',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- בדיקת Jobs חדשים
-- ============================================

SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%benzinga%'
ORDER BY jobname;

-- ============================================
-- הודעת סיכום
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Cron Jobs עודכנו לפעם ביום!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Jobs פעילים:';
  RAISE NOTICE '   ├─ benzinga-daily-earnings';
  RAISE NOTICE '   │  └─ 06:00 ישראל (03:00 UTC) - כל יום';
  RAISE NOTICE '   └─ benzinga-daily-economics';
  RAISE NOTICE '      └─ 06:00 ישראל (03:00 UTC) - כל יום';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 כל Job שולף:';
  RAISE NOTICE '   └─ שבוע אחורה + 3 חודשים קדימה';
  RAISE NOTICE '';
  RAISE NOTICE '💡 יתרונות:';
  RAISE NOTICE '   ✓ פחות עומס על ה-API';
  RAISE NOTICE '   ✓ פחות Cron executions';
  RAISE NOTICE '   ✓ כיסוי מלא של 3 חודשים קדימה';
  RAISE NOTICE '';
END $$;









