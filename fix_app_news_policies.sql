-- תיקון מדיניות RLS עבור app_news
-- =======================================
-- הבעיה: רק משתמשים מאומתים יכולים להכניס חדשות, וזה חוסם את n8n
-- הפתרון: לאפשר גם ל-service_role להכניס נתונים, או לכבות RLS להכנסה

-- 1. מחיקת המדיניות הישנה
DROP POLICY IF EXISTS "Authenticated users can insert news" ON public.app_news;
DROP POLICY IF EXISTS "Authenticated users can update news" ON public.app_news;
DROP POLICY IF EXISTS "Authenticated users can delete news" ON public.app_news;

-- 2. יצירת מדיניות חדשה שמאפשרת גם ל-service_role להכניס נתונים
-- מדיניות INSERT - מאפשר למשתמשים מאומתים ו-service role
CREATE POLICY "Allow authenticated and service role to insert news" 
ON public.app_news
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' OR 
  auth.role() = 'service_role'
);

-- מדיניות UPDATE - מאפשר למשתמשים מאומתים ו-service role
CREATE POLICY "Allow authenticated and service role to update news" 
ON public.app_news
FOR UPDATE 
USING (
  auth.role() = 'authenticated' OR 
  auth.role() = 'service_role'
);

-- מדיניות DELETE - מאפשר למשתמשים מאומתים ו-service role
CREATE POLICY "Allow authenticated and service role to delete news" 
ON public.app_news
FOR DELETE 
USING (
  auth.role() = 'authenticated' OR 
  auth.role() = 'service_role'
);

-- 3. בדיקה שהמדיניות הוחלה בהצלחה
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
WHERE tablename = 'app_news'
ORDER BY policyname;

-- הודעת הצלחה
SELECT '✅ מדיניות RLS עבור app_news עודכנה בהצלחה!' as message;

-- 4. הסבר נוסף:
-- =================
-- אם עדיין יש בעיות, ייתכן שהבעיה היא ב-n8n configuration:
-- 
-- בדוק שב-n8n:
-- 1. משתמשים ב-service_role key (ולא ב-anon key)
-- 2. ה-Authorization header נכון
-- 3. ה-URL של Supabase נכון
-- 
-- דרך נוספת (לא מומלצת לייצור):
-- אפשר לכבות לגמרי את ה-RLS עבור INSERT:
-- ALTER TABLE public.app_news DISABLE ROW LEVEL SECURITY;

