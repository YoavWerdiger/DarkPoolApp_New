-- ============================================
-- בדיקת התפלגות importance בדיווחי earnings
-- ============================================
-- 
-- סקריפט זה בודק מה ה-importance של הדיווחים
-- ומראה כמה מהם יעברו את הסינון (importance >= 4)

-- ============================================
-- 1. התפלגות importance
-- ============================================

SELECT 
  importance,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM earnings_calendar
WHERE 
  report_date >= CURRENT_DATE - INTERVAL '7 days'
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
GROUP BY importance
ORDER BY importance DESC NULLS LAST;

-- ============================================
-- 2. כמה דיווחים יעברו את הסינון (importance >= 4)
-- ============================================

SELECT 
  COUNT(*) as total_reports,
  COUNT(CASE WHEN importance >= 4 THEN 1 END) as with_importance_4_plus,
  COUNT(CASE WHEN importance < 4 OR importance IS NULL THEN 1 END) as below_importance_4,
  ROUND(COUNT(CASE WHEN importance >= 4 THEN 1 END) * 100.0 / COUNT(*), 2) as percentage_4_plus
FROM earnings_calendar
WHERE 
  report_date >= CURRENT_DATE - INTERVAL '7 days'
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
  AND code LIKE '%.US';

-- ============================================
-- 3. דיווחים עם actuals לפי importance
-- ============================================

SELECT 
  importance,
  COUNT(*) as total,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_eps_actual,
  COUNT(CASE WHEN revenue_actual IS NOT NULL THEN 1 END) as with_revenue_actual,
  COUNT(CASE WHEN actual IS NOT NULL OR revenue_actual IS NOT NULL THEN 1 END) as with_any_actual
FROM earnings_calendar
WHERE 
  report_date >= CURRENT_DATE - INTERVAL '7 days'
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
  AND code LIKE '%.US'
GROUP BY importance
ORDER BY importance DESC NULLS LAST;

-- ============================================
-- 4. דוגמאות לדיווחים עם importance נמוך
-- ============================================

SELECT 
  code,
  ticker,
  company_name,
  report_date,
  importance,
  market_cap,
  actual,
  revenue_actual
FROM earnings_calendar
WHERE 
  report_date >= CURRENT_DATE - INTERVAL '7 days'
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
  AND code LIKE '%.US'
  AND (importance < 4 OR importance IS NULL)
ORDER BY report_date DESC, importance DESC NULLS LAST
LIMIT 20;

-- ============================================
-- 5. דוגמאות לדיווחים עם importance גבוה
-- ============================================

SELECT 
  code,
  ticker,
  company_name,
  report_date,
  importance,
  market_cap,
  actual,
  revenue_actual
FROM earnings_calendar
WHERE 
  report_date >= CURRENT_DATE - INTERVAL '7 days'
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
  AND code LIKE '%.US'
  AND importance >= 4
ORDER BY importance DESC, report_date DESC
LIMIT 20;





