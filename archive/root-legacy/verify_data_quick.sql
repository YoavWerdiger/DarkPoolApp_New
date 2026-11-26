-- בדיקה מהירה של הנתונים
-- הרץ ב-SQL Editor

-- בדיקת Economic Events
SELECT 
  COUNT(*) as total_events,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM economic_events;

-- דוגמאות של אירועים
SELECT 
  id,
  title,
  date,
  importance,
  actual,
  forecast,
  previous,
  source
FROM economic_events
ORDER BY date DESC
LIMIT 10;

-- בדיקת RLS Policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'economic_events';

-- בדיקת Realtime
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE tablename = 'economic_events';

