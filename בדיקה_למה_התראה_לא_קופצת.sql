-- 🔍 בדיקה: למה ההתראה לא קופצת?
-- ===========================================

-- שלב 1: בדוק אם יש התראות ב-pending_notifications
SELECT 
  '📋 התראות ממתינות' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY pn.created_at DESC
LIMIT 10;

-- שלב 2: בדוק כמה התראות יש שלא נשלחו
SELECT 
  '📊 סיכום התראות' as check_name,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_sent = true) as sent,
  COUNT(*) FILTER (WHERE is_sent = false) as pending,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes') as recent
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- שלב 3: בדוק את כל הטוקנים הפעילים
SELECT 
  '📱 כל הטוקנים הפעילים' as check_name,
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  dt.updated_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 4: בדוק את ההגדרות של המשתמש
SELECT 
  '⚙️ הגדרות התראות' as check_name,
  uns.user_id,
  uns.notifications_enabled,
  uns.news_notifications,
  u.email
FROM user_notification_settings uns
LEFT JOIN auth.users u ON uns.user_id = u.id
WHERE uns.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- שלב 5: בדוק אם יש שגיאות ב-Edge Function
-- לך ל: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs


