-- ✅ הוספת חדשה דמה למסד הנתונים
-- ===========================================
-- זה יוסיף חדשה חדשה ל-app_news_clean
-- אם הטריגר עובד, זה אמור ליצור התראה ב-pending_notifications

-- הוספת החדשה
INSERT INTO app_news_clean (id, label, text, source, time, img)
VALUES (
  -- id - יוצר ID ייחודי
  'test_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
  -- label - כותרת קצרה
  '🔔 בדיקת התראות Push #2 - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  -- text - תוכן החדשה
  'זה בדיקה נוספת של מערכת התראות Push. החדשה נוספה ב-' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '. אם אתה רואה את זה, ה-trigger עובד! 🎉',
  -- source - מקור
  'מערכת בדיקות',
  -- time - זמן
  TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  -- img - תמונה (אופציונלי)
  NULL
)
RETURNING id, label, text, source, time;

-- המתן שנייה כדי שהטריגר יעבוד
SELECT pg_sleep(1);

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
  u.email as user_email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '1 minute'
  AND pn.notification_type = 'news'
ORDER BY pn.created_at DESC;

