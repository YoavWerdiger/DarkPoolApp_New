-- 🔍 בדיקה מהירה - למה אין device token?
-- ======================================

-- בדיקה 1: האם יש device tokens בכלל במערכת?
SELECT 
  'בדיקה 1: Device Tokens במערכת' as check_name,
  COUNT(*) as total_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens;

-- בדיקה 2: האם המשתמש קיים והתחבר לאחרונה?
SELECT 
  'בדיקה 2: פרטי המשתמש' as check_name,
  id,
  email,
  last_sign_in_at,
  CASE 
    WHEN last_sign_in_at IS NULL THEN '❌ לא התחבר מעולם'
    WHEN last_sign_in_at > NOW() - INTERVAL '1 hour' THEN '✅ התחבר לאחרונה'
    ELSE '⚠️ התחבר לפני יותר משעה'
  END as status
FROM auth.users
WHERE id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- בדיקה 3: האם יש device tokens לא פעילים למשתמש?
SELECT 
  'בדיקה 3: Device Tokens למשתמש (גם לא פעילים)' as check_name,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active,
  COUNT(*) FILTER (WHERE is_active = false) as inactive
FROM device_tokens
WHERE user_id = 'af781bb1-0529-4d80-9424-6564ec29457e';

-- בדיקה 4: הצג את כל ה-device tokens האחרונים במערכת
SELECT 
  'בדיקה 4: Device Tokens האחרונים במערכת' as check_name,
  dt.id,
  LEFT(dt.expo_push_token, 20) || '...' as token,
  dt.platform,
  dt.is_active,
  dt.created_at,
  u.email
FROM device_tokens dt
LEFT JOIN auth.users u ON dt.user_id = u.id
ORDER BY dt.created_at DESC
LIMIT 5;



