-- ============================================
-- בדיקה ישירה של הפונקציה
-- ============================================
-- 
-- זה יקרא לפונקציה ישירות ויציג את התשובה

DO $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
  http_response_id BIGINT;
  http_response_status INT;
  http_response_content TEXT;
BEGIN
  -- היום + 3 ימים קדימה (יום אחד בלבד)
  from_date := (today_est + INTERVAL '3 days')::DATE;
  to_date := (today_est + INTERVAL '3 days')::DATE; -- אותו יום
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקה ישירה של הפונקציה';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 תאריך: %', from_date_str;
  RAISE NOTICE '';
  RAISE NOTICE '🚀 קורא לפונקציה...';
  
  -- קריאה ל-Edge Function
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
  RAISE NOTICE '⏳ ממתין 30 שניות לעיבוד...';
  RAISE NOTICE '';
END $$;

-- המתן 30 שניות
SELECT pg_sleep(30);

-- בדיקת התשובה
DO $$
DECLARE
  http_response_id BIGINT;
  http_response_status INT;
  http_response_content TEXT;
BEGIN
  -- ננסה למצוא את התשובה האחרונה
  SELECT id, status, content 
  INTO http_response_id, http_response_status, http_response_content
  FROM net.http_response_queue
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF http_response_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📥 תשובה מהפונקציה';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE 'Status: %', http_response_status;
    RAISE NOTICE 'Content: %', http_response_content;
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ לא נמצאה תשובה';
    RAISE NOTICE '';
    RAISE NOTICE '💡 בדוק את הלוגים ב-Dashboard:';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
    RAISE NOTICE '';
  END IF;
END $$;

-- בדיקה - כמה דיווחים יש עכשיו
SELECT 
  'After Function Call' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar
WHERE report_date = ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '3 days');








