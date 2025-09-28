-- בדיקה פשוטה של טבלת users
-- ================================

-- 1. בדיקה אם הטבלה קיימת
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'users'
) as table_exists;

-- 2. בדיקת מבנה הטבלה (פשוט)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 3. בדיקת מספר השורות
SELECT COUNT(*) as total_users FROM users;

-- 4. בדיקת דוגמה של שורות
SELECT id, full_name, profile_picture 
FROM users 
LIMIT 3;

-- 5. בדיקת המשתמש הנוכחי
SELECT current_user, session_user;

-- 6. בדיקה אם יש RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';

-- 7. בדיקת channel_members
SELECT COUNT(*) as total_members FROM channel_members;

-- 8. בדיקת קישור פשוט (ללא פילטר)
SELECT 
  cm.channel_id,
  cm.user_id,
  cm.role,
  u.full_name,
  u.profile_picture
FROM channel_members cm
LEFT JOIN users u ON cm.user_id = u.id
LIMIT 5;

-- 9. בדיקת ערוץ ספציפי (אם יש)
SELECT 
  channel_id,
  COUNT(*) as member_count
FROM channel_members 
GROUP BY channel_id 
ORDER BY member_count DESC 
LIMIT 3;

-- 10. בדיקת JOIN עם ערוץ ספציפי (הערוץ הראשון)
SELECT 
  cm.channel_id,
  cm.user_id,
  cm.role,
  u.full_name,
  u.profile_picture,
  u.phone
FROM channel_members cm
LEFT JOIN users u ON cm.user_id = u.id
WHERE cm.channel_id = 'df6478e7-9929-4108-8f42-d51861890806'
LIMIT 10;
