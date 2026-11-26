-- סקריפט לבדיקת בעיית החדשות
-- ====================================
-- הערה: סקריפט זה מתאים לכל מבנה טבלה

-- 0. בדיקת מבנה הטבלה (חשוב!)
SELECT 
  '📋 עמודות בטבלה' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_news'
ORDER BY ordinal_position;

-- 1. בדיקה כמה חדשות יש בטבלה
SELECT 
  'סה"כ חדשות בטבלה' as check_type,
  COUNT(*) as count
FROM public.app_news;

-- 2. בדיקה מי המקורות (sources) - אם העמודה קיימת
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_news' AND column_name = 'source'
  ) THEN
    RAISE NOTICE 'עמודת source קיימת - מריץ שאילתה...';
  ELSE
    RAISE NOTICE 'עמודת source לא קיימת!';
  END IF;
END $$;

-- 3. הצגת כל הנתונים (5 רשומות ראשונות)
SELECT 
  '5 רשומות ראשונות' as check_type,
  *
FROM public.app_news
LIMIT 5;

-- 4. בדיקה של המדיניות RLS הנוכחית
SELECT 
  'מדיניות RLS נוכחית' as check_type,
  policyname,
  cmd as command_type,
  CASE 
    WHEN with_check::text LIKE '%service_role%' THEN '✅ מאפשר service_role'
    WHEN with_check::text LIKE '%authenticated%' THEN '⚠️  רק authenticated'
    ELSE '❌ אחר'
  END as policy_status,
  with_check::text as policy_details
FROM pg_policies 
WHERE tablename = 'app_news'
ORDER BY cmd;

-- 5. בדיקה האם RLS מופעל
SELECT 
  'סטטוס RLS' as check_type,
  CASE 
    WHEN relrowsecurity THEN '🔒 RLS מופעל'
    ELSE '🔓 RLS כבוי'
  END as rls_status
FROM pg_class 
WHERE relname = 'app_news';

-- 6. ספירה של רשומות לפי שדות שונים (אם קיימים)
-- הצגת כל שמות העמודות הזמינות
SELECT 
  '🔍 שמות עמודות זמינות' as info,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as available_columns
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_news';

