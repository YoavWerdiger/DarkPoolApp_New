-- ============================================
-- בדיקה מפורטת עם קריאה לפונקציה
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 קריאה ל-Edge Function עם לוגים מפורטים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  -- קריאה ל-Edge Function
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-v2',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ Request sent. HTTP Response ID: %', http_response_id;
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 15 שניות לעיבוד...';
  RAISE NOTICE '';
  
  -- המתן לפני בדיקה
  PERFORM pg_sleep(15);
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 מה לבדוק עכשיו:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '1. לך ל-Supabase Dashboard:';
  RAISE NOTICE '   Functions → daily-earnings-sync-v2 → Logs';
  RAISE NOTICE '';
  RAISE NOTICE '2. חפש את הריצה האחרונה ובדוק:';
  RAISE NOTICE '   ✅ כמה רשומות התקבלו מה-API';
  RAISE NOTICE '   ✅ האם יש שגיאות upsert';
  RAISE NOTICE '   ✅ מה התוכן של השגיאות';
  RAISE NOTICE '';
  RAISE NOTICE '3. הרץ את השאילתות למטה כדי לראות כמה רשומות נוספו';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
END $$;

-- בדיקה - כמה רשומות נוספו לאחרונה
SELECT 
  COUNT(*) as recent_records,
  MIN(updated_at) as earliest,
  MAX(updated_at) as latest,
  COUNT(DISTINCT ticker) FILTER (WHERE ticker IS NOT NULL) as unique_tickers,
  COUNT(DISTINCT code) as unique_codes
FROM earnings_calendar 
WHERE updated_at > NOW() - INTERVAL '20 minutes';

-- בדיקת דוגמאות רשומות (אם יש)
SELECT 
  ticker,
  code,
  company_name,
  report_date,
  eps_estimate,
  revenue_estimate,
  importance,
  updated_at
FROM earnings_calendar
ORDER BY updated_at DESC
LIMIT 5;





