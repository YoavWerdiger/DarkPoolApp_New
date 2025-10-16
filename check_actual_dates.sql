-- בדיקה מתי יש אירועים בפועל

SELECT 
  date,
  COUNT(*) as count
FROM economic_events
GROUP BY date
ORDER BY date
LIMIT 50;




