-- ============================================
-- בדיקה ישירה של הפונקציה (ללא דרך HTTP)
-- ============================================
-- 
-- סקריפט זה בודק אם הפונקציה קיימת ופועלת
-- ומנסה להריץ אותה ישירות

-- בדיקה אם הפונקציה קיימת
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'trigger_earnings_sync_v2';

-- אם הפונקציה קיימת, נסה להריץ אותה:
-- SELECT * FROM trigger_earnings_sync_v2();

-- ============================================
-- בדיקה ידנית - קריאה ישירה ל-Edge Function
-- ============================================

DO $$
DECLARE
  http_response_id BIGINT;
  response_status INT;
  response_content TEXT;
  response_json JSONB;
BEGIN
  RAISE NOTICE '🧪 Testing direct call to daily-earnings-sync-v2...';
  
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
  
  RAISE NOTICE '✅ Request sent. HTTP Response ID: %', http_response_id;
  RAISE NOTICE '⏳ Waiting 5 seconds for response...';
  
  -- המתן קצת לפני בדיקת התגובה
  PERFORM pg_sleep(5);
  
  -- בדיקת התגובה
  SELECT 
    status_code,
    content::text
  INTO 
    response_status,
    response_content
  FROM net.http_response
  WHERE id = http_response_id;
  
  IF response_status IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 Response Status: %', response_status;
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    IF response_content IS NOT NULL THEN
      BEGIN
        response_json := response_content::jsonb;
        RAISE NOTICE '📄 Response Content:';
        RAISE NOTICE '%', jsonb_pretty(response_json);
        
        -- בדיקת שגיאות
        IF response_json->>'success' = 'false' THEN
          RAISE WARNING '⚠️ Function returned error: %', response_json->>'error';
        ELSIF response_json->>'success' = 'true' THEN
          RAISE NOTICE '✅ Function completed successfully!';
          RAISE NOTICE '📊 Inserted records: %', response_json->>'inserted_count';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE '📄 Response (raw text):';
          RAISE NOTICE '%', LEFT(response_content, 1000);
      END;
    ELSE
      RAISE WARNING '⚠️ No response content received';
    END IF;
  ELSE
    RAISE WARNING '⚠️ No response found. The function may still be processing.';
    RAISE NOTICE '💡 Check again in a few minutes with:';
    RAISE NOTICE '   SELECT * FROM net.http_response WHERE id = %;', http_response_id;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
END $$;





