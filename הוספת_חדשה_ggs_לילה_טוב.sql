-- ✅ הוספת חדשה חדשה: "ggs לילה טוב"
-- ===========================================
-- זה יוסיף חדשה חדשה ל-app_news_clean
-- הטריגר אמור ליצור התראה אוטומטית עם התוכן הזה

-- הוספת החדשה
INSERT INTO app_news_clean (id, label, text, source, time, img)
VALUES (
  -- id - יוצר ID ייחודי
  'test_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
  -- label - כותרת קצרה
  'ggs לילה טוב',
  -- text - תוכן החדשה
  'ggs לילה טוב',
  -- source - מקור
  'מערכת',
  -- time - זמן
  TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  -- img - תמונה (אופציונלי)
  NULL
)
RETURNING id, label, text, source, time;

-- המתן שנייה כדי שהטריגר יעבוד
SELECT pg_sleep(2);

-- בדוק אם נוצרה התראה
SELECT 
  '📋 התראות שנוצרו' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  pn.data,
  CASE 
    WHEN pn.is_sent = true THEN '✅ נשלחה!'
    WHEN pn.is_sent = false AND pn.created_at > NOW() - INTERVAL '2 minutes' THEN '⏳ ממתינה לשליחה'
    ELSE '⚠️ ישנה'
  END as status
FROM pending_notifications pn
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.created_at > NOW() - INTERVAL '2 minutes'
  AND pn.notification_type = 'news'
ORDER BY pn.created_at DESC;

-- אם יש התראה ממתינה, קרא ל-Edge Function
DO $$
DECLARE
  pending_count INT;
  http_response_id BIGINT;
BEGIN
  -- בדוק כמה התראות ממתינות
  SELECT COUNT(*) INTO pending_count
  FROM pending_notifications
  WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
    AND is_sent = false
    AND created_at > NOW() - INTERVAL '2 minutes'
    AND notification_type = 'news';
  
  IF pending_count > 0 THEN
    -- קרא ל-Edge Function
    SELECT net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
      ),
      body := '{}'::jsonb
    ) INTO http_response_id;
    
    RAISE NOTICE '✅ Edge Function נקרא, HTTP Response ID: %', http_response_id;
    RAISE NOTICE '💡 בדוק את המכשיר - האם ההתראה הגיעה עם התוכן "ggs לילה טוב"?';
  ELSE
    RAISE NOTICE 'ℹ️ אין התראות ממתינות - הטריגר כנראה כבר קרא ל-Edge Function';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה: %', SQLERRM;
END $$;


