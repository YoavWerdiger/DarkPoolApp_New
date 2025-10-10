-- בדיקת נתונים בטבלאות
-- הרץ ב-SQL Editor

-- בדיקת Economic Events
SELECT 
  COUNT(*) as total_events,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT category) as categories_count
FROM economic_events;

-- 10 אירועים ראשונים
SELECT 
  id,
  title,
  date,
  importance,
  category,
  actual,
  forecast,
  previous
FROM economic_events
ORDER BY date DESC
LIMIT 10;

-- בדיקת Earnings Events
SELECT 
  COUNT(*) as total_earnings,
  MIN(report_date) as earliest_date,
  MAX(report_date) as latest_date
FROM earnings_events;

-- 10 דיווחי רווחים ראשונים
SELECT 
  id,
  company,
  symbol,
  report_date,
  actual,
  estimate,
  difference,
  percent
FROM earnings_events
ORDER BY report_date DESC
LIMIT 10;

