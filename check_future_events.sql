-- בדיקת אירועים עתידיים

-- כמה אירועים עתידיים יש?
SELECT COUNT(*) as future_events
FROM economic_events
WHERE date >= CURRENT_DATE;

-- 10 אירועים עתידיים ראשונים
SELECT 
  id,
  title,
  date,
  time,
  importance,
  actual,
  forecast,
  previous,
  source
FROM economic_events
WHERE date >= CURRENT_DATE
ORDER BY date ASC
LIMIT 10;

-- התפלגות לפי תאריכים
SELECT 
  date,
  COUNT(*) as events_count
FROM economic_events
GROUP BY date
ORDER BY date DESC
LIMIT 20;

