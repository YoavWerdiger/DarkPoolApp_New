-- בדיקה מהירה לUI - אירועים מהיום ואילך
SELECT 
  date,
  COUNT(*) as event_count,
  STRING_AGG(DISTINCT source, ', ') as sources
FROM economic_events
WHERE date >= CURRENT_DATE
GROUP BY date
ORDER BY date
LIMIT 30;
