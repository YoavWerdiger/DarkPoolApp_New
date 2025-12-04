-- 🔍 בדיקת RLS Policies
-- ===========================================

-- בדוק את ה-RLS Policies הקיימים
SELECT 
  '🔒 RLS Policies' as check_name,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ SELECT policy exists'
    WHEN cmd = 'INSERT' THEN '✅ INSERT policy exists'
    WHEN cmd = 'UPDATE' THEN '✅ UPDATE policy exists'
    WHEN cmd = 'DELETE' THEN '✅ DELETE policy exists'
    ELSE '❓ Unknown command'
  END as status,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY cmd;

-- בדוק אם RLS מופעל
SELECT 
  '🔒 RLS Status' as check_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'device_tokens';
