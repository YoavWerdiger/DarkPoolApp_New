-- 🔍 בדיקה מהירה - למה אין device token?
-- ===========================================

-- בדיקה 1: האם יש device tokens בכלל במערכת?
SELECT 
  'בדיקה 1: Device Tokens במערכת' as check_name,
  COUNT(*) as total_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens
FROM device_tokens;

-- בדיקה 2: כמה משתמשים יש במערכת?
SELECT 
  'בדיקה 2: משתמשים במערכת' as check_name,
  COUNT(*) as total_users
FROM auth.users;

-- בדיקה 3: האם יש device tokens לא פעילים למשתמש?
-- החלף YOUR_USER_ID ב-user ID שלך
SELECT 
  'בדיקה 3: Device Tokens למשתמש (גם לא פעילים)' as check_name,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 20) || '...' as token,
  dt.platform,
  dt.is_active,
  dt.created_at
FROM device_tokens dt
WHERE dt.user_id = auth.uid() -- משתמש מחובר
ORDER BY dt.created_at DESC;

-- בדיקה 4: הצג את כל ה-device tokens האחרונים במערכת
SELECT 
  'בדיקה 4: Device Tokens האחרונים במערכת' as check_name,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 20) || '...' as token,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 10;

-- בדיקה 5: בדוק את ה-RLS Policies
SELECT 
  'בדיקה 5: RLS Policies' as check_name,
  policyname,
  cmd as command_type,
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

-- בדיקה 6: בדוק אם יש INSERT policy (הכי חשוב!)
SELECT 
  'בדיקה 6: וידוא INSERT Policy קיים' as check_name,
  COUNT(*) as insert_policies_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ יש INSERT policy'
    ELSE '❌ אין INSERT policy - זה הבעיה!'
  END as status
FROM pg_policies
WHERE tablename = 'device_tokens'
  AND cmd = 'INSERT';

-- בדיקה 7: בדוק את המבנה של הטבלה
SELECT 
  'בדיקה 7: מבנה הטבלה' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'device_tokens'
ORDER BY ordinal_position;


