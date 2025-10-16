-- בדיקת אירועים ליום 2025-10-11 במסד הנתונים

-- כל האירועים ליום הנוכחי
SELECT 
  id,
  title,
  date,
  time,
  importance,
  category,
  source,
  description
FROM economic_events
WHERE date = '2025-10-11'
ORDER BY time;

-- ספירה לפי מקור
SELECT 
  source,
  COUNT(*) as count
FROM economic_events
WHERE date = '2025-10-11'
GROUP BY source;

-- טווח תאריכים של כל האירועים
SELECT 
  MIN(date) as first_date,
  MAX(date) as last_date,
  COUNT(*) as total_events
FROM economic_events;

-- ספירה לפי תאריכים קרובים
SELECT 
  date,
  COUNT(*) as event_count
FROM economic_events
WHERE date >= '2025-10-10' AND date <= '2025-10-15'
GROUP BY date
ORDER BY date;




