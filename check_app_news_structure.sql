-- בדיקת מבנה טבלת app_news
-- ===========================

-- בדיקת העמודות בטבלה
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'app_news' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- בדיקת הנתונים הקיימים (5 שורות ראשונות)
SELECT * FROM public.app_news LIMIT 5;

-- בדיקת מספר השורות
SELECT COUNT(*) as total_articles FROM public.app_news;



