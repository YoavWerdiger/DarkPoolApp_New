-- ✅ הוספת חדשה דמה לבדיקת התראות
-- =====================================

INSERT INTO app_news_clean (id, label, text, source, time, img)
VALUES (
  -- id - יוצר ID ייחודי
  'test_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
  -- label - כותרת קצרה
  'בדיקת התראות Push - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  -- text - תוכן החדשה
  'זה בדיקה של מערכת התראות Push. החדשה נוספה ב-' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || '. אם אתה רואה את זה, ה-trigger עובד!',
  -- source - מקור
  'מערכת בדיקות',
  -- time - זמן
  TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  -- img - תמונה (אופציונלי)
  NULL
)
RETURNING id, label, text, source, time, created_at;

-- ✅ מיד אחרי זה, בדוק אם נוצרה התראה:
SELECT 
  'בדיקת התראות שנוצרו' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '1 minute'
ORDER BY pn.created_at DESC;


