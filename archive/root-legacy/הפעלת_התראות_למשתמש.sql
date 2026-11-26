-- ✅ הפעלת התראות למשתמש
-- ===========================================
-- ⚠️ החלף את ה-user_id שלך!

-- שלב 1: בדוק את ה-user_id שלך
SELECT 
  '👤 המשתמש שלך' as check_name,
  u.id as user_id,
  u.email,
  uns.notifications_enabled,
  uns.news_notifications
FROM auth.users u
LEFT JOIN user_notification_settings uns ON u.id = uns.user_id
WHERE u.email = 'your-email@example.com'; -- ⚠️ החלף למייל שלך!

-- שלב 2: הפעלת התראות (אם יש הגדרות קיימות)
-- UPDATE user_notification_settings
-- SET 
--   notifications_enabled = true,
--   news_notifications = true
-- WHERE user_id = 'YOUR_USER_ID_HERE';

-- שלב 3: יצירת הגדרות אם לא קיימות
-- INSERT INTO user_notification_settings (user_id, notifications_enabled, news_notifications)
-- VALUES ('YOUR_USER_ID_HERE', true, true)
-- ON CONFLICT (user_id) 
-- DO UPDATE SET 
--   notifications_enabled = true,
--   news_notifications = true;


