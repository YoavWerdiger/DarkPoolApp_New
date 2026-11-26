-- ניקוי מניות לא-אמריקאיות ממסד הנתונים

-- 1. בדיקה: כמה מניות לא-אמריקאיות יש?
SELECT 
  'Non-US Stocks' as category,
  COUNT(*) as count
FROM earnings_calendar
WHERE code NOT LIKE '%.US';

-- 2. דוגמאות של מניות לא-אמריקאיות
SELECT 
  code,
  report_date,
  before_after_market
FROM earnings_calendar
WHERE code NOT LIKE '%.US'
LIMIT 10;

-- 3. מחיקת כל המניות הלא-אמריקאיות
DELETE FROM earnings_calendar
WHERE code NOT LIKE '%.US';

-- 4. אימות: כמה נשאר?
SELECT 
  'Remaining US Stocks' as category,
  COUNT(*) as count
FROM earnings_calendar;

-- 5. התפלגות BeforeMarket vs AfterMarket אחרי הניקוי
SELECT 
  before_after_market,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM earnings_calendar
GROUP BY before_after_market
ORDER BY count DESC;


