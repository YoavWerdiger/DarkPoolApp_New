-- ============================================
-- הפעלת שליפה ראשונית עם daily-earnings-sync-v2
-- ============================================
-- 
-- סקריפט זה קורא ל-Edge Function החדשה שמשתמשת ב-API החדש
-- (api.parse.bot) כדי לשלוף דיווחי תוצאות רבעוניים

-- ============================================
-- אפשרות 1: קריאה ישירה דרך net.http_post
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
  response_status INT;
  response_content TEXT;
BEGIN
  RAISE NOTICE '🚀 Starting initial earnings sync with new API...';
  RAISE NOTICE '📡 Calling daily-earnings-sync-v2 function...';
  
  -- קריאה ל-Edge Function
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-v2',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000 -- 5 דקות
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ Function call initiated. HTTP Request ID: %', http_response_id;
  RAISE NOTICE '⏳ Processing... This may take a few minutes.';
  RAISE NOTICE '';
  RAISE NOTICE '📊 To check the response, run:';
  RAISE NOTICE '   SELECT * FROM net.http_response WHERE id = %;', http_response_id;
  RAISE NOTICE '';
  RAISE NOTICE '📈 To check inserted records, run:';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar WHERE updated_at > NOW() - INTERVAL ''5 minutes'';';
  
END $$;

-- ============================================
-- אפשרות 2: יצירת פונקציה לשימוש חוזר
-- ============================================

CREATE OR REPLACE FUNCTION trigger_earnings_sync_v2()
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
  -- קריאה ל-Edge Function
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-v2',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO http_response_id;
  
  RETURN QUERY SELECT 
    TRUE as success,
    'Earnings sync (V2 - New API) triggered successfully. Check logs in Supabase Dashboard.' as message,
    http_response_id;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE as success,
      'Error: ' || SQLERRM as message,
      NULL::BIGINT as http_response_id;
END;
$$;

-- ============================================
-- שימוש בפונקציה
-- ============================================

-- הרץ את זה כדי להפעיל את השליפה הראשונית:
-- SELECT * FROM trigger_earnings_sync_v2();

-- ============================================
-- בדיקות לאחר השליפה
-- ============================================

-- בדיקת כמות דיווחים שהוספו לאחרונה:
-- SELECT COUNT(*) as recent_records 
-- FROM earnings_calendar 
-- WHERE updated_at > NOW() - INTERVAL '10 minutes';

-- בדיקת דיווחים לפי תאריך:
-- SELECT 
--   report_date,
--   COUNT(*) as count
-- FROM earnings_calendar
-- WHERE report_date >= CURRENT_DATE
-- GROUP BY report_date
-- ORDER BY report_date
-- LIMIT 30;

-- בדיקת דיווחים של היום:
-- SELECT * FROM earnings_calendar 
-- WHERE report_date = CURRENT_DATE
-- ORDER BY code;





