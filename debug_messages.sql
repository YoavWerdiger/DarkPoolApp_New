-- סקריפט לבדיקת הודעות והרשאות
-- הרץ את זה ב-Supabase SQL Editor

-- 1. בדוק את כל ההודעות
SELECT 
  m.id,
  m.content,
  m.sender_id,
  m.channel_id,
  m.created_at,
  u.full_name as sender_name
FROM messages m
LEFT JOIN users u ON m.sender_id = u.id
ORDER BY m.created_at DESC
LIMIT 10;

-- 2. בדוק את חברי הערוצים
SELECT 
  cm.channel_id,
  cm.user_id,
  c.name as channel_name,
  u.full_name as user_name
FROM channel_members cm
JOIN channels c ON cm.channel_id = c.id
JOIN users u ON cm.user_id = u.id
ORDER BY c.name, u.full_name;

-- 3. בדוק את הפוליסות RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- 4. בדוק אם RLS מופעל
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'messages';

-- 5. בדוק הודעות לערוץ ספציפי (החלף את CHANNEL_ID)
-- SELECT 
--   m.id,
--   m.content,
--   m.sender_id,
--   m.created_at,
--   u.full_name as sender_name
-- FROM messages m
-- LEFT JOIN users u ON m.sender_id = u.id
-- WHERE m.channel_id = 'CHANNEL_ID'
-- ORDER BY m.created_at DESC; 