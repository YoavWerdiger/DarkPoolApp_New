-- בדיקת מבנה טבלת app_news_clean
-- ===================================

-- שלב 1: בדוק את המבנה של הטבלה
SELECT 
  'מבנה הטבלה app_news_clean' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_news_clean' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- שלב 2: בדוק נתונים קיימים (אם יש)
SELECT 
  'נתונים לדוגמה' as info,
  *
FROM public.app_news_clean 
LIMIT 1;

-- שלב 3: הוסף חדשה חדשה (לפי המבנה האמיתי)
-- ⚠️ עדכן את זה לפי המבנה האמיתי של הטבלה!
-- 
-- דוגמה אפשרית (אם יש עמודות: label, title, content, source, time):
-- INSERT INTO app_news_clean (label, title, content, source, time)
-- VALUES (
--   'בדיקת התראות - ' || NOW()::TEXT,
--   'חדשה לבדיקה',
--   'זה בדיקה של מערכת התראות Push',
--   'מערכת',
--   NOW()
-- )
-- RETURNING id, label, title, created_at;


