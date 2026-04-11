-- ============================================
-- בדיקה - האם הרשומות החדשות מה-API החדש?
-- ============================================

-- 1. בדיקת source של כל הרשומות
SELECT 
  source,
  api_source,
  COUNT(*) as count,
  MIN(updated_at) as earliest_update,
  MAX(updated_at) as latest_update
FROM earnings_calendar
GROUP BY source, api_source
ORDER BY count DESC;

-- 2. בדיקת רשומות שהוספו לאחרונה (20 דקות)
SELECT 
  source,
  api_source,
  COUNT(*) as recent_count,
  COUNT(DISTINCT ticker) as unique_tickers,
  MIN(report_date) as earliest_report_date,
  MAX(report_date) as latest_report_date
FROM earnings_calendar
WHERE updated_at > NOW() - INTERVAL '20 minutes'
GROUP BY source, api_source;

-- 3. בדיקת רשומות עם external_id (זה מה-API החדש)
SELECT 
  COUNT(*) as records_with_external_id,
  COUNT(DISTINCT external_id) as unique_external_ids,
  MIN(updated_at) as earliest,
  MAX(updated_at) as latest
FROM earnings_calendar
WHERE external_id IS NOT NULL;

-- 4. השוואה - רשומות חדשות (עם external_id) vs ישנות (בלי external_id)
SELECT 
  CASE 
    WHEN external_id IS NOT NULL THEN 'מה-API החדש (עם external_id)'
    ELSE 'רשומות ישנות (בלי external_id)'
  END as record_type,
  COUNT(*) as count,
  COUNT(DISTINCT ticker) FILTER (WHERE ticker IS NOT NULL) as unique_tickers,
  MIN(report_date) as earliest_date,
  MAX(report_date) as latest_date,
  MIN(updated_at) as earliest_update,
  MAX(updated_at) as latest_update
FROM earnings_calendar
GROUP BY 
  CASE 
    WHEN external_id IS NOT NULL THEN 'מה-API החדש (עם external_id)'
    ELSE 'רשומות ישנות (בלי external_id)'
  END;

-- 5. דוגמאות רשומות חדשות (עם external_id)
SELECT 
  ticker,
  code,
  company_name,
  asset_name,
  report_date,
  eps_estimate,
  revenue_estimate,
  external_id,
  source,
  api_source,
  updated_at
FROM earnings_calendar
WHERE external_id IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 6. דוגמאות רשומות ישנות (בלי external_id)
SELECT 
  ticker,
  code,
  company_name,
  report_date,
  eps_estimate,
  revenue_estimate,
  external_id,
  source,
  updated_at
FROM earnings_calendar
WHERE external_id IS NULL
ORDER BY updated_at DESC
LIMIT 10;





