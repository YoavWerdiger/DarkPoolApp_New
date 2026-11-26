-- תיקון תאריכי דיווחים רבעוניים שיש להם תוצאות בפועל אבל תאריך עתידי

-- 1. בדיקה ראשונית: כמה דיווחים יש עם תוצאות בפועל ותאריך עתידי?
SELECT 
  COUNT(*) as problematic_records,
  MIN(report_date) as earliest_future_date,
  MAX(report_date) as latest_future_date
FROM earnings_calendar
WHERE actual IS NOT NULL 
  AND report_date > CURRENT_DATE;

-- 2. הצג דוגמאות של הדיווחים הבעייתיים
SELECT 
  code, 
  report_date, 
  before_after_market,
  actual, 
  estimate,
  date as reporting_period
FROM earnings_calendar
WHERE actual IS NOT NULL 
  AND report_date > CURRENT_DATE
ORDER BY report_date, code
LIMIT 20;

-- 3. תיקון: העבר דיווחים עם תוצאות בפועל ותאריך עתידי לתאריך היום
-- עדכון זהיר: רק דיווחים שיש להם תוצאה בפועל ותאריך עתידי (מחר או מאוחר יותר)
UPDATE earnings_calendar
SET 
  report_date = CURRENT_DATE,
  updated_at = NOW()
WHERE actual IS NOT NULL 
  AND report_date > CURRENT_DATE;

-- 4. בדיקה: כמה רשומות עודכנו?
SELECT 
  COUNT(*) as updated_records
FROM earnings_calendar
WHERE actual IS NOT NULL 
  AND report_date = CURRENT_DATE;

-- 5. הצג דיווחים של היום
SELECT 
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  percent
FROM earnings_calendar
WHERE report_date = CURRENT_DATE
ORDER BY 
  CASE 
    WHEN before_after_market = 'BeforeMarket' THEN 1
    WHEN before_after_market = 'AfterMarket' THEN 2
    ELSE 3
  END,
  code;

-- 6. סטטיסטיקה: כמה דיווחים יש לכל תאריך?
SELECT 
  report_date,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_actual,
  COUNT(CASE WHEN actual IS NULL THEN 1 END) as without_actual
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE - INTERVAL '2 days'
  AND report_date <= CURRENT_DATE + INTERVAL '7 days'
GROUP BY report_date
ORDER BY report_date;







