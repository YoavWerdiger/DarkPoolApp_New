-- 🔔 שליחת Push Notification לבדיקה - האם מופיע "DarkPool"?
-- ============================================================
-- User ID: af781bb1-0529-4d80-9424-6564ec29457e
-- כל הטוקנים הפעילים של המשתמש (כולל הטוקן החדש):
-- 1. ExponentPushToken[f6m0VqNKCZRizFhS0Un7Bt] - M2102J20SG
-- 2. ExponentPushToken[ZCV2YVMSuZGlTI_y5uceRB] - M2102J20SG
-- 3. ExponentPushToken[2vyBusP8YAUVCjygab20ta] - sdk_gphone64_arm64
-- 4. ExponentPushToken[DOalseKrRSRTo2aoJEvdmE] - M2102J20SG (חדש!)

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
  'זוהי התראה לבדיקה - האם אתה רואה "DarkPool" בשם האפליקציה? 🎉 ההתראה נשלחה לכל המכשירים שלך!',
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

-- שלב 2: בדיקה שההתראה נוספה
SELECT 
  '✅ התראה נוספה!' as status,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.is_sent = false
  AND pn.created_at > NOW() - INTERVAL '1 minute'
ORDER BY pn.created_at DESC
LIMIT 5;

-- שלב 3: בדיקה שיש device token פעיל
SELECT 
  '✅ Device Tokens פעילים' as status,
  dt.id,
  dt.user_id,
  LEFT(dt.expo_push_token, 30) || '...' as token_preview,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.updated_at
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- 📝 הערות:
-- ==========
-- אחרי הרצת הסקריפט הזה, צריך להריץ את ה-Edge Function:
-- 
-- דרך 1: Supabase Dashboard
-- 1. לך ל: Edge Functions > process-pending-notifications
-- 2. לחץ על "Invoke"
-- 3. לחץ על "Invoke function"
--
-- דרך 2: HTTP Request (curl)
-- curl -X POST https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications \
--   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A" \
--   -H "Content-Type: application/json"
--
-- שלב 4: שליחה אוטומטית דרך pg_net
-- וודא ש-pg_net extension מופעל: CREATE EXTENSION IF NOT EXISTS pg_net;
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
  RAISE NOTICE '📱 ההתראה נשלחה לכל שלושת הטוקנים הפעילים!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה בקריאה ל-Edge Function: %', SQLERRM;
    RAISE NOTICE '💡 נסה להריץ את ה-Edge Function ידנית דרך Supabase Dashboard';
END $$;

