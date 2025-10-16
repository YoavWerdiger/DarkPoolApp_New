-- בדיקת איך נראים הטיקרים בנתונים
SELECT DISTINCT 
  code,
  SUBSTRING(code, 1, 10) as code_preview,
  report_date
FROM public.earnings_calendar 
WHERE report_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY report_date DESC, code
LIMIT 20;
