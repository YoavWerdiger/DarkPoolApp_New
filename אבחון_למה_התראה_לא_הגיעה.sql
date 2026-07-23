-- 🔍 אבחון: למה ההתראה לא הגיעה למכשיר?
-- =======================================

-- בדיקה 1: האם ה-device token תקין?
SELECT 
  'בדיקה 1: Device Token' as check_name,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true;

-- בדיקה 2: האם יש התראות שנשלחו למשתמש הזה?
SELECT 
  'בדיקה 2: התראות שנשלחו' as check_name,
  pn.id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.sent_at,
  pn.created_at
FROM pending_notifications pn
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
ORDER BY pn.created_at DESC
LIMIT 5;


