-- ============================================
-- הפעלת עדכון תוצאות earnings בלייב
-- ============================================
-- 
-- סקריפט זה מפעיל את הפונקציה update-earnings-results-live
-- שמביאה תוצאות בפועל (actuals) מ-earningshub.com ומעדכנת את הטבלה
--
-- הפונקציה משתמשת ב-endpoint: update_actuals_for_today
-- ומעדכנת רק דיווחים של היום
--
-- הערה: הפונקציה בודקת אם זה בשעות דיווחים (15:30-17:00 או 22:30-00:00 שעון ישראל)
-- אם לא, היא תדלג על העדכון
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. הפעלה ידנית של הפונקציה
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
-- 2. בדיקת רשומות שעודכנו לאחרונה
-- ============================================

SELECT 
  code,
  ticker,
  company_name,
  report_date,
  actual as eps_actual,
  estimate as eps_estimate,
  percent as eps_surprise_percent,
  revenue_actual,
  revenue_estimate_avg,
  revenue_surprise_percent,
  before_after_market,
  updated_at
FROM earnings_calendar
WHERE 
  (actual IS NOT NULL OR revenue_actual IS NOT NULL)
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- 3. סטטיסטיקות עדכון
-- ============================================

SELECT 
  COUNT(*) as total_with_actuals,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_eps_actual,
  COUNT(CASE WHEN revenue_actual IS NOT NULL THEN 1 END) as with_revenue_actual,
  COUNT(CASE WHEN actual IS NOT NULL AND revenue_actual IS NOT NULL THEN 1 END) as with_both,
  MAX(updated_at) as last_updated
FROM earnings_calendar
WHERE 
  (actual IS NOT NULL OR revenue_actual IS NOT NULL)
  AND report_date >= CURRENT_DATE - INTERVAL '7 days';





