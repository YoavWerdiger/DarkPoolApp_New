-- 🔔 שליחה למכשיר פרודקשן
-- ===========================================
-- Token: ExponentPushToken[DOalseKrRSRTo2aoJEvdmE]
-- Device: M2102J20SG (מכשיר פיזי - פרודקשן)

-- שלב 1: בדוק את הטוקן של המכשיר הפיזי (פרודקשן) בלבד
SELECT 
  '📱 טוקן מכשיר פיזי (פרודקשן)' as check_name,
  dt.id,
  dt.user_id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  dt.updated_at,
  CASE 
    WHEN dt.is_active = true THEN '✅ פעיל - נשלח התראה!'
    ELSE '❌ לא פעיל'
  END as status
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.expo_push_token = 'ExponentPushToken[DOalseKrRSRTo2aoJEvdmE]'
  AND dt.device_id = 'M2102J20SG'
  AND dt.is_active = true;


-- שלב 2: הוספת התראה ל-pending_notifications (רק למכשיר הפיזי)
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
  '🔔 בדיקת DarkPool - פרודקשן - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  'זוהי התראה למכשיר הפרודקשן שלך (M2102J20SG) - האם אתה רואה "DarkPool" בשם האפליקציה? האם האייקון של DarkPool מופיע? 🎉',
  'test',
  jsonb_build_object(
    'type', 'test',
    'timestamp', NOW()::text,
    'test', true,
    'message', 'התראה נשלחה למכשיר פרודקשן: M2102J20SG',
    'device', 'M2102J20SG',
    'token', 'ExponentPushToken[DOalseKrRSRTo2aoJEvdmE]',
    'appName', 'DarkPool',
    'buildType', 'production'
  ),
  false,
  NOW()
)
RETURNING id, user_id, title, body, created_at;

-- שלב 3: בדיקה שההתראה נוספה
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

-- שלב 4: קריאה ל-Edge Function דרך pg_net (רק למכשיר הפיזי!)
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
  RAISE NOTICE '';
  RAISE NOTICE '📱 עכשיו בדוק את המכשיר הפרודקשן:';
  RAISE NOTICE '   1. האם ההתראה הגיעה?';
  RAISE NOTICE '   2. האם אתה רואה "DarkPool" בשם האפליקציה?';
  RAISE NOTICE '   3. האם הלוגו של DarkPool מופיע?';
  RAISE NOTICE '';
  RAISE NOTICE '📋 בדוק את הלוגים:';
  RAISE NOTICE '   Supabase Dashboard > Edge Functions > process-pending-notifications > Logs';
  RAISE NOTICE '   שם תראה את התשובה מ-Expo Push API';
  RAISE NOTICE '   אם יש שגיאה, היא תופיע שם (למשל: DeviceNotRegistered, InvalidCredentials)';
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

-- 💡 הערות חשובות:
-- ================
-- אם ההתראה לא הגיעה בפרודקשן, בדוק:
-- 1. את הלוגים של Edge Function - מה התשובה מ-Expo Push API?
-- 2. אם התשובה היא "DeviceNotRegistered" - הטוקן פג תוקף, צריך להתחבר מחדש
-- 3. אם התשובה היא "InvalidCredentials" - יש בעיה בהגדרות Firebase/Expo
-- 4. בדוק שהטוקן לא ישן מדי (אם הוא ישן יותר מ-30 יום, הוא כנראה פג תוקף)

