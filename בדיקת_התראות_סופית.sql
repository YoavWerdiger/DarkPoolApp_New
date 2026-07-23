-- 🔍 בדיקה סופית - התראות Push
-- =================================

-- בדיקה 1: האם יש device tokens פעילים?
SELECT 
  'בדיקה 1: Device Tokens פעילים' as check_name,
  COUNT(*) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens
WHERE is_active = true;

-- בדיקה 2: האם יש התראות ממתינות?
SELECT 
  'בדיקה 2: התראות ממתינות' as check_name,
  COUNT(*) as total_pending,
  COUNT(*) FILTER (WHERE is_sent = false) as unsent,
  COUNT(*) FILTER (WHERE is_sent = true) as sent
FROM pending_notifications;

-- בדיקה 3: התראות אחרונות (נשלחו)
SELECT 
  'בדיקה 3: התראות שנשלחו' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.sent_at,
  pn.created_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.is_sent = true
ORDER BY pn.sent_at DESC
LIMIT 10;

-- בדיקה 4: התראות שלא נשלחו
SELECT 
  'בדיקה 4: התראות שלא נשלחו' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.is_sent = false
ORDER BY pn.created_at DESC
LIMIT 10;

-- בדיקה 5: האם יש trigger?
SELECT 
  'בדיקה 5: Trigger קיים' as check_name,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'app_news'
  AND trigger_name = 'on_new_news_article';

-- בדיקה 6: האם יש RLS Policies על pending_notifications?
SELECT 
  'בדיקה 6: RLS Policies על pending_notifications' as check_name,
  policyname,
  cmd as command_type
FROM pg_policies
WHERE tablename = 'pending_notifications'
ORDER BY cmd;

-- בדיקה 7: משתמשים עם device tokens והגדרות התראות
SELECT 
  'בדיקה 7: משתמשים עם device tokens והגדרות' as check_name,
  dt.user_id,
  u.email,
  dt.is_active as device_token_active,
  uns.notifications_enabled,
  uns.news_notifications,
  uns.sound_enabled
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
LEFT JOIN user_notification_settings uns ON dt.user_id = uns.user_id
WHERE dt.is_active = true
ORDER BY dt.created_at DESC
LIMIT 10;


