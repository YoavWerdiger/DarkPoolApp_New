-- 🔍 בדיקת טוקנים ותשובת Expo Push API
-- ===========================================

-- שלב 1: בדוק את כל הטוקנים הפעילים
SELECT 
  '📱 כל הטוקנים הפעילים' as check_name,
  dt.id,
  dt.user_id,
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
  END as token_format_check,
  -- בדוק כמה זמן הטוקן קיים
  EXTRACT(EPOCH FROM (NOW() - dt.created_at)) / 86400 as days_old
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 2: בדוק את ההתראה האחרונה
SELECT 
  '📋 התראה אחרונה' as check_name,
  pn.id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at,
  pn.sent_at
FROM pending_notifications pn
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.notification_type = 'news'
ORDER BY pn.created_at DESC
LIMIT 1;

-- 💡 הערות:
-- ==========
-- אם הלוגים מראים "Sent 0/1 notifications", זה אומר:
-- 1. הטוקנים לא תקינים או פג תוקף
-- 2. יש בעיה ב-Expo Push API
-- 3. צריך לבדוק את הלוגים המלאים של Edge Function - שם תראה את התשובה מ-Expo Push API
-- 
-- לך ל: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs
-- שם תראה:
--   - "📥 Expo Push API response:" - התשובה המלאה מ-Expo
--   - אם יש שגיאות, הן יופיעו שם
--
-- פתרונות אפשריים:
-- 1. התחבר מחדש לאפליקציה - זה ירענן את הטוקנים
-- 2. בדוק שהטוקנים לא פג תוקף (אם הם ישנים מדי)
-- 3. בדוק את הלוגים המלאים - מה התשובה מ-Expo Push API?


