-- בדיקת אירועים בנובמבר

SELECT 
  date,
  title,
  importance,
  actual,
  forecast,
  previous,
  source
FROM economic_events
WHERE date >= '2025-11-01' AND date <= '2025-11-30'
ORDER BY date, importance DESC;

