-- ============================================
-- בדיקת Functions ו-Cron Jobs של Benzinga
-- ============================================

-- 1. בדיקת Cron Jobs של Benzinga
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN jobname LIKE '%earnings%' THEN '📈 Earnings'
    WHEN jobname LIKE '%economics%' THEN '📅 Economics'
    ELSE '❓ Other'
  END as type
FROM cron.job
WHERE jobname LIKE '%benzinga%'
ORDER BY jobname;

-- 2. בדיקת כל ה-Cron Jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobname;

-- 3. בדיקת נתונים - Earnings
SELECT 
  'Earnings' as type,
  COUNT(*) as total,
  COUNT(CASE WHEN source = 'Benzinga' THEN 1 END) as benzinga_count,
  MIN(report_date)::text as earliest,
  MAX(report_date)::text as latest
FROM earnings_calendar;

-- 4. בדיקת נתונים - Economics
SELECT 
  'Economics' as type,
  COUNT(*) as total,
  COUNT(CASE WHEN source = 'Benzinga' THEN 1 END) as benzinga_count,
  MIN(date)::text as earliest,
  MAX(date)::text as latest
FROM economic_events;

-- 5. סיכום
DO $$
DECLARE
  earnings_count INTEGER;
  economics_count INTEGER;
  cron_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO earnings_count FROM earnings_calendar;
  SELECT COUNT(*) INTO economics_count FROM economic_events WHERE source = 'Benzinga';
  SELECT COUNT(*) INTO cron_count FROM cron.job WHERE jobname LIKE '%benzinga%';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 מצב Benzinga Integration:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📈 Earnings: % רשומות', earnings_count;
  RAISE NOTICE '📅 Economics: % רשומות', economics_count;
  RAISE NOTICE '⏰ Cron Jobs: % פעילים', cron_count;
  RAISE NOTICE '';
  
  IF cron_count >= 2 THEN
    RAISE NOTICE '✅ יש Cron Jobs פעילים!';
  ELSE
    RAISE NOTICE '⚠️  אין Cron Jobs - הרץ: update_benzinga_cron_jobs.sql';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Functions פרוסים:';
  RAISE NOTICE '   - daily-earnings-sync-simple (Earnings)';
  RAISE NOTICE '   - benzinga-economics-sync (Economics)';
  RAISE NOTICE '';
END $$;








