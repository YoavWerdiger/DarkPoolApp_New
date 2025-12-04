-- 🔧 פתרון: טוקנים לא תקינים או פג תוקף
-- ===========================================

-- שלב 1: בדוק את כל הטוקנים הפעילים
SELECT 
  '📱 כל הטוקנים הפעילים' as check_name,
  dt.id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  dt.updated_at,
  EXTRACT(EPOCH FROM (NOW() - dt.created_at)) / 86400 as days_old,
  CASE 
    WHEN dt.expo_push_token LIKE 'ExponentPushToken[%]' THEN '✅ פורמט תקין'
    ELSE '⚠️ פורמט לא תקין'
  END as token_format_check
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 2: אם הטוקנים פג תוקף, אפשר לסמן אותם כלא פעילים
-- ⚠️ זה ימחק את הטוקנים הישנים - רק אם אתה בטוח!
-- UPDATE device_tokens
-- SET is_active = false
-- WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
--   AND created_at < NOW() - INTERVAL '30 days';

-- 💡 פתרונות:
-- ============
-- 1. התחבר מחדש לאפליקציה - זה ירענן את הטוקנים
-- 2. בדוק את הלוגים המלאים של Edge Function - מה התשובה מ-Expo Push API?
-- 3. אם התשובה היא "DeviceNotRegistered" - הטוקן פג תוקף, צריך להתחבר מחדש
-- 4. אם התשובה היא "InvalidCredentials" - יש בעיה בהגדרות Expo/Firebase

-- שלב 3: בדוק כמה התראות נשלחו בהצלחה
SELECT 
  '📊 סיכום התראות' as check_name,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '1 hour') as sent_last_hour,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '1 hour') as pending_last_hour
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';


