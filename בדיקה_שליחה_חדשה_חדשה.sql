-- ✅ בדיקה: האם חדשה חדשה נשלחת ב-Push?
-- ===========================================

-- שלב 1: בדוק שהטריגר קיים
SELECT 
  '🔍 בדיקת טריגר' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ הטריגר קיים!'
    ELSE '❌ הטריגר לא קיים - הרץ את יצירת_טריגר_עכשיו.sql'
  END as status
FROM information_schema.triggers tg
WHERE tg.event_object_table = 'app_news_clean'
  AND tg.event_object_schema = 'public'
  AND tg.trigger_name = 'on_new_news_article';

-- שלב 2: בדוק שההגדרות פעילות
SELECT 
  '⚙️ בדיקת הגדרות' as check_name,
  uns.notifications_enabled,
  uns.news_notifications,
  CASE 
    WHEN uns.notifications_enabled = true AND (uns.news_notifications = true OR uns.news_notifications IS NULL) THEN '✅ הכל פעיל!'
    ELSE '❌ צריך להפעיל התראות - הרץ את הפעלת_התראות_עכשיו.sql'
  END as status
FROM user_notification_settings uns
WHERE uns.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- שלב 3: בדוק כמה device tokens פעילים יש
SELECT 
  '📱 Device Tokens פעילים' as check_name,
  COUNT(*) as active_tokens,
  COUNT(*) FILTER (WHERE device_id = 'M2102J20SG') as physical_device,
  COUNT(*) FILTER (WHERE device_id LIKE 'sdk_%') as emulator
FROM device_tokens
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND is_active = true;

-- שלב 4: הוסף חדשה חדשה (זה אמור להפעיל את הטריגר!)
INSERT INTO app_news_clean (id, label, text, source, time, img)
VALUES (
  -- id - יוצר ID ייחודי
  'test_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
  -- label - כותרת קצרה
  '🔔 חדשה חדשה! - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  -- text - תוכן החדשה
  'זה בדיקה של מערכת התראות Push. החדשה נוספה ב-' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '. אם אתה רואה את זה, ה-trigger עובד! 🎉',
  -- source - מקור
  'מערכת בדיקות',
  -- time - זמן
  TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  -- img - תמונה (אופציונלי)
  NULL
)
RETURNING id, label, text, source, time;

-- המתן שנייה כדי שהטריגר יעבוד
SELECT pg_sleep(2);

-- שלב 5: בדוק אם נוצרה התראה
SELECT 
  '📋 התראות שנוצרו מהטריגר' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
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

-- שלב 6: אם יש התראה ממתינה, קרא ל-Edge Function
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
    RAISE NOTICE '💡 בדוק את המכשיר - האם ההתראה הגיעה?';
    RAISE NOTICE '💡 בדוק את הלוגים: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs';
  ELSE
    RAISE NOTICE 'ℹ️ אין התראות ממתינות - הטריגר כנראה כבר קרא ל-Edge Function';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה: %', SQLERRM;
END $$;

-- שלב 7: בדיקה סופית
SELECT 
  '📊 סיכום' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '2 minutes' AND notification_type = 'news') as pending_news,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '2 minutes' AND notification_type = 'news') as sent_news
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND created_at > NOW() - INTERVAL '5 minutes';


