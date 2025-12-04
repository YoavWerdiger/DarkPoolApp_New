-- 🔍 בדיקה מקיפה - ללא תלות במשתמש מחובר
-- ============================================
-- זה הסקריפט הנכון להרצה ב-SQL Editor

-- בדיקה 1: כמה device tokens יש במערכת?
SELECT 
  'בדיקה 1: Device Tokens במערכת' as check_name,
  COUNT(*) as total_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens
FROM device_tokens;

-- בדיקה 2: כמה משתמשים יש במערכת?
SELECT 
  'בדיקה 2: משתמשים במערכת' as check_name,
  COUNT(*) as total_users
FROM auth.users;

-- בדיקה 3: האם יש RLS Policies?
SELECT 
  'בדיקה 3: RLS Policies' as check_name,
  policyname,
  cmd as command_type,
  roles,
  CASE 
    WHEN cmd = 'INSERT' THEN '✅ קריטי - צריך להיות!'
    WHEN cmd = 'SELECT' THEN '✅ חשוב'
    WHEN cmd = 'UPDATE' THEN '✅ חשוב'
    WHEN cmd = 'DELETE' THEN '⚪ אופציונלי'
    ELSE '❓ לא ידוע'
  END as importance
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY 
  CASE cmd
    WHEN 'INSERT' THEN 1
    WHEN 'SELECT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
    ELSE 5
  END;

-- בדיקה 4: האם יש INSERT policy? (הכי חשוב!)
SELECT 
  'בדיקה 4: INSERT Policy' as check_name,
  COUNT(*) as insert_policies_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ יש INSERT policy'
    ELSE '❌ אין INSERT policy - זה הבעיה!'
  END as status,
  STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE tablename = 'device_tokens'
  AND cmd = 'INSERT';

-- בדיקה 5: האם RLS מופעל על הטבלה?
SELECT 
  'בדיקה 5: RLS Status' as check_name,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ RLS מופעל'
    ELSE '❌ RLS לא מופעל - זה בעיה!'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'device_tokens';

-- בדיקה 6: הצג את כל ה-device tokens האחרונים במערכת
SELECT 
  'בדיקה 6: Device Tokens האחרונים' as check_name,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 10;

-- בדיקה 7: סטטיסטיקה - משתמשים עם ובלי device tokens
SELECT 
  'בדיקה 7: סטטיסטיקת משתמשים' as check_name,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT dt.user_id) as users_with_tokens,
  COUNT(DISTINCT u.id) - COUNT(DISTINCT dt.user_id) as users_without_tokens,
  COUNT(DISTINCT dt.user_id) FILTER (WHERE dt.is_active = true) as users_with_active_tokens
FROM auth.users u
LEFT JOIN device_tokens dt ON u.id = dt.user_id;

-- בדיקה 8: משתמשים ללא device tokens (אלה שצריכים לרשום)
SELECT 
  'בדיקה 8: משתמשים ללא device tokens' as check_name,
  u.id,
  u.email,
  u.created_at as user_created_at,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN device_tokens dt ON u.id = dt.user_id
WHERE dt.id IS NULL
ORDER BY u.last_sign_in_at DESC NULLS LAST
LIMIT 10;


