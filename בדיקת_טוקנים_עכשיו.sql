-- בדיקה מהירה: האם יש טוקנים במסד הנתונים?
-- הרץ את זה ב-SQL Editor של Supabase

-- 1. כל הטוקנים (20 האחרונים)
SELECT 
  id,
  user_id,
  LEFT(expo_push_token, 30) || '...' as token_preview,
  device_id,
  platform,
  is_active,
  created_at,
  updated_at
FROM device_tokens
ORDER BY created_at DESC
LIMIT 20;

-- 2. כמה טוקנים פעילים יש?
SELECT 
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM device_tokens;

-- 3. טוקנים לפי פלטפורמה
SELECT 
  platform,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_active = true) as active
FROM device_tokens
GROUP BY platform;


