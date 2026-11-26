-- בדיקת טווח התאריכים במסד הנתונים

-- ספירה לפי תאריכים
SELECT 
  date,
  COUNT(*) as event_count,
  MIN(time) as first_event_time,
  MAX(time) as last_event_time
FROM economic_events
WHERE date >= '2025-09-01' AND date <= '2025-11-15'
GROUP BY date
ORDER BY date;

-- סה"כ אירועים
SELECT 
  COUNT(*) as total_events,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as unique_dates
FROM economic_events;

-- אירועים לפי מקור
SELECT 
  source,
  COUNT(*) as count,
  MIN(date) as earliest,
  MAX(date) as latest
FROM economic_events
GROUP BY source
ORDER BY count DESC;




