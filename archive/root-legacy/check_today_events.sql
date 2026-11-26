-- בדיקת אירועים ליום הנוכחי
SELECT 
  date,
  COUNT(*) as event_count
FROM economic_events
WHERE date >= '2025-10-10' AND date <= '2025-10-12'
GROUP BY date
ORDER BY date;

-- בדיקה מפורטת של אירועים ליום 2025-10-11
SELECT 
  id,
  title,
  date,
  time,
  importance,
  category,
  source
FROM economic_events
WHERE date = '2025-10-11'
ORDER BY time;

-- ספירה כללית לפי ימים קרובים
SELECT 
  date,
  importance,
  COUNT(*) as count
FROM economic_events
WHERE date >= '2025-10-08' AND date <= '2025-10-15'
GROUP BY date, importance
ORDER BY date, importance DESC;

