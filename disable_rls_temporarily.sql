-- כיבוי זמני של RLS עבור טבלת users
-- ======================================

-- 1. כיבוי RLS זמנית
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. וידוא שהשינוי בוצע
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';

-- 3. הודעה
SELECT 'RLS disabled temporarily for users table' as status;