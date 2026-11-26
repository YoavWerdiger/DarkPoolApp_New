-- בדיקת נתונים של MMC
SELECT 
  code,
  report_date,
  date as fiscal_period_end,
  before_after_market,
  actual,
  estimate,
  difference,
  percent,
  created_at
FROM earnings_calendar
WHERE code LIKE 'MMC%'
ORDER BY report_date DESC
LIMIT 10;

-- בדיקה כללית של הנתונים
SELECT 
  COUNT(*) as total_records,
  MIN(report_date) as earliest_report,
  MAX(report_date) as latest_report,
  COUNT(DISTINCT code) as unique_stocks
FROM earnings_calendar;

-- דוגמאות אקראיות מהטבלה
SELECT 
  code,
  report_date,
  actual,
  estimate,
  difference,
  percent
FROM earnings_calendar
ORDER BY report_date DESC
LIMIT 20;

