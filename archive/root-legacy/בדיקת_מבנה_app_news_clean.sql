-- בדיקת מבנה טבלת app_news_clean
-- ===================================

-- בדיקת העמודות בטבלה
SELECT 
  'מבנה הטבלה app_news_clean' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'app_news_clean' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- בדיקת הנתונים הקיימים (5 שורות ראשונות)
SELECT 
  'נתונים לדוגמה' as info,
  *
FROM public.app_news_clean 
LIMIT 5;


