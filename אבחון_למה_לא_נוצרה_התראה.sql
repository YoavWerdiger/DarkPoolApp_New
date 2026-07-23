-- 🔍 אבחון: למה לא נוצרה התראה?
-- ================================

-- בדיקה 1: האם ה-trigger קיים?
SELECT 
  'בדיקה 1: Trigger' as check_name,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'app_news_clean'
  AND trigger_name = 'on_new_news_article';

-- בדיקה 2: האם הפונקציה קיימת?
SELECT 
  'בדיקה 2: הפונקציה קיימת' as check_name,
  proname as function_name,
  CASE 
    WHEN proname IS NOT NULL THEN '✅ קיימת'
    ELSE '❌ לא קיימת'
  END as status
FROM pg_proc
WHERE proname = 'send_news_notification_immediately';

-- בדיקה 3: האם יש device tokens פעילים?
SELECT 
  'בדיקה 3: Device Tokens' as check_name,
  COUNT(*) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ יש device tokens'
    ELSE '❌ אין device tokens - זה הבעיה!'
  END as status
FROM device_tokens
WHERE is_active = true;

-- בדיקה 4: האם יש הגדרות משתמש?
SELECT 
  'בדיקה 4: הגדרות משתמש' as check_name,
  COUNT(*) as total_settings,
  COUNT(*) FILTER (WHERE news_notifications = true) as news_enabled,
  COUNT(*) FILTER (WHERE notifications_enabled = true) as all_enabled
FROM user_notification_settings;

-- בדיקה 5: בדוק את הלוגים - האם יש שגיאות?
-- (צריך לבדוק ב-Supabase Dashboard > Logs > Postgres Logs)

-- בדיקה 6: נסה להריץ את הפונקציה ידנית (אם יש חדשה אחרונה)
SELECT 
  'בדיקה 6: חדשה אחרונה' as check_name,
  id,
  label,
  LEFT(text, 50) || '...' as text_preview,
  source,
  created_at
FROM app_news_clean
ORDER BY created_at DESC
LIMIT 1;

-- בדיקה 7: בדוק אם יש התראות בכלל ב-pending_notifications
SELECT 
  'בדיקה 7: התראות קיימות' as check_name,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_sent = false) as pending,
  COUNT(*) FILTER (WHERE is_sent = true) as sent,
  MAX(created_at) as last_notification
FROM pending_notifications;


