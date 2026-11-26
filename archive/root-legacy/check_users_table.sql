-- בדיקת טבלת users ו-RLS
-- ================================

-- 1. בדיקת מבנה הטבלה
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. בדיקת RLS על הטבלה
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';

-- 3. בדיקת Policies על הטבלה
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users';

-- 4. בדיקת תוכן הטבלה (ללא RLS)
SELECT COUNT(*) as total_users FROM users;

-- 5. בדיקת משתמשים ספציפיים
SELECT 
    id,
    full_name,
    profile_picture,
    phone,
    display_name,
    created_at
FROM users 
LIMIT 5;

-- 6. בדיקת גישה עם המשתמש הנוכחי
-- (הרץ את זה עם המשתמש המחובר)
SELECT 
    current_user,
    session_user,
    current_setting('role');

-- 7. בדיקת RLS מופעל/מושבת
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';

-- 8. בדיקת הרשאות
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'users';

-- 9. בדיקת קישור בין channel_members ל-users
SELECT 
    cm.channel_id,
    cm.user_id,
    cm.role,
    u.full_name,
    u.profile_picture
FROM channel_members cm
LEFT JOIN users u ON cm.user_id = u.id
WHERE cm.channel_id = 'YOUR_CHANNEL_ID_HERE'
LIMIT 5;

-- 10. בדיקת RLS על channel_members
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'channel_members';
