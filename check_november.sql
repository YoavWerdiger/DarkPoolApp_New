-- בדיקת אירועים בנובמבר 2025
SELECT 
  date,
  COUNT(*) as count,
  STRING_AGG(DISTINCT source, ', ') as sources,
  STRING_AGG(DISTINCT LEFT(title, 40), ' | ') as sample_titles
FROM economic_events
WHERE date >= '2025-11-01' AND date <= '2025-11-30'
GROUP BY date
ORDER BY date
LIMIT 50;
