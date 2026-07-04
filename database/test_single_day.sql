-- ============================================
-- בדיקה - יום אחד בלבד
-- ============================================
-- 
-- זה יאפשר לנו לבדוק אם הפונקציה עובדת על יום אחד

DO $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
BEGIN
  -- היום + 3 ימים קדימה (יום אחד בלבד)
  from_date := (today_est + INTERVAL '3 days')::DATE;
  to_date := (today_est + INTERVAL '3 days')::DATE; -- אותו יום
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקה - יום אחד בלבד';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 תאריך: %', from_date_str;
  RAISE NOTICE '';
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
  );
  
  RAISE NOTICE '✅ הבקשה נשלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 20 שניות...';
  RAISE NOTICE '';
END $$;

-- המתן 20 שניות
SELECT pg_sleep(20);

-- בדיקה - כמה דיווחים יש עכשיו
SELECT 
  'Single Day Test' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar
WHERE report_date = ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '3 days');

-- דוגמאות
SELECT 
  code,
  report_date,
  before_after_market,
  actual,
  estimate
FROM earnings_calendar
WHERE report_date = ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '3 days')
LIMIT 10;








