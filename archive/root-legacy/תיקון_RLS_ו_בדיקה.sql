-- 🔧 תיקון RLS Policies ו-בדיקה
-- ===========================================

-- שלב 1: בדוק את ה-RLS Policies הקיימים
SELECT 
  '🔒 RLS Policies קיימים' as check_name,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY policyname;

-- שלב 2: וודא ש-RLS מופעל
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- שלב 3: מחיקת פוליסיות קיימות (אם קיימות)
DROP POLICY IF EXISTS "Users can view their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can insert their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can update their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can delete their own device tokens" ON public.device_tokens;

-- שלב 4: יצירת פוליסיות חדשות
-- משתמשים יכולים לראות רק את ה-tokens שלהם
CREATE POLICY "Users can view their own device tokens"
  ON public.device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- משתמשים יכולים להוסיף tokens שלהם
CREATE POLICY "Users can insert their own device tokens"
  ON public.device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- משתמשים יכולים לעדכן tokens שלהם
CREATE POLICY "Users can update their own device tokens"
  ON public.device_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- משתמשים יכולים למחוק tokens שלהם
CREATE POLICY "Users can delete their own device tokens"
  ON public.device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- שלב 5: וידוא שהפוליסיות נוצרו
SELECT 
  '✅ פוליסיות אחרי תיקון' as check_name,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ SELECT policy exists'
    WHEN cmd = 'INSERT' THEN '✅ INSERT policy exists'
    WHEN cmd = 'UPDATE' THEN '✅ UPDATE policy exists'
    WHEN cmd = 'DELETE' THEN '✅ DELETE policy exists'
  END as status
FROM pg_policies
WHERE tablename = 'device_tokens'
ORDER BY cmd;

-- שלב 6: בדיקת מבנה הטבלה
SELECT 
  '📋 מבנה הטבלה' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'device_tokens'
  AND table_schema = 'public'
ORDER BY ordinal_position;


