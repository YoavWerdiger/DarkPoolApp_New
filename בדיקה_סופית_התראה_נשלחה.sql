-- ✅ בדיקה סופית - האם ההתראה הגיעה למכשיר?
-- ===========================================

-- שלב 1: בדוק את ההתראה האחרונה שנשלחה
SELECT 
  '📋 התראה אחרונה שנשלחה' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  EXTRACT(EPOCH FROM (pn.sent_at - pn.created_at)) as seconds_to_send,
  u.email as user_email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.notification_type = 'news'
  AND pn.is_sent = true
ORDER BY pn.sent_at DESC
LIMIT 1;

-- שלב 2: בדוק כמה device tokens פעילים יש
SELECT 
  '📱 Device Tokens פעילים' as check_name,
  dt.id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.updated_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 3: סיכום כל ההתראות שנשלחו לאחרונה
SELECT 
  '📊 סיכום התראות שנשלחו' as check_name,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '1 hour') as sent_last_hour,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '10 minutes') as sent_last_10min,
  COUNT(*) FILTER (WHERE notification_type = 'news' AND is_sent = true AND sent_at > NOW() - INTERVAL '10 minutes') as news_sent_last_10min
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- 💡 הערות:
-- ==========
-- 1. אם ההתראה נשלחה (is_sent = true), זה אומר שה-Edge Function רץ
-- 2. בדוק את המכשיר - האם ההתראה הגיעה?
-- 3. בדוק את הלוגים של Edge Function: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs
-- 4. אם הלוגים מראים "Sent 0/X notifications", זה אומר שהטוקנים לא תקינים או פג תוקף


