-- ============================================
-- הגדרת מערכת הדיווחים הרבעוניים המלאה
-- ============================================
-- 
-- סקריפט זה מגדיר את כל מה שצריך למערכת דיווחים רבעוניים:
-- 1. Cron Job לסנכרון יומי
-- 2. בדיקת נתונים קיימים
-- 3. הוראות להפעלה

-- ============================================
-- 1. הגדרת Cron Job לסנכרון יומי
-- ============================================

-- מחיקת Cron Jobs ישנים (אם קיימים)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-daily');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-earnings-sync-daily not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-morning');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-earnings-sync-morning not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-evening');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-earnings-sync-evening not found, skipping...';
  END;
END $$;

-- יצירת Cron Job חדש - פעם ביום (06:00 ישראל = 03:00 UTC)
-- שליפה: חודש אחורה + חודש קדימה מהיום
SELECT cron.schedule(
  'benzinga-earnings-sync-daily',
  '0 3 * * *', -- 06:00 ישראל (03:00 UTC)
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 2. בדיקת Cron Jobs
-- ============================================

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
WHERE jobname LIKE '%earnings%' OR jobname LIKE '%benzinga%'
ORDER BY jobname;

-- ============================================
-- 3. בדיקת נתונים קיימים
-- ============================================

-- סטטיסטיקות כלליות
SELECT 
  'Earnings Statistics' as check_type,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN source = 'Benzinga' THEN 1 END) as benzinga_count,
  COUNT(CASE WHEN report_date < CURRENT_DATE THEN 1 END) as past_reports,
  COUNT(CASE WHEN report_date = CURRENT_DATE THEN 1 END) as today_reports,
  COUNT(CASE WHEN report_date > CURRENT_DATE THEN 1 END) as future_reports,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar;

-- דיווחים של היום
SELECT 
  'Today Reports' as check_type,
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  difference,
  percent,
  source
FROM earnings_calendar
WHERE report_date = CURRENT_DATE
ORDER BY before_after_market NULLS LAST, code
LIMIT 20;

-- דיווחים עתידיים (7 ימים קדימה)
SELECT 
  'Next 7 Days' as check_type,
  report_date,
  COUNT(*) as reports_count,
  COUNT(CASE WHEN before_after_market = 'BeforeMarket' THEN 1 END) as before_market,
  COUNT(CASE WHEN before_after_market = 'AfterMarket' THEN 1 END) as after_market
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
GROUP BY report_date
ORDER BY report_date;

-- ============================================
-- 4. הודעות
-- ============================================

DO $$
DECLARE
  earnings_count INTEGER;
  today_count INTEGER;
  future_count INTEGER;
  cron_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO earnings_count FROM earnings_calendar;
  SELECT COUNT(*) INTO today_count FROM earnings_calendar WHERE report_date = CURRENT_DATE;
  SELECT COUNT(*) INTO future_count FROM earnings_calendar WHERE report_date > CURRENT_DATE;
  SELECT COUNT(*) INTO cron_count FROM cron.job WHERE jobname LIKE '%earnings%';
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📈 מערכת הדיווחים הרבעוניים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 נתונים במסד:';
  RAISE NOTICE '   ├─ סה"כ דיווחים: %', earnings_count;
  RAISE NOTICE '   ├─ דיווחים היום: %', today_count;
  RAISE NOTICE '   └─ דיווחים עתידיים: %', future_count;
  RAISE NOTICE '';
  RAISE NOTICE '⏰ Cron Jobs:';
  RAISE NOTICE '   └─ פעילים: %', cron_count;
  RAISE NOTICE '';
  
  IF cron_count > 0 THEN
    RAISE NOTICE '✅ Cron Job מוגדר!';
    RAISE NOTICE '   └─ רץ כל יום ב-06:00 ישראל';
  ELSE
    RAISE NOTICE '⚠️  אין Cron Job - צריך להריץ את הסקריפט הזה';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Functions פרוסים:';
  RAISE NOTICE '   ├─ daily-earnings-sync-simple (סנכרון יומי)';
  RAISE NOTICE '   └─ benzinga-websocket-stream (עדכונים בזמן אמת)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 הערות:';
  RAISE NOTICE '   ├─ הסנכרון היומי שולף חודש אחורה + חודש קדימה';
  RAISE NOTICE '   ├─ WebSocket stream מעדכן תוצאות אקטואליות בזמן אמת';
  RAISE NOTICE '   └─ האפליקציה משתמשת ב-Realtime Subscription לעדכונים מיידיים';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 להפעלה מיידית:';
  RAISE NOTICE '   └─ הרץ: database/fetch_earnings_now.sql';
  RAISE NOTICE '';
END $$;









