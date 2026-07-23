-- 🔍 בדיקה: למה ההתראה לא נשלחה?
-- ===========================================

-- שלב 1: בדוק את ההתראות הממתינות
SELECT 
  '📋 התראות ממתינות' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  EXTRACT(EPOCH FROM (NOW() - pn.created_at)) as seconds_since_created
FROM pending_notifications pn
WHERE pn.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND pn.is_sent = false
  AND pn.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY pn.created_at DESC;

-- שלב 2: בדוק את הטוקן של המכשיר הפיזי
SELECT 
  '📱 טוקן מכשיר פיזי' as check_name,
  dt.id,
  dt.expo_push_token,
  dt.device_id,
  dt.platform,
  dt.is_active,
  dt.created_at,
  dt.updated_at,
  CASE 
    WHEN dt.expo_push_token = 'ExponentPushToken[DOalseKrRSRTo2aoJEvdmE]' THEN '✅ זה הטוקן הנכון!'
    ELSE '❌ זה לא הטוקן הנכון'
  END as token_match
FROM device_tokens dt
WHERE dt.user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND dt.is_active = true
ORDER BY dt.updated_at DESC;

-- שלב 3: בדוק אם יש התראות שנשלחו לאחרונה
SELECT 
  '📊 סיכום התראות' as check_name,
  COUNT(*) FILTER (WHERE is_sent = false AND created_at > NOW() - INTERVAL '10 minutes') as pending,
  COUNT(*) FILTER (WHERE is_sent = true AND sent_at > NOW() - INTERVAL '10 minutes') as sent,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes') as total
FROM pending_notifications
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e'
  AND created_at > NOW() - INTERVAL '10 minutes';

-- 💡 אם יש התראה ממתינה, נסה להריץ את ה-Edge Function ידנית:
-- לך ל: Supabase Dashboard > Edge Functions > process-pending-notifications > Invoke
-- ושלח: {"specificToken": "ExponentPushToken[DOalseKrRSRTo2aoJEvdmE]", "specificDeviceId": "M2102J20SG"}


