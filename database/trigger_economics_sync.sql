-- ============================================
-- פונקציה SQL להפעלת Economics Sync
-- ============================================
-- 
-- פונקציה זו קוראת ל-Edge Function benzinga-economics-sync
-- עם טווח תאריכים של חודש אחורה + 6 חודשים קדימה

-- יצירת פונקציה
CREATE OR REPLACE FUNCTION trigger_economics_sync(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
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
  -- תאריך היום ב-America/New_York timezone
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
  http_response_id BIGINT;
  response_status INT;
  response_content TEXT;
BEGIN
  -- חישוב תאריכים אם לא סופקו
  IF p_date_from IS NULL THEN
    from_date := (today_est - INTERVAL '1 month')::DATE;
  ELSE
    from_date := p_date_from;
  END IF;
  
  IF p_date_to IS NULL THEN
    -- 6 חודשים קדימה (כמו בפונקציה benzinga-economics-sync)
    to_date := (today_est + INTERVAL '6 months')::DATE;
  ELSE
    to_date := p_date_to;
  END IF;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  -- קריאה ל-Edge Function עם timeout גדול יותר (5 דקות)
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
    'Economics sync triggered successfully. Check logs in Supabase Dashboard.' as message,
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

-- הערה: הפונקציה מחזירה מיד, אבל ה-Edge Function רץ ברקע
-- המתן 2-5 דקות ואז בדוק: SELECT COUNT(*) FROM economic_events_cache WHERE source = 'Benzinga';

-- ============================================
-- שימוש בפונקציה
-- ============================================

-- אפשרות 1: עם תאריכים ברירת מחדל (חודש אחורה + 6 חודשים קדימה)
-- SELECT * FROM trigger_economics_sync();

-- אפשרות 2: עם תאריכים מותאמים אישית
-- SELECT * FROM trigger_economics_sync('2025-01-01'::DATE, '2025-12-31'::DATE);

-- ============================================
-- בדיקה מהירה
-- ============================================

-- הרץ את זה כדי להפעיל את הפונקציה:
SELECT * FROM trigger_economics_sync();

-- אחרי 2-5 דקות, בדוק כמה אירועים יש:
-- SELECT COUNT(*) FROM economic_events_cache WHERE source = 'Benzinga';
-- SELECT COUNT(*) FROM economic_events WHERE source = 'Benzinga';




