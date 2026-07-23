-- 🔍 בדיקה מהירה - האם נוצרו התראות?
-- ===========================================

-- בדוק את כל ההתראות האחרונות
SELECT 
  '📋 כל ההתראות האחרונות' as check_name,
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
    WHEN pn.is_sent = false THEN '⏳ ממתינה'
    ELSE '⚠️ לא ידוע'
  END as status
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY pn.created_at DESC
LIMIT 10;

-- סיכום מהיר
SELECT 
  '📊 סיכום' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '10 minutes') as pending,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '10 minutes') as sent,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes') as total
FROM pending_notifications
WHERE created_at > NOW() - INTERVAL '10 minutes';


