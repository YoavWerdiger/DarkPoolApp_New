-- ============================================
-- בדיקת התראות דיווחי Earnings
-- ============================================
-- 
-- סקריפט זה מפעיל את הפונקציות להתראות
-- ומציג את התוצאות

-- ============================================
-- 1. הפעלת בדיקת דיווחים קרובים
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  RAISE NOTICE '🔄 מפעיל בדיקת דיווחים קרובים...';
  
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ קריאה נשלחה. Request ID: %', http_response_id;
  RAISE NOTICE '⏳ הפונקציה רצה ברקע...';
  RAISE NOTICE '';
  RAISE NOTICE '💡 בדוק את הלוגים:';
  RAISE NOTICE '      https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/earnings-notifications/logs';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 2. הפעלת בדיקת תוצאות שפורסמו
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  RAISE NOTICE '🔄 מפעיל בדיקת תוצאות שפורסמו...';
  
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ קריאה נשלחה. Request ID: %', http_response_id;
  RAISE NOTICE '⏳ הפונקציה רצה ברקע...';
  RAISE NOTICE '';
  RAISE NOTICE '💡 בדוק את הלוגים:';
  RAISE NOTICE '      https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/earnings-results-notifications/logs';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 3. בדיקת התראות שנוצרו
-- ============================================

SELECT 
  id,
  user_id,
  notification_type,
  title,
  body,
  is_sent,
  created_at
FROM pending_notifications
WHERE notification_type = 'earnings'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 4. סטטיסטיקות
-- ============================================

SELECT 
  COUNT(*) as total_earnings_notifications,
  COUNT(*) FILTER (WHERE is_sent = true) as sent,
  COUNT(*) FILTER (WHERE is_sent = false) as pending,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour
FROM pending_notifications
WHERE notification_type = 'earnings';





