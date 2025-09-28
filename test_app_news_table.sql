-- בדיקת קיום הטבלה app_news
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'app_news'
) AS table_exists;

-- אם הטבלה קיימת, נבדוק את המבנה שלה
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_news' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- נבדוק כמה רשומות יש בטבלה
SELECT COUNT(*) as total_rows FROM app_news;

-- נבדוק רשומה לדוגמה
SELECT * FROM app_news LIMIT 1;



