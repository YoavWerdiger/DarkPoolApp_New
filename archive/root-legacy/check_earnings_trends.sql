-- בדיקת נתוני earnings_trends
SELECT 
  code,
  date,
  period,
  revenue_estimate_avg,
  revenue_estimate_growth,
  revenue_estimate_analysts_count,
  earnings_estimate_avg,
  earnings_estimate_growth
FROM earnings_trends
WHERE code LIKE '%.US'
ORDER BY date DESC
LIMIT 10;
