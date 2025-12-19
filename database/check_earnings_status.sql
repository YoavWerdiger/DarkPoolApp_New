-- ============================================
-- בדיקת סטטוס של Earnings Sync
-- ============================================

-- 1. בדיקת כמה דיווחים יש במסד הנתונים:
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE code LIKE '%.US') as us_stocks,
  COUNT(*) FILTER (WHERE code NOT LIKE '%.US') as non_us_stocks,
  MIN(report_date) as earliest_date,
  MAX(report_date) as latest_date
FROM earnings_calendar;

-- 2. בדיקת התפלגות לפי תאריך (10 תאריכים אחרונים):
SELECT 
  report_date,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY report_date
ORDER BY report_date DESC
LIMIT 10;

-- 3. בדיקת התפלגות לפי importance:
SELECT 
  importance,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY importance
ORDER BY importance;

-- 4. בדיקת כמה דיווחים יש בטווח של 3 חודשים קדימה:
SELECT 
  COUNT(*) as count_next_3_months
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE 
  AND report_date <= (CURRENT_DATE + INTERVAL '3 months')::DATE;

-- 5. בדיקת כמה דיווחים יש בטווח של 3 חודשים אחורה:
SELECT 
  COUNT(*) as count_past_3_months
FROM earnings_calendar
WHERE report_date >= (CURRENT_DATE - INTERVAL '3 months')::DATE
  AND report_date < CURRENT_DATE;

-- ============================================
-- אם התוצאה היא 0, נסה להריץ שוב:
-- ============================================

-- הרץ את זה כדי להפעיל את הפונקציה:
-- SELECT * FROM trigger_earnings_sync();

-- או עם טווח קטן יותר לבדיקה (7 ימים קדימה):
-- SELECT * FROM trigger_earnings_sync(
--   CURRENT_DATE,
--   (CURRENT_DATE + INTERVAL '7 days')::DATE
-- );





