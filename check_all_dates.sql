-- בדיקת כל התאריכים בטבלה

-- כמה סה"כ?
SELECT COUNT(*) as total FROM economic_events;

-- מה טווח התאריכים?
SELECT 
  MIN(date) as earliest,
  MAX(date) as latest
FROM economic_events;

-- התפלגות לפי חודשים
SELECT 
  DATE_TRUNC('month', date::date) as month,
  COUNT(*) as events_count
FROM economic_events
GROUP BY month
ORDER BY month;

-- 10 אירועים אחרונים
SELECT date, title, source
FROM economic_events
ORDER BY date DESC
LIMIT 10;

-- 10 אירועים ראשונים
SELECT date, title, source
FROM economic_events
ORDER BY date ASC
LIMIT 10;

