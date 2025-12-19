-- ============================================
-- בדיקה ישירה של Benzinga API - תאריך קרוב
-- ============================================
-- 
-- זה בודק אם ה-API מחזיר נתונים לתאריך קרוב (היום או מחר)

DO $$
DECLARE
  api_key TEXT := 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC';
  today_est DATE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  tomorrow_est DATE := (today_est + INTERVAL '1 day')::DATE;
  test_dates DATE[] := ARRAY[today_est, tomorrow_est, (today_est + INTERVAL '2 days')::DATE];
  test_date DATE;
  api_url TEXT;
  http_response_id BIGINT;
  response_status INT;
  response_content TEXT;
  parsed_json JSONB;
  earnings_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקה ישירה של Benzinga API';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  FOREACH test_date IN ARRAY test_dates
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📅 בודק תאריך: %', test_date;
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- בניית URL
    api_url := 'https://api.benzinga.com/api/v2/calendar/earnings?' ||
      'token=' || api_key ||
      '&accept=application/json' ||
      '&parameters[date]=' || test_date::TEXT ||
      '&page=0' ||
      '&pagesize=10';
    
    RAISE NOTICE '📡 שולח בקשה...';
    
    -- קריאה ל-API
    SELECT net.http_get(
      url := api_url,
      headers := jsonb_build_object(
        'Accept', 'application/json',
        'Content-Type', 'application/json'
      )
    ) INTO http_response_id;
    
    RAISE NOTICE '✅ הבקשה נשלחה! HTTP Response ID: %', http_response_id;
    RAISE NOTICE '⏳ ממתין 5 שניות...';
    
    -- המתן 5 שניות
    PERFORM pg_sleep(5);
    
    -- בדיקת התשובה
    SELECT status, content
    INTO response_status, response_content
    FROM net.http_response_queue
    WHERE id = http_response_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF response_status IS NOT NULL THEN
      RAISE NOTICE '';
      RAISE NOTICE '📥 תשובה:';
      RAISE NOTICE '   Status: %', response_status;
      
      IF response_status = 200 THEN
        BEGIN
          parsed_json := response_content::JSONB;
          
          -- בדיקה אם יש earnings
          IF parsed_json ? 'earnings' THEN
            earnings_count := jsonb_array_length(parsed_json->'earnings');
            RAISE NOTICE '   ✅ נמצאו % דיווחים!', earnings_count;
            
            IF earnings_count > 0 THEN
              RAISE NOTICE '';
              RAISE NOTICE '   📊 דוגמה ראשונה:';
              RAISE NOTICE '%', jsonb_pretty(parsed_json->'earnings'->0);
            END IF;
          ELSIF jsonb_typeof(parsed_json) = 'array' THEN
            earnings_count := jsonb_array_length(parsed_json);
            RAISE NOTICE '   ✅ נמצאו % דיווחים (מערך ישיר)!', earnings_count;
          ELSE
            RAISE NOTICE '   ⚠️ פורמט תשובה לא צפוי: %', jsonb_typeof(parsed_json);
            RAISE NOTICE '   Content: %', SUBSTRING(response_content, 1, 500);
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '   ❌ שגיאה בפרסור JSON: %', SQLERRM;
            RAISE NOTICE '   Content: %', SUBSTRING(response_content, 1, 500);
        END;
      ELSIF response_status = 401 THEN
        RAISE NOTICE '   ❌ 401 Unauthorized - API Key לא תקין!';
      ELSE
        RAISE NOTICE '   ❌ שגיאה: Status %', response_status;
        RAISE NOTICE '   Content: %', SUBSTRING(response_content, 1, 500);
      END IF;
    ELSE
      RAISE NOTICE '   ⏳ התשובה עדיין לא מוכנה';
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ בדיקה הושלמה!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '💡 אם אין דיווחים בתאריכים האלה, נסה תאריכים בעבר (למשל חודש אחורה)';
  RAISE NOTICE '';
END $$;







