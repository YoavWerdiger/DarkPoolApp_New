-- ============================================
-- בדיקת תשובת HTTP מה-Edge Function
-- ============================================
-- 
-- זה בודק את התשובה מה-HTTP request שנשלח ל-Edge Function

-- בדיקת תשובת HTTP האחרונה
DO $$
DECLARE
  http_response_id BIGINT := 3068; -- ה-ID מהריצה האחרונה
  response_status INT;
  response_content TEXT;
  response_headers JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📥 בדיקת תשובת HTTP מה-Edge Function';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 מחפש HTTP Response ID: %', http_response_id;
  RAISE NOTICE '';
  
  -- נחכה קצת כדי שהתשובה תהיה מוכנה
  PERFORM pg_sleep(5);
  
  -- בדיקת התשובה
  SELECT status, content, headers
  INTO response_status, response_content, response_headers
  FROM net.http_response_queue
  WHERE id = http_response_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF response_status IS NOT NULL THEN
    RAISE NOTICE '✅ נמצאה תשובה!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 פרטי התשובה:';
    RAISE NOTICE '   ├─ Status: %', response_status;
    RAISE NOTICE '   ├─ Content: %', SUBSTRING(response_content, 1, 500);
    RAISE NOTICE '   └─ Headers: %', response_headers;
    RAISE NOTICE '';
    
    IF response_status = 200 THEN
      RAISE NOTICE '✅ Status 200 - הפונקציה רצה בהצלחה!';
      RAISE NOTICE '💡 אם אין דיווחים, בדוק את הלוגים של ה-Edge Function';
    ELSIF response_status >= 400 THEN
      RAISE NOTICE '❌ Status % - יש שגיאה!', response_status;
      RAISE NOTICE '💡 בדוק את התוכן של response_content למעלה';
    ELSE
      RAISE NOTICE '⚠️ Status % - תשובה לא צפויה', response_status;
    END IF;
  ELSE
    RAISE NOTICE '⏳ התשובה עדיין לא מוכנה או לא נמצאה';
    RAISE NOTICE '';
    RAISE NOTICE '💡 נסה שוב בעוד כמה שניות, או בדוק את הלוגים:';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
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
      RAISE NOTICE '   ├─ Content: %', SUBSTRING(response_content, 1, 500);
      RAISE NOTICE '   └─ Created At: (התשובה האחרונה)';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 מה הלאה:';
  RAISE NOTICE '   1. בדוק את הלוגים:';
  RAISE NOTICE '      https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
  RAISE NOTICE '   2. חפש: daily-earnings-sync-simple';
  RAISE NOTICE '   3. בדוק אם יש שגיאות (❌) או אזהרות (⚠️)';
  RAISE NOTICE '';
END $$;

-- הצגת כל התשובות האחרונות (אם יש)
SELECT 
  id,
  status,
  SUBSTRING(content, 1, 200) as content_preview,
  created_at
FROM net.http_response_queue
ORDER BY created_at DESC
LIMIT 5;








