-- ============================================
-- הרצת שליפה ראשונית עם API Key החדש
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
  response_status INT;
  response_content TEXT;
  response_json JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🚀 הרצת שליפה ראשונית - Daily Earnings Sync V2';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📡 קורא ל-Edge Function...';
  
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
  
  RAISE NOTICE '✅ Request sent. HTTP Response ID: %', http_response_id;
  RAISE NOTICE '⏳ Waiting 10 seconds for processing...';
  
  -- המתן לפני בדיקת התגובה
  PERFORM pg_sleep(10);
  
  -- בדיקת התגובה מ-net.http_response (composite type)
  SELECT 
    (r).status_code,
    (r).content::text
  INTO 
    response_status,
    response_content
  FROM (
    SELECT net.http_response.* as r
    FROM net.http_response
    WHERE id = http_response_id
  ) sub;
  
  IF response_status IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 תוצאות:';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE 'Status Code: %', response_status;
    
    IF response_status = 200 THEN
      RAISE NOTICE '✅ Status: SUCCESS';
      
      IF response_content IS NOT NULL THEN
        BEGIN
          response_json := response_content::jsonb;
          RAISE NOTICE '';
          RAISE NOTICE '📄 Response:';
          RAISE NOTICE '%', jsonb_pretty(response_json);
          
          IF response_json->>'success' = 'true' THEN
            RAISE NOTICE '';
            RAISE NOTICE '✅ הפונקציה הושלמה בהצלחה!';
            RAISE NOTICE '📊 רשומות שהוספו: %', response_json->>'inserted_count';
            RAISE NOTICE '';
            RAISE NOTICE '💡 בדוק את הנתונים עם:';
            RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar WHERE updated_at > NOW() - INTERVAL ''10 minutes'';';
          ELSIF response_json->>'success' = 'false' THEN
            RAISE NOTICE '';
            RAISE NOTICE '❌ שגיאה בפונקציה:';
            RAISE NOTICE '   %', response_json->>'error';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '📄 Response (raw): %', LEFT(response_content, 500);
        END;
      END IF;
      
    ELSIF response_status = 401 THEN
      RAISE NOTICE '❌ Status: UNAUTHORIZED';
      RAISE NOTICE '💡 ה-API Key לא מוגדר או לא תקין';
      RAISE NOTICE '   ודא שהרצת: npx supabase secrets set EARNINGS_API_KEY=YOUR_KEY';
      
    ELSIF response_status = 404 THEN
      RAISE NOTICE '❌ Status: NOT FOUND';
      RAISE NOTICE '💡 הפונקציה לא הועלתה';
      RAISE NOTICE '   הרץ: npm run supabase:deploy:v2';
      
    ELSIF response_status = 500 THEN
      RAISE NOTICE '❌ Status: SERVER ERROR';
      RAISE NOTICE '💡 יש שגיאה בפונקציה';
      RAISE NOTICE '   בדוק את הלוגים:';
      RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/daily-earnings-sync-v2/logs';
      
    ELSE
      RAISE NOTICE '⚠️ Status: %', response_status;
      IF response_content IS NOT NULL THEN
        RAISE NOTICE 'Response: %', LEFT(response_content, 500);
      END IF;
    END IF;
    
  ELSE
    RAISE NOTICE '⏳ התשובה עדיין לא מוכנה';
    RAISE NOTICE '💡 נסה שוב בעוד כמה שניות או בדוק את הלוגים:';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/daily-earnings-sync-v2/logs';
    RAISE NOTICE '';
    RAISE NOTICE '💡 או בדוק ידנית:';
    RAISE NOTICE '   SELECT * FROM net.http_response WHERE id = %;', http_response_id;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה בבדיקת התגובה: %', SQLERRM;
    RAISE NOTICE '💡 בדוק את הלוגים ישירות ב-Dashboard';
END $$;

-- בדיקה מהירה - כמה רשומות נוספו לאחרונה
SELECT 
  COUNT(*) as recent_records,
  MIN(updated_at) as earliest,
  MAX(updated_at) as latest
FROM earnings_calendar 
WHERE updated_at > NOW() - INTERVAL '15 minutes';




