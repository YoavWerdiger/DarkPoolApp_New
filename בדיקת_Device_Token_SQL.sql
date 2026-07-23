-- בדיקות לבעיית רישום Device Token

-- 1. בדוק אם הטבלה קיימת ונראית
SELECT * FROM device_tokens LIMIT 5;

-- 2. בדוק את ה-RLS policies (כבר בדקת - נראים תקינים)
SELECT * FROM pg_policies WHERE tablename = 'device_tokens';

-- 3. בדוק אם יש משתמשים מחוברים כרגע
SELECT auth.uid() as current_user_id;

-- 4. בדוק אם יש device tokens קיימים (אם יש, אולי המשתמש כבר רשום)
SELECT COUNT(*) as total_tokens, 
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(*) FILTER (WHERE is_active = true) as active_tokens
FROM device_tokens;

-- 5. בדוק את המבנה של הטבלה
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'device_tokens'
ORDER BY ordinal_position;

-- 6. נסה להוסיף device token ידנית (כדי לבדוק אם ה-RLS עובד)
-- החלף YOUR_USER_ID ב-user ID שלך
-- INSERT INTO device_tokens (user_id, expo_push_token, platform, is_active)
-- VALUES ('YOUR_USER_ID', 'ExponentPushToken[test123]', 'android', true);

-- 7. בדוק אם יש שגיאות ב-logs של Supabase
-- היכנס ל-Supabase Dashboard > Logs > Postgres Logs







