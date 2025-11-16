-- כל דיווחי NVO ללא הגבלה
SELECT 
  code,
  report_date,
  date as period_ending,
  before_after_market,
  estimate,
  actual,
  difference,
  percent,
  source,
  updated_at
FROM earnings_calendar
WHERE code = 'NVO.US'
ORDER BY report_date DESC;


