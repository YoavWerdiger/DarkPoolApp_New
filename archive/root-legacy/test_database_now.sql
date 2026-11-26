-- בדיקה מיידית של מה שנשמר בטבלה

-- סה"כ רשומות
SELECT COUNT(*) as total FROM economic_events;

-- כל הרשומות
SELECT 
  id,
  title,
  date,
  time,
  importance,
  source
FROM economic_events
ORDER BY date
LIMIT 50;




