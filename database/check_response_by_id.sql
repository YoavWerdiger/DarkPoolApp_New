-- ============================================
-- בדיקת תגובה ספציפית לפי ID
-- ============================================

DO $$
DECLARE
  http_response_id TEXT := '00300952-9c73-4cc3-af7e-afdd4a0d7b99';
  response_status INT;
  response_content TEXT;
  response_headers JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📥 בדיקת תגובת HTTP לפי ID';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 מחפש HTTP Response ID: %', http_response_id;
  RAISE NOTICE '';
  
  -- המתן קצת לפני בדיקת התגובה
  PERFORM pg_sleep(2);
  
  -- בדיקת התגובה מ-http_response_queue
  SELECT status, content, headers
  INTO response_status, response_content, response_headers
  FROM net.http_response_queue
  WHERE id::text = http_response_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF response_status IS NOT NULL THEN
    RAISE NOTICE '✅ נמצאה תשובה!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 פרטי התשובה:';
    RAISE NOTICE '   ├─ Status Code: %', response_status;
    
    -- בדיקת סטטוס
    IF response_status = 200 THEN
      RAISE NOTICE '   ├─ Status: ✅ SUCCESS';
    ELSIF response_status = 401 THEN
      RAISE NOTICE '   ├─ Status: ❌ UNAUTHORIZED - Missing API Key';
    ELSIF response_status = 404 THEN
      RAISE NOTICE '   ├─ Status: ❌ NOT FOUND - Function not deployed';
    ELSIF response_status = 500 THEN
      RAISE NOTICE '   ├─ Status: ❌ SERVER ERROR - Check function logs';
    ELSE
      RAISE NOTICE '   ├─ Status: ⚠️ %', response_status;
    END IF;
    
    RAISE NOTICE '';
    
    -- ניסיון לפרסר את התוכן כ-JSON
    IF response_content IS NOT NULL THEN
      BEGIN
        DECLARE
          response_json JSONB;
        BEGIN
          response_json := response_content::jsonb;
          RAISE NOTICE '📄 Response Content (JSON):';
          RAISE NOTICE '%', jsonb_pretty(response_json);
          
          -- בדיקת שגיאות ספציפיות
          IF response_json->>'success' = 'false' THEN
            RAISE NOTICE '';
            RAISE NOTICE '❌ Function returned error:';
            RAISE NOTICE '   %', response_json->>'error';
          ELSIF response_json->>'success' = 'true' THEN
            RAISE NOTICE '';
            RAISE NOTICE '✅ Function completed successfully!';
            RAISE NOTICE '📊 Inserted records: %', response_json->>'inserted_count';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '📄 Response Content (raw text):';
            RAISE NOTICE '%', LEFT(response_content, 1000);
        END;
      END;
    ELSE
      RAISE NOTICE '⚠️ No response content';
    END IF;
    
    IF response_headers IS NOT NULL THEN
      RAISE NOTICE '';
      RAISE NOTICE '📋 Response Headers:';
      RAISE NOTICE '%', jsonb_pretty(response_headers);
    END IF;
    
  ELSE
    RAISE NOTICE '⏳ התשובה עדיין לא מוכנה או לא נמצאה';
    RAISE NOTICE '';
    RAISE NOTICE '💡 נסה שוב בעוד כמה שניות, או בדוק את הלוגים:';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/daily-earnings-sync-v2/logs';
    RAISE NOTICE '';
    
    -- ננסה למצוא את התשובה האחרונה בכלל
    SELECT status, content, headers
    INTO response_status, response_content, response_headers
    FROM net.http_response_queue
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF response_status IS NOT NULL THEN
      RAISE NOTICE '📊 התשובה האחרונה בכלל:';
      RAISE NOTICE '   ├─ Status: %', response_status;
      RAISE NOTICE '   └─ Content: %', LEFT(response_content, 200);
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
END $$;

-- הצגת כל התשובות האחרונות
SELECT 
  id::text,
  status,
  LEFT(content, 200) as content_preview,
  created_at
FROM net.http_response_queue
WHERE url LIKE '%daily-earnings-sync-v2%'
ORDER BY created_at DESC
LIMIT 5;




