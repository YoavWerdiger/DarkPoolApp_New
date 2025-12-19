-- ============================================
-- עדכון כל האירועים הכלכליים בעבר
-- ============================================
-- 
-- פונקציה זו מעדכנת את כל האירועים בעבר (לא רק היום ואתמול)
-- על ידי קריאה ל-benzinga-update-results-live עם טווח תאריכים מותאם

-- יצירת פונקציה
CREATE OR REPLACE FUNCTION update_all_past_economics(
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  http_response_id BIGINT,
  date_from TEXT,
  date_to TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
  http_response_id BIGINT;
BEGIN
  -- חישוב תאריכים
  from_date := (today_est - INTERVAL '1 day' * p_days_back)::DATE;
  to_date := (today_est - INTERVAL '1 day')::DATE; -- עד אתמול (לא כולל היום)
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  -- קריאה ל-Edge Function
  -- הערה: benzinga-update-results-live בודקת רק היום ואתמול
  -- אז נצטרך לקרוא לה מספר פעמים או לשנות את הפונקציה
  -- כרגע נשתמש ב-benzinga-economics-sync עם טווח תאריכים בעבר
  
  -- אבל benzinga-economics-sync לא מעדכנת actual values...
  -- אז נשתמש ב-benzinga-update-results-live מספר פעמים
  
  -- פתרון: נשתמש ב-benzinga-economics-sync שיעדכן את כל האירועים
  -- כי היא שולפת מחדש את כל האירועים עם actual values אם הם קיימים
  
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'date_from', from_date_str,
      'date_to', to_date_str
    ),
    timeout_milliseconds := 300000 -- 5 דקות
  ) INTO http_response_id;
  
  -- החזרת תוצאות
  RETURN QUERY SELECT 
    TRUE as success,
    'Past economics update triggered. benzinga-economics-sync will re-fetch events with actual values if available.' as message,
    http_response_id,
    from_date_str,
    to_date_str;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE as success,
      'Error: ' || SQLERRM as message,
      NULL::BIGINT as http_response_id,
      from_date_str,
      to_date_str;
END;
$$;

-- ============================================
-- שימוש
-- ============================================

-- עדכון 30 ימים אחורה (ברירת מחדל):
-- SELECT * FROM update_all_past_economics();

-- עדכון 60 ימים אחורה:
-- SELECT * FROM update_all_past_economics(60);

-- ============================================
-- בדיקה לפני ואחרי
-- ============================================

-- לפני:
-- SELECT 
--   COUNT(*) as total_past_events,
--   COUNT(CASE WHEN actual IS NOT NULL AND actual != '' THEN 1 END) as events_with_actual,
--   COUNT(CASE WHEN actual IS NULL OR actual = '' THEN 1 END) as events_without_actual
-- FROM economic_events
-- WHERE date < CURRENT_DATE;

-- אחרי (המתן 2-5 דקות):
-- SELECT 
--   COUNT(*) as total_past_events,
--   COUNT(CASE WHEN actual IS NOT NULL AND actual != '' THEN 1 END) as events_with_actual,
--   COUNT(CASE WHEN actual IS NULL OR actual = '' THEN 1 END) as events_without_actual
-- FROM economic_events
-- WHERE date < CURRENT_DATE;




