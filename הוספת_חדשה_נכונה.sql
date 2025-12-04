-- ✅ הוספת חדשה חדשה ל-app_news_clean (לפי המבנה האמיתי)
-- ============================================================

INSERT INTO app_news_clean (id, label, text, source, time, img)
VALUES (
  -- id - יוצר ID ייחודי (timestamp + random)
  'test_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT,
  -- label - כותרת קצרה
  'בדיקת התראות - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  -- text - תוכן החדשה
  'זה בדיקה של מערכת התראות Push. החדשה נוספה ב-' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  -- source - מקור
  'מערכת',
  -- time - זמן
  TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  -- img - תמונה (אופציונלי)
  NULL
)
RETURNING id, label, text, source, time, created_at;

-- ✅ אחרי הוספת החדשה, בדוק אם נוצרה התראה:
SELECT 
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
WHERE pn.created_at > NOW() - INTERVAL '2 minutes'
ORDER BY pn.created_at DESC;


