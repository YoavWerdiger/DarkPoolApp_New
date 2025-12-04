-- ✅ שליחת התראות ידנית
-- =======================

-- בדיקה 1: כמה התראות ממתינות?
SELECT 
  'בדיקה 1: התראות ממתינות' as check_name,
  COUNT(*) as pending_count,
  COUNT(DISTINCT user_id) as unique_users
FROM pending_notifications
WHERE is_sent = false;

-- בדיקה 2: התראות ממתינות
SELECT 
  'בדיקה 2: רשימת התראות ממתינות' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  u.email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.is_sent = false
ORDER BY pn.created_at DESC
LIMIT 10;

-- הערה: כדי לשלוח את ההתראות, צריך לקרוא ל-Edge Function:
-- 1. דרך Supabase Dashboard > Edge Functions > process-pending-notifications > Invoke
-- 2. או דרך HTTP request:
--    POST https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications
--    Headers: Authorization: Bearer [SERVICE_ROLE_KEY]


