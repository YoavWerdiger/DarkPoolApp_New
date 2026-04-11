-- ============================================
-- פונקציה SQL לעדכון תוצאות אקטואליות של אירועים כלכליים
-- ============================================
-- 
-- פונקציה זו קוראת ל-Edge Function benzinga-update-results-live
-- שמעדכנת את הערכים האקטואליים (actual values) של אירועים שכבר התרחשו

-- יצירת פונקציה
CREATE OR REPLACE FUNCTION trigger_economics_update_live()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  http_response_id BIGINT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  http_response_id BIGINT;
BEGIN
  -- קריאה ל-Edge Function שמעדכנת תוצאות בלייב
  -- הפונקציה בודקת אירועים של היום ואתמול ומעדכנת actual values
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-update-results-live',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(),
    timeout_milliseconds := 300000 -- 5 דקות
  ) INTO http_response_id;
  
  -- החזרת תוצאות
  RETURN QUERY SELECT 
    TRUE as success,
    'Economics live update triggered successfully. Check logs in Supabase Dashboard.' as message,
    http_response_id;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE as success,
      'Error: ' || SQLERRM as message,
      NULL::BIGINT as http_response_id;
END;
$$;

-- הערה: הפונקציה מחזירה מיד, אבל ה-Edge Function רץ ברקע
-- המתן 1-2 דקות ואז בדוק: SELECT * FROM economic_events WHERE date <= CURRENT_DATE AND actual IS NOT NULL;

-- ============================================
-- שימוש בפונקציה
-- ============================================

-- הפעלה ידנית:
-- SELECT * FROM trigger_economics_update_live();

-- ============================================
-- בדיקה מהירה - כמה אירועים יש עם actual values?
-- ============================================

-- בדיקת אירועים בעבר עם actual values:
-- SELECT 
--   COUNT(*) as total_past_events,
--   COUNT(CASE WHEN actual IS NOT NULL AND actual != '' THEN 1 END) as events_with_actual,
--   COUNT(CASE WHEN actual IS NULL OR actual = '' THEN 1 END) as events_without_actual
-- FROM economic_events
-- WHERE date < CURRENT_DATE;

-- בדיקת אירועים של היום עם actual values:
-- SELECT 
--   date,
--   COUNT(*) as total_events,
--   COUNT(CASE WHEN actual IS NOT NULL AND actual != '' THEN 1 END) as events_with_actual
-- FROM economic_events
-- WHERE date = CURRENT_DATE
-- GROUP BY date;





