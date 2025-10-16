-- בדיקה מעמיקה של הטבלה economic_events

-- 1. סה"כ אירועים
SELECT COUNT(*) as total_events FROM economic_events;

-- 2. אירועים לפי תאריכים
SELECT 
  date,
  COUNT(*) as count,
  STRING_AGG(DISTINCT source, ', ') as sources
FROM economic_events
GROUP BY date
ORDER BY date
LIMIT 30;

-- 3. כמה אירועים יש
SELECT * FROM economic_events ORDER BY date LIMIT 10;

-- 4. בדיקה של structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'economic_events';




