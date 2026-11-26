-- אבחון סופי - ללא הנחות על מבנה הטבלה
-- ================================================

-- 1️⃣ מהן העמודות בטבלה?
SELECT 
  '1️⃣ עמודות בטבלה' as step,
  column_name,
  data_type,
  ordinal_position as position
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'app_news'
ORDER BY ordinal_position;

-- 2️⃣ כמה רשומות יש?
SELECT 
  '2️⃣ סה"כ רשומות' as step,
  COUNT(*) as total_records
FROM public.app_news;

-- 3️⃣ הצג דוגמה של 3 רשומות (ללא ORDER BY)
SELECT 
  '3️⃣ דוגמאות (3 רשומות)' as step,
  *
FROM public.app_news
LIMIT 3;

-- 4️⃣ בדוק אם RLS מופעל
SELECT 
  '4️⃣ סטטוס RLS' as step,
  CASE 
    WHEN relrowsecurity THEN '🔒 RLS מופעל'
    ELSE '🔓 RLS כבוי'
  END as status
FROM pg_class 
WHERE relname = 'app_news';

-- 5️⃣ בדוק את המדיניות
SELECT 
  '5️⃣ מדיניות RLS' as step,
  policyname,
  cmd as operation,
  with_check::text as insert_check,
  qual::text as other_check
FROM pg_policies 
WHERE tablename = 'app_news'
ORDER BY cmd;

-- 6️⃣ האם יש מדיניות INSERT?
SELECT 
  '6️⃣ האם יש מדיניות INSERT?' as step,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ אין מדיניות INSERT - RLS חוסם הכל!'
    ELSE '✅ יש מדיניות INSERT (' || COUNT(*) || ')'
  END as result
FROM pg_policies 
WHERE tablename = 'app_news' AND cmd = 'INSERT';

-- 7️⃣ סיכום
SELECT 
  '7️⃣ אבחנה סופית' as step,
  CASE 
    -- בדיקה 1: האם RLS מופעל?
    WHEN NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'app_news' AND relrowsecurity)
    THEN 'RLS כבוי - הבעיה לא במדיניות RLS'
    
    -- בדיקה 2: האם אין מדיניות INSERT?
    WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_news' AND cmd = 'INSERT')
    THEN 'RLS מופעל אבל אין מדיניות INSERT - זה חוסם הכל! זו הבעיה!'
    
    -- בדיקה 3: האם המדיניות מאפשרת רק authenticated?
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'app_news' 
      AND cmd = 'INSERT'
      AND with_check::text LIKE '%authenticated%' 
      AND with_check::text NOT LIKE '%service_role%'
    )
    THEN 'המדיניות מאפשרת רק authenticated (לא service_role) - זו הבעיה!'
    
    ELSE 'המדיניות נראית תקינה - הבעיה אולי ב-n8n configuration'
  END as diagnosis;

-- 8️⃣ פתרון מומלץ
SELECT 
  '8️⃣ הפתרון' as step,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'app_news' AND relrowsecurity)
    THEN 'בדוק את n8n configuration - הבעיה לא ב-RLS'
    
    WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_news' AND cmd = 'INSERT')
    THEN 'הרץ: fix_app_news_policies.sql או כבה RLS: ALTER TABLE app_news DISABLE ROW LEVEL SECURITY;'
    
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'app_news' 
      AND cmd = 'INSERT'
      AND with_check::text LIKE '%authenticated%' 
      AND with_check::text NOT LIKE '%service_role%'
    )
    THEN 'הרץ את fix_app_news_policies.sql כדי לאפשר גם ל-service_role'
    
    ELSE 'בדוק את n8n: ודא שמשתמש ב-service_role key הנכון'
  END as solution;


