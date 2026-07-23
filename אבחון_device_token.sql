-- 🔍 אבחון Device Token - בדיקות מקיפות
-- ======================================

-- 1. בדוק אם יש device tokens בכלל במערכת
SELECT 
  'Device Tokens Overall' as check_type,
  COUNT(*) as total_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens
FROM device_tokens;

-- 2. בדוק אם המשתמש קיים
SELECT 
  'User Exists' as check_type,
  id,
  email,
  created_at,
  last_sign_in_at,
  CASE 
    WHEN last_sign_in_at IS NULL THEN 'Never signed in'
    WHEN last_sign_in_at > NOW() - INTERVAL '1 hour' THEN 'Signed in recently'
    ELSE 'Signed in long ago'
  END as sign_in_status
FROM auth.users
WHERE id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- 3. בדוק את כל ה-device tokens למשתמש הזה (גם לא פעילים)
SELECT 
  'User Device Tokens' as check_type,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  dt.updated_at,
  CASE 
    WHEN dt.is_active = false THEN 'Inactive - needs activation'
    WHEN dt.created_at < NOW() - INTERVAL '7 days' THEN 'Old token'
    ELSE 'Active and recent'
  END as token_status
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- 4. בדוק את כל ה-device tokens האחרונים במערכת
SELECT 
  'Recent Device Tokens' as check_type,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 10;

-- 5. בדוק אם יש device tokens לא פעילים שצריך להפעיל
SELECT 
  'Inactive Tokens' as check_type,
  dt.id,
  dt.user_id,
  dt.platform,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = false;

-- 6. בדוק את ה-RLS Policies על device_tokens
SELECT 
  'RLS Policies' as check_type,
  policyname,
  cmd as command,
  roles,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY cmd;

-- 7. בדוק אם הטבלה קיימת
SELECT 
  'Table Exists' as check_type,
  table_name,
  table_type,
  is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'device_tokens';

-- 8. בדוק הגדרות התראות למשתמש
SELECT 
  'Notification Settings' as check_type,
  uns.user_id,
  uns.notifications_enabled,
  uns.news_notifications,
  uns.sound_enabled,
  uns.created_at
FROM user_notification_settings uns
WHERE uns.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- 9. סטטיסטיקה כללית - משתמשים עם ובלי device tokens
SELECT 
  'Users Statistics' as check_type,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT dt.user_id) as users_with_tokens,
  COUNT(DISTINCT u.id) - COUNT(DISTINCT dt.user_id) as users_without_tokens,
  COUNT(DISTINCT dt.user_id) FILTER (WHERE dt.is_active = true) as users_with_active_tokens
FROM auth.users u
LEFT JOIN device_tokens dt ON u.id = dt.user_id;

-- 10. בדוק אם יש device tokens עם אותה פלטפורמה למשתמש
SELECT 
  'Platform Distribution' as check_type,
  dt.platform,
  COUNT(*) as token_count,
  COUNT(*) FILTER (WHERE dt.is_active = true) as active_count
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
GROUP BY dt.platform;



