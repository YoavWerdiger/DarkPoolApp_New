-- 🔍 בדיקה מהירה: למה הטוקן לא נשמר?
-- ===========================================

-- 1. בדוק אם יש טוקנים במסד הנתונים
SELECT 
  '📊 סיכום טוקנים' as check_name,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens;

-- 2. בדוק את הטוקנים האחרונים (אם יש)
SELECT 
  '📱 טוקנים אחרונים' as check_name,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.platform,
  dt.device_id,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 10;

-- 3. בדוק RLS Policies
SELECT 
  '🔒 RLS Policies' as check_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY policyname;

-- 4. בדוק אם יש משתמשים מחוברים
SELECT 
  '👤 משתמשים' as check_name,
  COUNT(*) as total_users
FROM auth.users;

-- 5. בדוק אם יש משתמשים עם טוקנים
SELECT 
  '🔗 משתמשים עם טוקנים' as check_name,
  COUNT(DISTINCT dt.user_id) as users_with_tokens,
  COUNT(DISTINCT u.id) as total_users,
  ROUND(COUNT(DISTINCT dt.user_id)::numeric / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 2) as percentage
FROM auth.users u
LEFT JOIN device_tokens dt ON u.id = dt.user_id AND dt.is_active = true;


