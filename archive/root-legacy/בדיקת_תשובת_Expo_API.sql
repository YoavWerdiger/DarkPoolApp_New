-- 🔍 בדיקת מה קרה עם ההתראה
-- ===========================================

-- שלב 1: בדוק את ההתראות האחרונות
SELECT 
  '📋 התראות אחרונות' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  EXTRACT(EPOCH FROM (COALESCE(pn.sent_at, NOW()) - pn.created_at)) as seconds_until_sent
FROM pending_notifications pn
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY pn.created_at DESC
LIMIT 10;

-- שלב 2: בדוק את הטוקנים הפעילים
SELECT 
  '📱 טוקנים פעילים' as check_name,
  dt.id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  dt.updated_at,
  -- בדוק אם הטוקן נראה תקין
  CASE 
    WHEN dt.expo_push_token LIKE 'ExponentPushToken[%]' THEN '✅ פורמט תקין'
    ELSE '⚠️ פורמט לא תקין'
  END as token_format_check
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 3: בדוק אם יש התראות שלא נשלחו
SELECT 
  '⚠️ התראות שלא נשלחו' as check_name,
  COUNT(*) as count_not_sent
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND is_sent = false
  AND created_at > NOW() - INTERVAL '10 minutes';


