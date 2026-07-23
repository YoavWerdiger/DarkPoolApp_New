-- 🔔 שליחה ידנית של התראה עם בדיקות מפורטות
-- ===========================================

-- שלב 1: בדוק את המצב הנוכחי
SELECT 
  '📋 מצב נוכחי - התראות ממתינות' as check_name,
  COUNT(*) as total_pending,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes') as recent_pending
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND is_sent = false;

-- שלב 2: בדוק את כל הטוקנים הפעילים
SELECT 
  '📱 כל הטוקנים הפעילים' as check_name,
  dt.id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.updated_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 3: הוסף התראה חדשה
INSERT INTO pending_notifications (
  user_id,
  title,
  body,
  notification_type,
  data,
  is_sent,
  created_at
) VALUES (
  'af781bb1-0529-4d80-9424-6564ec29457e',
  '🔔 בדיקת DarkPool - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  'זוהי התראה לבדיקה - האם אתה רואה "DarkPool" בשם האפליקציה? 🎉',
  'test',
  jsonb_build_object(
    'type', 'test',
    'timestamp', NOW()::text,
    'test', true,
    'message', 'התראה נשלחה לכל המכשירים שלך'
  ),
  false,
  NOW()
)
RETURNING id, user_id, title, body, created_at;

-- שלב 4: בדוק שההתראה נוספה
SELECT 
  '✅ התראה נוספה!' as status,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at
FROM pending_notifications pn
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.is_sent = false
  AND pn.created_at > NOW() - INTERVAL '1 minute'
ORDER BY pn.created_at DESC
LIMIT 5;

-- שלב 5: קריאה ל-Edge Function דרך pg_net
-- וודא ש-pg_net extension מופעל: CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
DECLARE
  http_response_id BIGINT;
  http_response_status INT;
  http_response_content TEXT;
BEGIN
  -- קריאה ל-Edge Function
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
    ),
    body := '{}'::jsonb
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ Edge Function נקרא, HTTP Response ID: %', http_response_id;
  RAISE NOTICE '💡 לך ל: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs';
  RAISE NOTICE '💡 שם תראה את כל הלוגים המפורטים';
  
  -- נחכה קצת ונבדוק את התשובה
  PERFORM pg_sleep(2);
  
  SELECT status, content INTO http_response_status, http_response_content
  FROM net.http_response
  WHERE id = http_response_id;
  
  IF http_response_status IS NOT NULL THEN
    RAISE NOTICE '📥 Response Status: %', http_response_status;
    RAISE NOTICE '📥 Response Content: %', http_response_content;
  ELSE
    RAISE NOTICE '⏳ Response עדיין לא מוכן, נסה שוב בעוד כמה שניות';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה בקריאה ל-Edge Function: %', SQLERRM;
    RAISE NOTICE '💡 נסה להריץ את ה-Edge Function ידנית דרך Supabase Dashboard';
END $$;

-- שלב 6: בדוק אם ההתראות נשלחו
SELECT 
  '📊 מצב אחרי שליחה' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false) as still_pending,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '2 minutes') as recently_sent
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND created_at > NOW() - INTERVAL '5 minutes';


