-- ✅ שליחת Push Notification לטוקן ספציפי
-- ===========================================
-- טוקן: ExponentPushToken[2vyBusP8YAUVCjygab20ta]
-- User ID: af781bb1-0529-4d80-9424-6564ec29457e

-- שלב 1: הוספת התראה ל-pending_notifications
INSERT INTO pending_notifications (
  user_id,
  title,
  body,
  notification_type,
  data,
  is_sent,
  created_at
) VALUES (
  'af781bb1-0529-4d80-9424-6564ec29457e',
  'בדיקת Push Notification 📱',
  'זוהי התראה לבדיקה - אם אתה רואה את זה, זה עובד!',
  'test',
  jsonb_build_object(
    'type', 'test',
    'timestamp', NOW()::text
  ),
  false,
  NOW()
)
RETURNING id, user_id, title, body, created_at;

-- שלב 2: בדיקה שההתראה נוספה
SELECT 
  '✅ התראה נוספה!' as status,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.is_sent = false
ORDER BY pn.created_at DESC
LIMIT 5;

-- שלב 3: בדיקה שיש device token פעיל
SELECT 
  '✅ Device Token פעיל!' as status,
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.updated_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- הערות:
-- ======
-- אחרי הרצת הסקריפט הזה, צריך להריץ את הפונקציה:
-- 1. דרך Supabase Dashboard > Edge Functions > process-pending-notifications > Invoke
-- 2. או דרך HTTP request:
--    POST https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications
--    Headers: Authorization: Bearer [SERVICE_ROLE_KEY]


