-- בדיקת כמות הרשומות ב-earnings_calendar
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT code) as unique_stocks,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(CASE WHEN revenue_estimate_avg IS NOT NULL THEN 1 END) as with_revenue_estimate,
  COUNT(CASE WHEN revenue_actual IS NOT NULL THEN 1 END) as with_revenue_actual
FROM earnings_calendar;
