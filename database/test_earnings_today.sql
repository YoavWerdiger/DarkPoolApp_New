-- ============================================
-- בדיקת שליפת דיווחים לתאריך קרוב (היום + שבוע)
-- ============================================
-- 
-- זה בודק אם יש דיווחים בתאריכים הקרובים

DO $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
  http_response_id BIGINT;
BEGIN
  -- שבוע קדימה בלבד (תאריכים קרובים יותר)
  from_date := today_est;
  to_date := (today_est + INTERVAL '7 days')::DATE;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקת שליפת דיווחים לתאריכים קרובים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים (EST/EDT):';
  RAISE NOTICE '   ├─ מהיום (EST): %', today_est;
  RAISE NOTICE '   ├─ מתאריך: %', from_date_str;
  RAISE NOTICE '   └─ עד תאריך: % (שבוע קדימה)', to_date_str;
  RAISE NOTICE '';
  RAISE NOTICE '🚀 מפעיל Earnings Sync...';
  
  SELECT net.http_post(
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
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ הבקשה נשלחה! HTTP Response ID: %', http_response_id;
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 60 שניות...';
  RAISE NOTICE '';
END $$;

-- המתן 60 שניות
SELECT pg_sleep(60);

-- בדיקת תוצאות
SELECT 
  'Week Test Results' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT code) as unique_companies,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days');

-- דוגמאות
SELECT 
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  revenue_actual,
  revenue_estimate_avg
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')
ORDER BY report_date ASC, code ASC
LIMIT 20;







