-- ============================================
-- בדיקת עדכון Actuals
-- ============================================
-- 
-- סקריפט זה בודק את הפונקציה update-earnings-results-live
-- ומציג את התוצאות

-- ============================================
-- 1. בדיקת דיווחים של היום
-- ============================================

SELECT 
  COUNT(*) as total_today,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_eps_actual,
  COUNT(CASE WHEN revenue_actual IS NOT NULL THEN 1 END) as with_revenue_actual,
  COUNT(CASE WHEN actual IS NOT NULL AND revenue_actual IS NOT NULL THEN 1 END) as with_both
FROM earnings_calendar
WHERE report_date = CURRENT_DATE;

-- ============================================
-- 2. רשימת דיווחים של היום עם actuals
-- ============================================

SELECT 
  code,
  ticker,
  company_name,
  report_date,
  before_after_market,
  actual as eps_actual,
  estimate as eps_estimate,
  percent as eps_surprise_percent,
  revenue_actual,
  revenue_estimate_avg as revenue_estimate,
  revenue_surprise_percent,
  updated_at
FROM earnings_calendar
WHERE report_date = CURRENT_DATE
  AND (actual IS NOT NULL OR revenue_actual IS NOT NULL)
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- 3. הפעלת הפונקציה לעדכון
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  RAISE NOTICE '🔄 מפעיל עדכון תוצאות earnings בלייב...';
  
  -- קריאה ל-Edge Function
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/update-earnings-results-live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ קריאה נשלחה. Request ID: %', http_response_id;
  RAISE NOTICE '⏳ הפונקציה רצה ברקע...';
  RAISE NOTICE '';
  RAISE NOTICE '💡 בדוק את התוצאות:';
  RAISE NOTICE '   1. בדוק את הלוגים:';
  RAISE NOTICE '      https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/update-earnings-results-live/logs';
  RAISE NOTICE '';
  RAISE NOTICE '   2. אחרי כמה שניות, בדוק את הטבלה earnings_calendar';
  RAISE NOTICE '      כדי לראות אם עודכנו רשומות';
  RAISE NOTICE '';
  RAISE NOTICE '✅ הפעלה הושלמה.';
END $$;

-- ============================================
-- 4. בדיקת רשומות שעודכנו לאחר ההפעלה
-- ============================================

SELECT 
  code,
  ticker,
  company_name,
  report_date,
  before_after_market,
  actual as eps_actual,
  estimate as eps_estimate,
  percent as eps_surprise_percent,
  revenue_actual,
  revenue_estimate_avg as revenue_estimate,
  revenue_surprise_percent,
  updated_at
FROM earnings_calendar
WHERE 
  report_date = CURRENT_DATE
  AND (actual IS NOT NULL OR revenue_actual IS NOT NULL)
  AND updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- 5. סטטיסטיקות סופיות
-- ============================================

SELECT 
  COUNT(*) as total_today,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_eps_actual,
  COUNT(CASE WHEN revenue_actual IS NOT NULL THEN 1 END) as with_revenue_actual,
  COUNT(CASE WHEN actual IS NOT NULL AND revenue_actual IS NOT NULL THEN 1 END) as with_both,
  MAX(updated_at) as last_updated
FROM earnings_calendar
WHERE report_date = CURRENT_DATE
  AND (actual IS NOT NULL OR revenue_actual IS NOT NULL);




