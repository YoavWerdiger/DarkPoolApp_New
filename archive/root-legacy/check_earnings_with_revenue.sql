-- בדיקת נתוני earnings_calendar עם Revenue
SELECT 
  code,
  date,
  report_date,
  before_after_market,
  -- EPS fields
  estimate as eps_estimate,
  actual as eps_actual,
  difference as eps_difference,
  percent as eps_percent,
  -- Revenue Estimate fields
  revenue_estimate_avg,
  revenue_estimate_low,
  revenue_estimate_high,
  revenue_estimate_year_ago,
  revenue_estimate_analysts_count,
  revenue_estimate_growth,
  -- Revenue Actual fields
  revenue_actual,
  revenue_yoy,
  updated_at
FROM earnings_calendar
WHERE date >= '2025-10-20'
ORDER BY date ASC, code ASC
LIMIT 10;
