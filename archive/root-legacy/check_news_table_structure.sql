-- בדיקת מבנה טבלת החדשות
-- ================================

-- 1. בדיקה אם הטבלה קיימת
SELECT 
  'בדיקת קיום טבלה' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'app_news'
    ) THEN '✅ הטבלה קיימת'
    ELSE '❌ הטבלה לא קיימת!'
  END as result;

-- 2. הצגת כל העמודות בטבלה
SELECT 
  'עמודות בטבלה' as info_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_news'
ORDER BY ordinal_position;

-- 3. ספירה כללית של שורות
SELECT 
  'סה"כ רשומות בטבלה' as info_type,
  COUNT(*) as total_count
FROM public.app_news;

-- 4. הצגת דוגמה של שורה אחת (כדי לראות את המבנה)
SELECT 
  'דוגמה לרשומה' as info_type,
  *
FROM public.app_news
LIMIT 1;

-- 5. בדיקת מדיניות RLS
SELECT 
  'מדיניות RLS' as info_type,
  policyname,
  cmd as command_type,
  with_check::text as policy_check
FROM pg_policies 
WHERE tablename = 'app_news'
ORDER BY cmd;

-- 6. בדוק אם RLS מופעל
SELECT 
  'סטטוס RLS' as info_type,
  CASE 
    WHEN relrowsecurity THEN '🔒 RLS מופעל'
    ELSE '🔓 RLS כבוי'
  END as rls_status
FROM pg_class 
WHERE relname = 'app_news';




