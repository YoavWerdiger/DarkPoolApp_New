-- ✅ הפעלת התראות למשתמש
-- ===========================================
-- User ID: af781bb1-0529-4d80-9424-6564ec29457e

-- שלב 1: הפעלת התראות (אם יש הגדרות קיימות)
UPDATE user_notification_settings
SET 
  notifications_enabled = true,
  news_notifications = true
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- שלב 2: בדיקה שההגדרות עודכנו
SELECT 
  '✅ הגדרות עודכנו!' as check_name,
  uns.user_id,
  u.email,
  uns.notifications_enabled,
  uns.news_notifications,
  CASE 
    WHEN uns.notifications_enabled = true AND (uns.news_notifications = true OR uns.news_notifications IS NULL) THEN '✅ הכל פעיל - התראות יישלחו!'
    WHEN uns.notifications_enabled = false THEN '❌ התראות עדיין כבויות'
    ELSE '⚠️ בדוק את ההגדרות'
  END as status
FROM user_notification_settings uns
LEFT JOIN auth.users u ON uns.user_id = u.id
WHERE uns.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- שלב 3: אם אין הגדרות, יצירתן
-- (אם ה-UPDATE לא עבד, זה אומר שאין שורה - אז ניצור אחת)
INSERT INTO user_notification_settings (user_id, notifications_enabled, news_notifications)
VALUES ('af781bb1-0529-4d80-9424-6564ec29457e', true, true)
ON CONFLICT (user_id) 
DO UPDATE SET 
  notifications_enabled = true,
  news_notifications = true;

-- שלב 4: בדיקה סופית
SELECT 
  '✅ בדיקה סופית' as check_name,
  uns.user_id,
  u.email,
  uns.notifications_enabled,
  uns.news_notifications
FROM user_notification_settings uns
LEFT JOIN auth.users u ON uns.user_id = u.id
WHERE uns.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';


