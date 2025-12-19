-- ============================================
-- בדיקת Earnings Sync - למה אין דיווחים?
-- ============================================

-- 1. בדיקת מצב נוכחי
SELECT 
  'Current Status' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT code) as unique_stocks,
  MIN(report_date)::text as earliest,
  MAX(report_date)::text as latest
FROM earnings_calendar;

-- 2. בדיקת לוגים אחרונים של הפונקציה
-- (צריך לבדוק ב-Supabase Dashboard > Functions > daily-earnings-sync-simple > Logs)

-- 3. הרצת הפונקציה ידנית עם לוגים
DO $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
  response_text TEXT;
BEGIN
  -- 3 חודשים אחורה
  from_date := (today_est - INTERVAL '3 months')::DATE;
  -- 6 חודשים קדימה
  to_date := (today_est + INTERVAL '6 months')::DATE;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקת Earnings Sync';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים (EST/EDT):';
  RAISE NOTICE '   ├─ מהיום (EST): %', today_est;
  RAISE NOTICE '   ├─ מתאריך: %', from_date_str;
  RAISE NOTICE '   └─ עד תאריך: %', to_date_str;
  RAISE NOTICE '';
  RAISE NOTICE '🚀 מפעיל Earnings Sync...';
  RAISE NOTICE '';
  
  -- קריאה ל-Earnings Sync Function
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
  );
  
  RAISE NOTICE '✅ הבקשה נשלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 60-120 שניות...';
  RAISE NOTICE '';
  RAISE NOTICE '📊 אחרי זה:';
  RAISE NOTICE '   1. בדוק את הלוגים ב-Supabase Dashboard > Functions > daily-earnings-sync-simple > Logs';
  RAISE NOTICE '   2. הרץ: SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE '';
END $$;

-- 4. בדיקה אחרי 60 שניות
SELECT 
  'After Sync' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT code) as unique_stocks,
  MIN(report_date)::text as earliest,
  MAX(report_date)::text as latest
FROM earnings_calendar;







