-- 🔍 בדיקת התראות אחרי הוספת חדשה
-- ====================================

-- בדיקה 1: האם נוצרו התראות ב-pending_notifications?
SELECT 
  'בדיקה 1: התראות שנוצרו' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY pn.created_at DESC
LIMIT 10;

-- בדיקה 2: כמה התראות יש בסך הכל?
SELECT 
  'בדיקה 2: סך הכל התראות' as check_name,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_sent = false) as pending,
  COUNT(*) FILTER (WHERE is_sent = true) as sent
FROM pending_notifications
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- בדיקה 3: האם יש device tokens פעילים?
SELECT 
  'בדיקה 3: Device Tokens פעילים' as check_name,
  COUNT(*) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens
WHERE is_active = true;

-- בדיקה 4: האם ה-trigger קיים?
SELECT 
  'בדיקה 4: Trigger קיים' as check_name,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'app_news_clean'
  AND trigger_name = 'on_new_news_article';

-- בדיקה 5: חדשות אחרונות שנוספו
SELECT 
  'בדיקה 5: חדשות אחרונות' as check_name,
  id,
  label,
  LEFT(text, 50) || '...' as text_preview,
  source,
  time,
  created_at
FROM app_news_clean
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;


