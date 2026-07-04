-- ============================================
-- שליפה מיידית של כל הדיווחים
-- חודש אחורה + חודש קדימה מהיום
-- ============================================

-- 1. חישוב תאריכים
DO $$
DECLARE
  today_date DATE := CURRENT_DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
BEGIN
  -- חודש אחורה
  from_date := today_date - INTERVAL '1 month';
  -- חודש קדימה
  to_date := today_date + INTERVAL '1 month';
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'מהיום: %', today_date;
  RAISE NOTICE 'מתאריך: %', from_date_str;
  RAISE NOTICE 'עד תאריך: %', to_date_str;
  RAISE NOTICE '';
  
  -- 2. קריאה ל-Earnings Sync Function
  RAISE NOTICE '🚀 מפעיל Earnings Sync...';
  
  PERFORM net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'date_from', from_date_str,
      'date_to', to_date_str
    )
  ) as request_id;
  
  RAISE NOTICE '✅ הבקשה נשלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 30-60 שניות ואז בדוק:';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar WHERE report_date BETWEEN % AND %;', from_date_str, to_date_str;
  RAISE NOTICE '';
END $$;

-- 3. בדיקה - כמה דיווחים יש בטווח
SELECT 
  'Current Earnings Count' as check_type,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN report_date < CURRENT_DATE THEN 1 END) as past_reports,
  COUNT(CASE WHEN report_date = CURRENT_DATE THEN 1 END) as today_reports,
  COUNT(CASE WHEN report_date > CURRENT_DATE THEN 1 END) as future_reports,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE - INTERVAL '1 month' AND CURRENT_DATE + INTERVAL '1 month';

-- 4. דוגמאות דיווחים
SELECT 
  'Sample Reports' as check_type,
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  difference,
  percent
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE - INTERVAL '1 month' AND CURRENT_DATE + INTERVAL '1 month'
ORDER BY report_date DESC
LIMIT 10;

