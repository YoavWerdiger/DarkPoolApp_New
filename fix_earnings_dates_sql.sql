-- תיקון תאריכי דיווחים רבעוניים - להריץ ב-Supabase SQL Editor
-- הסקריפט הזה יתקן דיווחים שיש להם תוצאות בפועל אבל תאריך עתידי

-- הערה: סקריפט זה חייב לרוץ ב-Supabase SQL Editor (לא דרך anon key)
-- כי הוא עושה שימוש ב-RLS bypass

BEGIN;

-- 1. הצג סטטיסטיקה לפני התיקון
SELECT 
  'לפני התיקון' as stage,
  COUNT(*) as problematic_records
FROM earnings_calendar
WHERE actual IS NOT NULL 
  AND report_date > CURRENT_DATE;

-- 2. צור טבלה זמנית עם הרשומות שצריך לתקן
CREATE TEMP TABLE temp_fix_earnings AS
SELECT 
  *,
  CURRENT_DATE as corrected_date
FROM earnings_calendar
WHERE actual IS NOT NULL 
  AND report_date > CURRENT_DATE;

-- 3. הצג דוגמאות של מה שנתקן
SELECT 
  'דוגמאות לדיווחים בעייתיים' as info,
  code,
  report_date as old_date,
  CURRENT_DATE as new_date,
  actual,
  before_after_market
FROM temp_fix_earnings
LIMIT 10;

-- 4. מחק את הרשומות הישנות
DELETE FROM earnings_calendar
WHERE id IN (SELECT id FROM temp_fix_earnings);

-- 5. הכנס את הרשומות עם התאריכים המתוקנים
INSERT INTO earnings_calendar (
  id,
  code,
  report_date,
  date,
  before_after_market,
  currency,
  actual,
  estimate,
  difference,
  percent,
  source,
  created_at,
  updated_at
)
SELECT 
  'earnings_' || code || '_' || corrected_date as id,
  code,
  corrected_date as report_date,
  date,
  before_after_market,
  currency,
  actual,
  estimate,
  difference,
  percent,
  source,
  created_at,
  NOW() as updated_at
FROM temp_fix_earnings;

-- 6. הצג סטטיסטיקה אחרי התיקון
SELECT 
  'אחרי התיקון' as stage,
  COUNT(*) as problematic_records_remaining
FROM earnings_calendar
WHERE actual IS NOT NULL 
  AND report_date > CURRENT_DATE;

-- 7. הצג סטטיסטיקה כוללת
SELECT 
  'סטטיסטיקה כוללת' as info,
  report_date,
  COUNT(*) as total,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_results,
  COUNT(CASE WHEN actual IS NULL THEN 1 END) as without_results
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE - INTERVAL '2 days'
  AND report_date <= CURRENT_DATE + INTERVAL '7 days'
GROUP BY report_date
ORDER BY report_date;

-- 8. נקה את הטבלה הזמנית
DROP TABLE temp_fix_earnings;

COMMIT;

-- הודעת הצלחה
SELECT '✅ התיקון הושלם בהצלחה!' as message;

