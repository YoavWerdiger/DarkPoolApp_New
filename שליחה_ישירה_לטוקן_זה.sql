-- 🔔 שליחה ישירה לטוקן הספציפי
-- ===========================================
-- Token: ExponentPushToken[2vyBusP8YAUVCjygab20ta]
-- Device: sdk_gphone64_arm64 (אמולטור)

-- שלב 1: הוספת התראה ל-pending_notifications
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
  'זוהי התראה ישירה לטוקן הספציפי - האם אתה רואה "DarkPool" בשם האפליקציה? 🎉',
  'test',
  jsonb_build_object(
    'type', 'test',
    'timestamp', NOW()::text,
    'test', true,
    'message', 'התראה נשלחה לטוקן: ExponentPushToken[2vyBusP8YAUVCjygab20ta]',
    'device', 'sdk_gphone64_arm64'
  ),
  false,
  NOW()
)
RETURNING id, user_id, title, body, created_at;

-- שלב 2: בדיקה שההתראה נוספה
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
LIMIT 1;

-- שלב 3: בדיקה שיש device token פעיל
SELECT 
  '✅ Device Token פעיל' as status,
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.updated_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.expo_push_token = 'ExponentPushToken[2vyBusP8YAUVCjygab20ta]'
  AND dt.is_active = true;

-- שלב 4: קריאה ל-Edge Function דרך pg_net
DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
    ),
    body := '{}'::jsonb
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ Edge Function נקרא, HTTP Response ID: %', http_response_id;
  RAISE NOTICE '💡 בדוק את הלוגים ב: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs';
  RAISE NOTICE '💡 שם תראה את התשובה מ-Expo Push API';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה בקריאה ל-Edge Function: %', SQLERRM;
    RAISE NOTICE '💡 נסה להריץ את ה-Edge Function ידנית דרך Supabase Dashboard';
END $$;

-- שלב 5: בדיקה אם ההתראה נשלחה
SELECT 
  '📊 מצב אחרי שליחה' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '2 minutes') as still_pending,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '2 minutes') as recently_sent
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND created_at > NOW() - INTERVAL '5 minutes';


