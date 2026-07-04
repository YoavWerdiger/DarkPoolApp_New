-- ============================================
-- בדיקה ישירה של Benzinga API
-- ============================================
-- 
-- זה בודק אם ה-API מחזיר נתונים בכלל

DO $$
DECLARE
  api_key TEXT := 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC';
  test_date TEXT := '2025-12-10'; -- תאריך היום + 3 ימים
  api_url TEXT;
  http_response_id BIGINT;
  response_status INT;
  response_content TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקה ישירה של Benzinga API';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 בודק תאריך: %', test_date;
  RAISE NOTICE '';
  
  -- בניית URL
  api_url := 'https://api.benzinga.com/api/v2/calendar/earnings?' ||
    'token=' || api_key ||
    '&accept=application/json' ||
    '&parameters[date]=' || test_date ||
    '&page=0' ||
    '&pagesize=10';
  
  RAISE NOTICE '📡 API URL: %', REPLACE(api_url, api_key, '***');
  RAISE NOTICE '';
  RAISE NOTICE '🚀 שולח בקשה...';
  
  -- קריאה ל-API
  SELECT net.http_get(
    url := api_url,
    headers := jsonb_build_object(
      'Accept', 'application/json',
      'Content-Type', 'application/json'
    )
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ הבקשה נשלחה! HTTP Response ID: %', http_response_id;
  RAISE NOTICE '';
  RAISE NOTICE '⏳ ממתין 10 שניות לתשובה...';
  
  -- המתן 10 שניות
  PERFORM pg_sleep(10);
  
  -- בדיקת התשובה
  SELECT status, content
  INTO response_status, response_content
  FROM net.http_response_queue
  WHERE id = http_response_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF response_status IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📥 תשובה מה-API';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE 'Status: %', response_status;
    RAISE NOTICE '';
    RAISE NOTICE 'Content (first 2000 chars):';
    RAISE NOTICE '%', SUBSTRING(response_content, 1, 2000);
    RAISE NOTICE '';
    
    IF response_status = 200 THEN
      -- ננסה לפרסר את ה-JSON
      BEGIN
        DECLARE
          parsed_json JSONB;
          earnings_count INT;
        BEGIN
          parsed_json := response_content::JSONB;
          
          -- בדיקה אם יש earnings
          IF parsed_json ? 'earnings' THEN
            earnings_count := jsonb_array_length(parsed_json->'earnings');
            RAISE NOTICE '✅ נמצאו % דיווחים בתאריך %', earnings_count, test_date;
            
            IF earnings_count > 0 THEN
              RAISE NOTICE '';
              RAISE NOTICE '📊 דוגמה ראשונה:';
              RAISE NOTICE '%', jsonb_pretty(parsed_json->'earnings'->0);
            ELSE
              RAISE NOTICE '⚠️ אין דיווחים בתאריך הזה';
            END IF;
          ELSIF jsonb_typeof(parsed_json) = 'array' THEN
            earnings_count := jsonb_array_length(parsed_json);
            RAISE NOTICE '✅ נמצאו % דיווחים (מערך ישיר)', earnings_count;
          ELSE
            RAISE NOTICE '⚠️ פורמט תשובה לא צפוי: %', jsonb_typeof(parsed_json);
            RAISE NOTICE 'Full response: %', parsed_json;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '⚠️ שגיאה בפרסור JSON: %', SQLERRM;
        END;
      END;
    ELSIF response_status = 401 THEN
      RAISE NOTICE '❌ 401 Unauthorized - API Key לא תקין!';
    ELSIF response_status >= 400 THEN
      RAISE NOTICE '❌ שגיאה: Status %', response_status;
    END IF;
  ELSE
    RAISE NOTICE '⏳ התשובה עדיין לא מוכנה';
    RAISE NOTICE '💡 נסה שוב בעוד כמה שניות';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;








