-- 🔍 בדיקה מדויקת של ההגדרות
-- ===========================================

-- שלב 1: בדוק את ההגדרות של כל המשתמשים
SELECT 
  '⚙️ הגדרות התראות - פירוט' as check_name,
  uns.user_id,
  u.email,
  uns.notifications_enabled,
  uns.news_notifications,
  CASE 
    WHEN uns.notifications_enabled = false THEN '❌ התראות כבויות - לא יישלחו התראות!'
    WHEN uns.notifications_enabled = true OR uns.notifications_enabled IS NULL THEN 
      CASE 
        WHEN uns.news_notifications = false THEN '⚠️ התראות פעילות אבל חדשות כבויות'
        WHEN uns.news_notifications = true OR uns.news_notifications IS NULL THEN '✅ הכל פעיל - התראות יישלחו'
        ELSE '❓ לא ברור'
      END
    ELSE '❓ לא ברור'
  END as status
FROM user_notification_settings uns
LEFT JOIN auth.users u ON uns.user_id = u.id
ORDER BY uns.user_id;

-- שלב 2: בדוק כמה device tokens יש לכל משתמש
SELECT 
  '📱 Device Tokens לפי משתמש' as check_name,
  dt.user_id,
  u.email,
  COUNT(*) as active_tokens,
  STRING_AGG(LEFT(dt.expo_push_token, 30) || '...', ', ') as tokens_preview
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
WHERE dt.is_active = true
GROUP BY dt.user_id, u.email
ORDER BY dt.user_id;

-- שלב 3: הפעלת התראות למשתמש (אם צריך)
-- ⚠️ החלף את ה-user_id שלך!
-- UPDATE user_notification_settings
-- SET notifications_enabled = true
-- WHERE user_id = 'YOUR_USER_ID_HERE';

-- שלב 4: בדוק אם יש משתמשים בלי הגדרות (ברירת מחדל - הכל פעיל)
SELECT 
  '👥 משתמשים בלי הגדרות' as check_name,
  dt.user_id,
  u.email,
  COUNT(*) as active_tokens
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
LEFT JOIN user_notification_settings uns ON dt.user_id = uns.user_id
WHERE dt.is_active = true
  AND uns.user_id IS NULL
GROUP BY dt.user_id, u.email
ORDER BY dt.user_id;


