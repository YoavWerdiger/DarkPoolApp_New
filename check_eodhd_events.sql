-- בדיקה אם יש אירועים מ-EODHD

-- כמה אירועים מכל מקור?
SELECT 
  source,
  COUNT(*) as count
FROM economic_events
GROUP BY source;

-- יש אירועים מ-EODHD?
SELECT COUNT(*) as eodhd_count
FROM economic_events
WHERE source = 'EODHD';

-- אם יש, תראה דוגמאות
SELECT date, title, source
FROM economic_events
WHERE source = 'EODHD'
ORDER BY date
LIMIT 10;

