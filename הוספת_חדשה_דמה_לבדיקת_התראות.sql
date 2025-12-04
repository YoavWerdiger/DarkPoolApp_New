-- ✅ הוספת חדשה דמה לבדיקת התראות Push
-- ===========================================
-- הרץ את זה ב-Supabase SQL Editor כדי לבדוק אם אתה מקבל התראה
-- זה יוסיף חדשה חדשה, מה שיפעיל את הטריגר שיוצר התראה ב-pending_notifications

-- שלב 1: הוסף חדשה חדשה
INSERT INTO app_news_clean (id, label, text, source, time, img)
VALUES (
  -- id - יוצר ID ייחודי
  'test_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
  -- label - כותרת קצרה
  '🔔 בדיקת התראות Push - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
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

-- שלב 1ב: המתן שנייה כדי שהטריגר יעבוד
SELECT pg_sleep(1);

-- שלב 2: בדוק אם נוצרה התראה ב-pending_notifications (אמור לקרות אוטומטית דרך הטריגר)
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
  u.email as user_email,
  CASE 
    WHEN pn.is_sent = true THEN '✅ נשלחה'
    WHEN pn.is_sent = false AND pn.created_at > NOW() - INTERVAL '2 minutes' THEN '⏳ ממתינה לשליחה'
    ELSE '⚠️ ישנה'
  END as status
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '2 minutes'
  AND pn.notification_type = 'news'
ORDER BY pn.created_at DESC;

-- שלב 3: בדוק כמה device tokens פעילים יש
SELECT 
  '📱 Device Tokens פעילים - סיכום כללי' as check_name,
  COUNT(*) as active_tokens,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE platform = 'android') as android_count,
  COUNT(*) FILTER (WHERE platform = 'ios') as ios_count
FROM device_tokens
WHERE is_active = true;

-- שלב 3ב: פירוט לפי פלטפורמה
SELECT 
  '📱 Device Tokens לפי פלטפורמה' as check_name,
  platform,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens
WHERE is_active = true
GROUP BY platform;

-- שלב 4: בדוק את ההגדרות של המשתמש שלך (החלף את ה-user_id שלך)
SELECT 
  '⚙️ הגדרות התראות' as check_name,
  uns.user_id,
  uns.notifications_enabled,
  uns.news_notifications,
  u.email
FROM user_notification_settings uns
LEFT JOIN auth.users u ON uns.user_id = u.id
WHERE uns.user_id IN (
  SELECT DISTINCT user_id 
  FROM device_tokens 
  WHERE is_active = true
)
ORDER BY uns.user_id;

-- שלב 5: בדוק כמה התראות נשלחו לאחרונה
SELECT 
  '📊 סיכום התראות' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '2 minutes') as pending_now,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '2 minutes') as sent_recently,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '2 minutes') as total_recent
FROM pending_notifications
WHERE created_at > NOW() - INTERVAL '2 minutes'
  AND notification_type = 'news';

-- שלב 6: בדוק אם ה-Edge Function נקרא (בדוק ב-Logs של Supabase)
-- לך ל: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs
-- שם תראה:
--   - כמה התראות נמצאו
--   - כמה טוקנים פעילים נמצאו
--   - מה התשובה מ-Expo Push API
--   - אם יש שגיאות

-- שלב 7: אם ההתראות לא נשלחו אוטומטית, אפשר לקרוא ל-Edge Function ידנית
-- (הטריגר אמור לקרוא אוטומטית, אבל אם לא, אפשר להריץ את זה)
DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  -- רק אם יש התראות ממתינות
  IF EXISTS (SELECT 1 FROM pending_notifications WHERE is_sent = false AND created_at > NOW() - INTERVAL '2 minutes') THEN
    SELECT net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
      ),
      body := '{}'::jsonb
    ) INTO http_response_id;
    
    RAISE NOTICE '✅ Edge Function נקרא ידנית, HTTP Response ID: %', http_response_id;
    RAISE NOTICE '💡 בדוק את הלוגים ב: Supabase Dashboard > Edge Functions > process-pending-notifications > Logs';
  ELSE
    RAISE NOTICE 'ℹ️ אין התראות ממתינות - הטריגר כנראה כבר קרא ל-Edge Function';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ שגיאה בקריאה ל-Edge Function: %', SQLERRM;
    RAISE NOTICE '💡 נסה להריץ את ה-Edge Function ידנית דרך Supabase Dashboard';
END $$;

-- 📝 הערות:
-- ==========
-- 1. אחרי הרצת ה-SQL, בדוק את המכשיר שלך - אמור להגיע התראה תוך כמה שניות
-- 2. אם לא מגיעה התראה, בדוק:
--    - האם יש device token פעיל במסד הנתונים? (שלב 3)
--    - האם ההגדרות שלך מאפשרות התראות חדשות? (שלב 4)
--    - האם ה-Edge Function רץ? (בדוק ב-Logs)
--    - מה התשובה מ-Expo Push API? (בלוגים)
-- 3. אם יש התראה ב-pending_notifications אבל is_sent = false, זה אומר שה-Edge Function לא רץ או נכשל
-- 4. אם is_sent = true, ההתראה נשלחה - בדוק את המכשיר!
-- 5. אם הלוגים מראים "Sent 0/X notifications", זה אומר שהטוקנים לא תקינים או שיש בעיה ב-Expo Push API

