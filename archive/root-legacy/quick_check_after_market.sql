-- בדיקה מהירה: כמה AfterMarket יש?

SELECT 
  'Total Records' as category,
  COUNT(*) as count
FROM earnings_calendar

UNION ALL

SELECT 
  'AfterMarket' as category,
  COUNT(*) as count
FROM earnings_calendar
WHERE before_after_market = 'AfterMarket'

UNION ALL

SELECT 
  'BeforeMarket' as category,
  COUNT(*) as count
FROM earnings_calendar
WHERE before_after_market = 'BeforeMarket'

UNION ALL

SELECT 
  'NULL/Unknown' as category,
  COUNT(*) as count
FROM earnings_calendar
WHERE before_after_market IS NULL OR before_after_market NOT IN ('BeforeMarket', 'AfterMarket');

-- רשימת 5 דיווחי AfterMarket עם כל הפרטים
SELECT 
  '--- SAMPLE AFTERMARKET REPORTS ---' as separator;
  
SELECT 
  code,
  report_date,
  before_after_market,
  estimate,
  actual,
  percent
FROM earnings_calendar
WHERE before_after_market = 'AfterMarket'
ORDER BY report_date
LIMIT 5;

