-- 🔍 בדיקה אחרי הוספת חדשה דמה
-- ===========================================

-- שלב 1: בדוק את החדשה האחרונה שנוספה
SELECT 
  '📰 החדשה האחרונה' as check_name,
  anc.id,
  anc.label,
  LEFT(anc.text, 50) || '...' as text_preview,
  anc.source,
  anc.time,
  anc.created_at
FROM app_news_clean anc
WHERE anc.id LIKE 'test_%'
ORDER BY anc.created_at DESC
LIMIT 3;

-- שלב 2: בדוק אם נוצרה התראה ב-pending_notifications
SELECT 
  '📋 התראות שנוצרו' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  u.email as user_email,
  CASE 
    WHEN pn.is_sent = true THEN '✅ נשלחה'
    WHEN pn.is_sent = false AND pn.created_at > NOW() - INTERVAL '5 minutes' THEN '⏳ ממתינה לשליחה'
    ELSE '⚠️ ישנה'
  END as status
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '5 minutes'
  AND pn.notification_type = 'news'
ORDER BY pn.created_at DESC;

-- שלב 3: בדוק כמה התראות יש בסך הכל (לאחרונה)
SELECT 
  '📊 סיכום התראות' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '5 minutes') as pending_now,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '5 minutes') as sent_recently,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as total_recent
FROM pending_notifications
WHERE created_at > NOW() - INTERVAL '5 minutes'
  AND notification_type = 'news';

-- שלב 4: בדוק אם הטריגר קיים
SELECT 
  '🔍 בדיקת טריגר' as check_name,
  tg.trigger_name,
  tg.event_manipulation as event,
  tg.action_timing as timing,
  tg.action_statement as function_name
FROM information_schema.triggers tg
WHERE tg.event_object_table = 'app_news_clean'
  AND tg.event_object_schema = 'public';

-- שלב 5: בדוק כמה device tokens פעילים יש
SELECT 
  '📱 Device Tokens פעילים' as check_name,
  COUNT(*) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens
WHERE is_active = true;


