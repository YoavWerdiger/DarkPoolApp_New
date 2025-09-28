-- בדיקת הלוגיקה של חישוב הודעות שלא נקראו
-- נניח שיש לנו משתמש עם ID: 'test-user-id' בערוץ עם ID: 'test-channel-id'

-- 1. בדיקה מה יש בטבלת channel_members
SELECT 
  cm.channel_id,
  cm.user_id,
  cm.last_read_message_id
FROM channel_members cm
WHERE cm.channel_id = 'test-channel-id' 
  AND cm.user_id = 'test-user-id';

-- 2. בדיקה כמה הודעות יש בערוץ
SELECT 
  COUNT(*) as total_messages,
  MIN(created_at) as first_message,
  MAX(created_at) as last_message
FROM messages 
WHERE channel_id = 'test-channel-id';

-- 3. בדיקה מה ההודעה האחרונה שהמשתמש קרא
SELECT 
  m.id,
  m.content,
  m.created_at
FROM messages m
WHERE m.id = (
  SELECT cm.last_read_message_id 
  FROM channel_members cm
  WHERE cm.channel_id = 'test-channel-id' 
    AND cm.user_id = 'test-user-id'
);

-- 4. חישוב ידני של הודעות שלא נקראו
SELECT 
  COUNT(*) as unread_count
FROM messages m
WHERE m.channel_id = 'test-channel-id'
  AND m.created_at > (
    SELECT COALESCE(m2.created_at, '1970-01-01'::timestamp)
    FROM messages m2
    WHERE m2.id = (
      SELECT cm.last_read_message_id 
      FROM channel_members cm
      WHERE cm.channel_id = 'test-channel-id' 
        AND cm.user_id = 'test-user-id'
    )
  );
