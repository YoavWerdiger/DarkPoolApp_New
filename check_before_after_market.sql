-- בדיקת התפלגות דיווחים לפי before_after_market

-- 1. ספירה כללית
SELECT 
  before_after_market,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM earnings_calendar
GROUP BY before_after_market
ORDER BY count DESC;

-- 2. דוגמאות של AfterMarket
SELECT 
  code,
  report_date,
  before_after_market,
  estimate,
  actual
FROM earnings_calendar
WHERE before_after_market = 'AfterMarket'
ORDER BY report_date
LIMIT 10;

-- 3. דוגמאות של BeforeMarket
SELECT 
  code,
  report_date,
  before_after_market,
  estimate,
  actual
FROM earnings_calendar
WHERE before_after_market = 'BeforeMarket'
ORDER BY report_date
LIMIT 10;

-- 4. בדיקה אם יש NULL
SELECT 
  code,
  report_date,
  before_after_market,
  estimate,
  actual
FROM earnings_calendar
WHERE before_after_market IS NULL
ORDER BY report_date
LIMIT 10;

-- 5. ספירה לפי תאריך - כמה BeforeMarket vs AfterMarket
SELECT 
  report_date,
  COUNT(CASE WHEN before_after_market = 'BeforeMarket' THEN 1 END) as before_market,
  COUNT(CASE WHEN before_after_market = 'AfterMarket' THEN 1 END) as after_market,
  COUNT(CASE WHEN before_after_market IS NULL THEN 1 END) as no_time
FROM earnings_calendar
WHERE report_date >= '2025-10-08' AND report_date <= '2025-10-31'
GROUP BY report_date
ORDER BY report_date;

