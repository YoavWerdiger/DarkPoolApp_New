-- ============================================
-- בדיקה סופית - מה קרה עם השליפה?
-- ============================================

-- 1. בדיקת כמה רשומות יש בטבלה בכלל
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT ticker) as unique_tickers,
  COUNT(DISTINCT code) as unique_codes,
  MIN(report_date) as earliest_date,
  MAX(report_date) as latest_date
FROM earnings_calendar;

-- 2. בדיקת רשומות שהוספו לאחרונה (15 דקות)
SELECT 
  COUNT(*) as recent_records,
  MIN(updated_at) as earliest,
  MAX(updated_at) as latest,
  COUNT(DISTINCT ticker) as unique_companies
FROM earnings_calendar 
WHERE updated_at > NOW() - INTERVAL '15 minutes';

-- 3. בדיקת רשומות לפי source
SELECT 
  source,
  api_source,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY source, api_source
ORDER BY count DESC;

-- 4. בדיקת דוגמאות רשומות (אם יש)
SELECT 
  ticker,
  code,
  company_name,
  report_date,
  eps_estimate,
  revenue_estimate,
  importance,
  updated_at
FROM earnings_calendar
ORDER BY updated_at DESC
LIMIT 10;

-- 5. בדיקת רשומות עם ticker (השדה החדש)
SELECT 
  COUNT(*) as records_with_ticker,
  COUNT(*) FILTER (WHERE ticker IS NOT NULL) as has_ticker,
  COUNT(*) FILTER (WHERE ticker IS NULL) as missing_ticker
FROM earnings_calendar;

-- 6. בדיקת רשומות עם external_id (מה-API)
SELECT 
  COUNT(*) as records_with_external_id,
  COUNT(DISTINCT external_id) as unique_external_ids
FROM earnings_calendar
WHERE external_id IS NOT NULL;




