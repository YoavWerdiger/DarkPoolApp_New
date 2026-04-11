-- ============================================
-- בדיקת סטטוס השליפה הראשונית
-- ============================================

-- 1. בדיקת התגובה האחרונה מה-HTTP Request
SELECT 
  id,
  created_at,
  status_code,
  content::text as response_content,
  LEFT(content::text, 500) as response_preview
FROM net.http_response
WHERE url LIKE '%daily-earnings-sync-v2%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. בדיקת כמה רשומות נוספו לאחרונה
SELECT 
  COUNT(*) as total_recent_records,
  MIN(updated_at) as earliest_update,
  MAX(updated_at) as latest_update
FROM earnings_calendar 
WHERE updated_at > NOW() - INTERVAL '1 hour';

-- 3. בדיקת רשומות לפי תאריך דיווח (30 הימים הקרובים)
SELECT 
  report_date,
  COUNT(*) as count,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE
  AND report_date <= CURRENT_DATE + INTERVAL '30 days'
GROUP BY report_date
ORDER BY report_date
LIMIT 30;

-- 4. בדיקת דוגמאות רשומות שהוספו לאחרונה
SELECT 
  code,
  company_name,
  report_date,
  before_after_market,
  estimate,
  actual,
  updated_at
FROM earnings_calendar
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;

-- 5. בדיקת שגיאות אפשריות (אם יש רשומות עם נתונים חסרים)
SELECT 
  COUNT(*) as records_with_missing_data,
  COUNT(*) FILTER (WHERE code IS NULL) as missing_code,
  COUNT(*) FILTER (WHERE report_date IS NULL) as missing_date,
  COUNT(*) FILTER (WHERE estimate IS NULL AND actual IS NULL) as missing_eps
FROM earnings_calendar
WHERE updated_at > NOW() - INTERVAL '1 hour';





