-- 🔍 בדיקה מהירה - האם הטריגר קיים?
-- ===========================================

-- שלב 1: בדוק אם הטריגר קיים
SELECT 
  '🔍 בדיקת טריגר' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ הטריגר קיים!'
    ELSE '❌ הטריגר לא קיים - צריך ליצור אותו'
  END as status,
  COUNT(*) as trigger_count
FROM information_schema.triggers tg
WHERE tg.event_object_table = 'app_news_clean'
  AND tg.event_object_schema = 'public'
  AND tg.trigger_name = 'on_new_news_article';

-- שלב 2: בדוק אם הפונקציה קיימת
SELECT 
  '🔍 בדיקת פונקציה' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ הפונקציה קיימת!'
    ELSE '❌ הפונקציה לא קיימת - צריך ליצור אותה'
  END as status,
  COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'send_news_notification_immediately';

-- שלב 3: בדוק כמה device tokens פעילים יש
SELECT 
  '📱 Device Tokens פעילים' as check_name,
  COUNT(*) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens
WHERE is_active = true;

-- שלב 4: בדוק את ההגדרות של המשתמשים
SELECT 
  '⚙️ הגדרות התראות' as check_name,
  COUNT(*) as total_settings,
  COUNT(*) FILTER (WHERE notifications_enabled = true OR notifications_enabled IS NULL) as enabled,
  COUNT(*) FILTER (WHERE news_notifications = true OR news_notifications IS NULL) as news_enabled
FROM user_notification_settings;

-- 💡 אם הטריגר לא קיים, הרץ את: תיקון_וטריגר_חדשות.sql


