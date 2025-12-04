-- 🧪 בדיקת התראות Push - שאילתות מהירות
-- =========================================

-- 1. בדוק שיש לך device token פעיל
-- החלף YOUR_USER_ID באיידי המשתמש שלך
SELECT 
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at
FROM device_tokens dt
WHERE dt.user_id = 'YOUR_USER_ID_HERE'
  AND dt.is_active = true;

-- או לפי אימייל:
SELECT 
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.is_active,
  u.email
FROM device_tokens dt
JOIN auth.users u ON dt.user_id = u.id
WHERE u.email = 'YOUR_EMAIL@example.com'
  AND dt.is_active = true;

-- 2. בדוק את ההגדרות שלך
SELECT 
  user_id,
  notifications_enabled,
  news_notifications,
  earnings_notifications,
  economic_calendar_notifications,
  message_notifications
FROM user_notification_settings
WHERE user_id = 'YOUR_USER_ID_HERE';

-- 3. הוסף חדשה חדשה לבדיקה
INSERT INTO app_news (
  title,
  content,
  source,
  label,
  text_content,
  summary
)
VALUES (
  '🧪 בדיקת התראות Push - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  'זו חדשה חדשה לבדיקת מערכת התראות Push. אם אתה רואה את זה, המשמעות היא שהמערכת עובדת!',
  'מערכת בדיקה',
  'בדיקת התראות',
  'זו חדשה חדשה לבדיקת מערכת התראות Push',
  'בדיקה'
)
RETURNING id, title, created_at;

-- 4. בדוק שההתראות נוצרו (הרץ 5-10 שניות אחרי הוספת החדשה)
SELECT 
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  u.email as user_email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.notification_type = 'news'
  AND pn.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY pn.created_at DESC;

-- 5. בדוק את כל ההתראות האחרונות
SELECT 
  pn.id,
  pn.user_id,
  pn.title,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  CASE 
    WHEN pn.sent_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (pn.sent_at - pn.created_at))
    ELSE NULL
  END as seconds_to_send,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
ORDER BY pn.created_at DESC
LIMIT 20;

-- 6. בדיקה: כבה התראות חדשות למשתמש ספציפי (לבדיקה הפוכה)
UPDATE user_notification_settings
SET news_notifications = false
WHERE user_id = 'YOUR_USER_ID_HERE';

-- 7. בדיקה: הפעל שוב התראות חדשות
UPDATE user_notification_settings
SET news_notifications = true
WHERE user_id = 'YOUR_USER_ID_HERE';

-- 8. סטטיסטיקה כללית
SELECT 
  'Device Tokens' as metric,
  COUNT(*) FILTER (WHERE is_active = true) as active_count,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_count,
  COUNT(*) as total
FROM device_tokens
UNION ALL
SELECT 
  'Notification Settings' as metric,
  COUNT(*) FILTER (WHERE news_notifications = true) as wants_news,
  COUNT(*) FILTER (WHERE news_notifications = false) as doesnt_want_news,
  COUNT(*) as total
FROM user_notification_settings
UNION ALL
SELECT 
  'Pending Notifications' as metric,
  COUNT(*) FILTER (WHERE is_sent = true) as sent,
  COUNT(*) FILTER (WHERE is_sent = false) as pending,
  COUNT(*) as total
FROM pending_notifications;

-- 9. בדוק את הטריגר
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled
    WHEN 'O' THEN 'Enabled'
    WHEN 'D' THEN 'Disabled'
    ELSE 'Unknown'
  END as status
FROM pg_trigger
WHERE tgname = 'on_new_news_article';

-- 10. בדוק את הפונקציה
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'send_news_notification_immediately';



