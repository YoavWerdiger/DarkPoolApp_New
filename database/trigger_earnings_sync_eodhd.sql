-- ============================================
-- פונקציה SQL להפעלת Earnings Sync עם EODHD API
-- ============================================
-- 
-- פונקציה זו קוראת ל-Edge Function daily-earnings-sync-eodhd
-- עם טווח תאריכים של 3 חודשים אחורה + שנה קדימה

-- יצירת פונקציה
CREATE OR REPLACE FUNCTION trigger_earnings_sync_eodhd(
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
  -- תאריך היום
  today_est DATE := CURRENT_DATE;
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
    from_date := (today_est - INTERVAL '3 months')::DATE;
  ELSE
    from_date := p_date_from;
  END IF;
  
  IF p_date_to IS NULL THEN
    -- שנה קדימה
    to_date := (today_est + INTERVAL '12 months')::DATE;
  ELSE
    to_date := p_date_to;
  END IF;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  -- קריאה ל-Edge Function עם timeout גדול יותר (5 דקות)
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-eodhd',
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
    'Earnings sync (EODHD) triggered successfully. Check logs in Supabase Dashboard.' as message,
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
-- שימוש בפונקציה
-- ============================================

-- אפשרות 1: עם תאריכים ברירת מחדל (3 חודשים אחורה + שנה קדימה)
-- SELECT * FROM trigger_earnings_sync_eodhd();

-- אפשרות 2: עם תאריכים מותאמים אישית
-- SELECT * FROM trigger_earnings_sync_eodhd('2025-01-01'::DATE, '2025-12-31'::DATE);

-- ============================================
-- בדיקה מהירה
-- ============================================

-- הרץ את זה כדי להפעיל את הפונקציה:
SELECT * FROM trigger_earnings_sync_eodhd();

-- אחרי 2-5 דקות, בדוק כמה דיווחים יש:
-- SELECT COUNT(*) FROM earnings_calendar;






