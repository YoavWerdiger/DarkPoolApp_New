-- 🔍 שלב 1: בדוק את המבנה של app_news_clean
-- ===========================================

SELECT 
  'מבנה הטבלה app_news_clean' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_news_clean' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 🔍 שלב 2: בדוק נתונים קיימים (אם יש)
SELECT 
  'נתונים לדוגמה' as info,
  *
FROM public.app_news_clean 
LIMIT 1;

-- ⚠️ אחרי שתראה את המבנה, עדכן את ה-INSERT למטה לפי העמודות האמיתיות!

-- 📝 שלב 3: הוסף חדשה חדשה (עדכן לפי המבנה האמיתי!)
-- 
-- דוגמאות אפשריות:
-- 
-- אם יש: label, content, source, time
-- INSERT INTO app_news_clean (label, content, source, time)
-- VALUES (
--   'בדיקת התראות - ' || NOW()::TEXT,
--   'זה בדיקה של מערכת התראות Push',
--   'מערכת',
--   NOW()
-- )
-- RETURNING id, label, created_at;
--
-- אם יש: label, title, content, source
-- INSERT INTO app_news_clean (label, title, content, source)
-- VALUES (
--   'בדיקת התראות - ' || NOW()::TEXT,
--   'חדשה לבדיקה',
--   'זה בדיקה של מערכת התראות Push',
--   'מערכת'
-- )
-- RETURNING id, label, title, created_at;


