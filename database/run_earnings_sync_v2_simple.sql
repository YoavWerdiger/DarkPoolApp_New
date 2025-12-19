-- ============================================
-- הרצת שליפה ראשונית - גרסה פשוטה
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🚀 הרצת שליפה ראשונית - Daily Earnings Sync V2';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📡 קורא ל-Edge Function...';
  
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
  RAISE NOTICE '⏳ הפונקציה רצה ברקע...';
  RAISE NOTICE '';
  RAISE NOTICE '💡 בדוק את התוצאות:';
  RAISE NOTICE '   1. בדוק את הלוגים:';
  RAISE NOTICE '      https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/daily-earnings-sync-v2/logs';
  RAISE NOTICE '';
  RAISE NOTICE '   2. אחרי 1-2 דקות, הרץ את השאילתה למטה';
  RAISE NOTICE '      כדי לראות כמה רשומות נוספו';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה: %', SQLERRM;
    RAISE NOTICE '💡 ודא שהפונקציה הועלתה: npm run supabase:deploy:v2';
END $$;

-- ============================================
-- בדיקה - כמה רשומות נוספו לאחרונה
-- ============================================
-- הרץ את זה אחרי 1-2 דקות

SELECT 
  COUNT(*) as recent_records,
  MIN(updated_at) as earliest,
  MAX(updated_at) as latest,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar 
WHERE updated_at > NOW() - INTERVAL '15 minutes';

-- בדיקת דיווחים לפי תאריך (30 הימים הקרובים)
SELECT 
  report_date,
  COUNT(*) as count,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
GROUP BY report_date
ORDER BY report_date
LIMIT 30;




