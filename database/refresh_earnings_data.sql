-- ============================================
-- רענון נתוני דיווחים - שליפה מורחבת
-- ============================================
-- 
-- שליפה של 3 חודשים אחורה + 6 חודשים קדימה
-- כדי לוודא שיש מספיק נתונים

-- 1. חישוב תאריכים
DO $$
DECLARE
  today_date DATE := CURRENT_DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
BEGIN
  -- 3 חודשים אחורה
  from_date := today_date - INTERVAL '3 months';
  -- 6 חודשים קדימה
  to_date := today_date + INTERVAL '6 months';
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים מורחב:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'מהיום: %', today_date;
  RAISE NOTICE 'מתאריך: %', from_date_str;
  RAISE NOTICE 'עד תאריך: %', to_date_str;
  RAISE NOTICE '';
  RAISE NOTICE '📊 זה יוסיף/יעדכן דיווחים בטווח של 9 חודשים';
  RAISE NOTICE '';
  
  -- 2. קריאה ל-Earnings Sync Function
  RAISE NOTICE '🚀 מפעיל Earnings Sync עם טווח מורחב...';
  
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
  RAISE NOTICE '⏳ המתן 60-120 שניות (זה עלול לקחת זמן בגלל כמות הנתונים)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 אחרי זה בדוק:';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar WHERE report_date = CURRENT_DATE;';
  RAISE NOTICE '';
END $$;

-- 3. בדיקה - כמה דיווחים יש עכשיו
SELECT 
  'Current Status' as check_type,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN report_date < CURRENT_DATE THEN 1 END) as past_reports,
  COUNT(CASE WHEN report_date = CURRENT_DATE THEN 1 END) as today_reports,
  COUNT(CASE WHEN report_date > CURRENT_DATE THEN 1 END) as future_reports,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar;








