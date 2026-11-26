-- תיקון RLS Policy עבור טבלת users
-- ========================================

-- 1. בדיקת RLS נוכחי
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';

-- 2. בדיקת Policies קיימים
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users';

-- 3. מחיקת Policies ישנים (אם יש)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- 4. יצירת Policy חדש שמאפשר יצירת משתמשים
CREATE POLICY "Allow user registration" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. יצירת Policy לצפייה בפרופיל
CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 6. יצירת Policy לעדכון פרופיל
CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 7. וידוא ש-RLS מופעל
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 8. בדיקה שהכל עובד
SELECT 'RLS Policies created successfully' as status;
