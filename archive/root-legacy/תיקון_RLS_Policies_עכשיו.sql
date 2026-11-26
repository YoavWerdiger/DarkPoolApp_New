-- 🔧 תיקון RLS Policies - וידוא שהכל תקין
-- ===========================================
-- הרץ את זה אם אין INSERT policy או אם יש בעיה

-- שלב 1: וידוא ש-RLS מופעל
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- שלב 2: מחיקת פוליסיות קיימות (אם קיימות) - כדי ליצור מחדש
DROP POLICY IF EXISTS "Users can view their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can insert their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can update their own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can delete their own device tokens" ON public.device_tokens;

-- שלב 3: יצירת פוליסיות חדשות

-- משתמשים יכולים לראות רק את ה-tokens שלהם
CREATE POLICY "Users can view their own device tokens"
  ON public.device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- משתמשים יכולים להוסיף tokens שלהם (הכי חשוב!)
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

-- שלב 4: וידוא שהפוליסיות נוצרו
SELECT 
  'וידוא: RLS Policies נוצרו' as check_name,
  policyname,
  cmd as command_type,
  CASE 
    WHEN cmd = 'INSERT' THEN '✅ קריטי'
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


