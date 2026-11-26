-- ✅ וידוא שהכל תקין - Device Tokens
-- =====================================

-- 1. וידוא שהטבלה קיימת עם כל העמודות הנדרשות
SELECT 
  '1. בדיקת מבנה הטבלה' as step,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'device_tokens'
ORDER BY ordinal_position;

-- 2. וידוא שיש RLS Policies תקינים
SELECT 
  '2. בדיקת RLS Policies' as step,
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

-- 3. וידוא שיש INSERT policy (הכי חשוב!)
SELECT 
  '3. וידוא INSERT Policy קיים' as step,
  COUNT(*) as insert_policies_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ יש INSERT policy'
    ELSE '❌ אין INSERT policy - זה הבעיה!'
  END as status
FROM pg_policies
WHERE tablename = 'device_tokens'
  AND cmd = 'INSERT';

-- 4. אם אין INSERT policy, זה יצור אותו
-- ⚠️ הרץ רק אם אין INSERT policy!
-- 
-- CREATE POLICY "Users can insert their own device tokens"
--   ON public.device_tokens
--   FOR INSERT
--   WITH CHECK (auth.uid() = user_id);

-- 5. בדיקה: כמה משתמשים יש והאם יש להם tokens
SELECT 
  '4. סטטיסטיקת משתמשים' as step,
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM device_tokens) as users_with_tokens,
  (SELECT COUNT(*) FROM device_tokens WHERE is_active = true) as active_tokens;

-- 6. הצג את כל ה-RLS Policies עם הפרטים המלאים
SELECT 
  '5. פירוט מלא של RLS Policies' as step,
  policyname,
  cmd,
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as has_with_check,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'device_tokens';



