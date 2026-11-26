-- בדיקת איך נראים הטיקרים במסד הנתונים
SELECT DISTINCT 
  code,
  SUBSTRING(code, 1, 10) as code_preview,
  LENGTH(code) as code_length,
  report_date
FROM public.earnings_calendar 
WHERE report_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY code
LIMIT 10;
