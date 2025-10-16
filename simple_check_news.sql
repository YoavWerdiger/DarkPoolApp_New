-- בדיקה פשוטה של טבלת החדשות
-- ======================================

-- שלב 1: בדיקת מבנה הטבלה
SELECT 
  '📋 מבנה הטבלה' as step,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_news'
ORDER BY ordinal_position;

-- שלב 2: ספירת רשומות
SELECT 
  '📊 סה"כ רשומות' as step,
  COUNT(*) as total_records
FROM public.app_news;

-- שלב 3: הצגת 3 דוגמאות
SELECT 
  '📄 דוגמאות (3 ראשונות)' as step,
  *
FROM public.app_news
LIMIT 3;

-- שלב 4: בדיקת RLS policies
SELECT 
  '🔐 מדיניות RLS' as step,
  policyname,
  cmd,
  with_check::text as policy_rule
FROM pg_policies 
WHERE tablename = 'app_news';

-- שלב 5: האם RLS מופעל?
SELECT 
  '🔒 סטטוס RLS' as step,
  relname as table_name,
  CASE 
    WHEN relrowsecurity THEN 'RLS מופעל ✓'
    ELSE 'RLS כבוי ✗'
  END as status
FROM pg_class 
WHERE relname = 'app_news';

-- שלב 6: ספירת אינדקסים
SELECT 
  '📇 אינדקסים' as step,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'app_news';



