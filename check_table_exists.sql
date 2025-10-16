-- בדיקה אם הטבלה קיימת
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'earnings_calendar';

-- בדיקה אם יש נתונים בטבלה
SELECT COUNT(*) as total_records 
FROM public.earnings_calendar;

-- בדיקה של מבנה הטבלה
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'earnings_calendar'
ORDER BY ordinal_position;
