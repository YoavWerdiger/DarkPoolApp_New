-- אבחון מדויק של בעיית Evan
-- =================================

-- 1. מהן העמודות בטבלה?
WITH table_columns AS (
  SELECT STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'app_news'
)
SELECT 
  '1️⃣ עמודות בטבלה' as step,
  columns
FROM table_columns;

-- 2. כמה רשומות יש סה"כ?
SELECT 
  '2️⃣ סה"כ רשומות' as step,
  COUNT(*) as total
FROM public.app_news;

-- 3. הצג את כל הנתונים (10 ראשונים)
SELECT 
  '3️⃣ 10 רשומות ראשונות' as step,
  *
FROM public.app_news
ORDER BY 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_news' AND column_name = 'created_at') 
    THEN created_at 
  END DESC NULLS LAST
LIMIT 10;

-- 4. בדיקת RLS - האם מופעל?
SELECT 
  '4️⃣ סטטוס RLS' as step,
  CASE 
    WHEN relrowsecurity THEN '🔒 RLS מופעל - זו כנראה הבעיה!'
    ELSE '🔓 RLS כבוי - הבעיה לא כאן'
  END as status,
  relrowsecurity as is_enabled
FROM pg_class 
WHERE relname = 'app_news';

-- 5. מה המדיניות?
SELECT 
  '5️⃣ מדיניות RLS' as step,
  policyname,
  cmd as operation,
  CASE 
    WHEN with_check::text LIKE '%service_role%' OR qual::text LIKE '%service_role%' 
    THEN '✅ מאפשר service_role'
    WHEN with_check::text LIKE '%authenticated%' OR qual::text LIKE '%authenticated%'
    THEN '❌ רק authenticated - זו הבעיה!'
    ELSE '❓ אחר: ' || COALESCE(with_check::text, qual::text, 'לא מוגדר')
  END as diagnosis,
  with_check::text as insert_rule,
  qual::text as select_update_delete_rule
FROM pg_policies 
WHERE tablename = 'app_news'
ORDER BY cmd;

-- 6. סיכום והמלצה
SELECT 
  '6️⃣ סיכום' as step,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'app_news' AND relrowsecurity)
    THEN '✅ RLS כבוי - הבעיה לא במדיניות'
    
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'app_news' 
      AND cmd = 'INSERT'
      AND (with_check::text LIKE '%authenticated%' AND with_check::text NOT LIKE '%service_role%')
    )
    THEN '❌ הבעיה: RLS חוסם INSERT! רק משתמשים מאומתים יכולים להכניס נתונים. הרץ: fix_app_news_policies.sql'
    
    WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_news' AND cmd = 'INSERT')
    THEN '❌ אין מדיניות INSERT! RLS מופעל אבל אין מדיניות - זה חוסם הכל!'
    
    ELSE '❓ צריך בדיקה נוספת - העתק את התוצאות'
  END as diagnosis,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'app_news' 
      AND cmd = 'INSERT'
      AND (with_check::text LIKE '%authenticated%' AND with_check::text NOT LIKE '%service_role%')
    )
    THEN '👉 פתרון: הרץ את fix_app_news_policies.sql ב-Supabase SQL Editor'
    
    WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_news' AND cmd = 'INSERT')
    THEN '👉 פתרון: צור מדיניות INSERT או כבה RLS: ALTER TABLE app_news DISABLE ROW LEVEL SECURITY;'
    
    ELSE '👉 העתק את כל התוצאות ותשלח אותן'
  END as solution;


