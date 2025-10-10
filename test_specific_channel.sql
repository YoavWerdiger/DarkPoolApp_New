-- 🎯 טסט ספציפי לערוץ "איתותים וסטאפים"
-- הערוץ שלך: f66809c0-b2ec-48a9-8e93-76d13f0b8fa5

-- 1. בדוק את חברי הערוץ
SELECT 
  '👥 Channel Members:' as info,
  cm.user_id,
  u.full_name,
  u.email
FROM channel_members cm
JOIN users u ON u.id = cm.user_id
WHERE cm.channel_id = 'f66809c0-b2ec-48a9-8e93-76d13f0b8fa5';

-- 2. בדוק את ההודעות האחרונות
SELECT 
  '📨 Recent Messages:' as info,
  m.id,
  m.content,
  m.created_at,
  u.full_name as sender_name
FROM messages m
JOIN users u ON u.id = m.sender_id
WHERE m.channel_id = 'f66809c0-b2ec-48a9-8e93-76d13f0b8fa5'
ORDER BY m.created_at DESC
LIMIT 5;

-- 3. שלח הודעת טסט מאחד המשתמשים בערוץ
-- (החלף את YOUR_USER_ID עם אחד מה-user_id מהשאילתה הראשונה)

-- דוגמה:
-- INSERT INTO public.messages (channel_id, sender_id, content, type)
-- VALUES (
--   'f66809c0-b2ec-48a9-8e93-76d13f0b8fa5',
--   'YOUR_USER_ID_HERE',  -- <-- שים כאן user_id מהרשימה למעלה
--   '🧪 TEST: אם אתה רואה את זה בזמן אמת - realtime עובד! ' || NOW()::TEXT,
--   'text'
-- );

-- 4. בדוק REPLICA IDENTITY (צריך להיות FULL)
SELECT 
  '🔧 REPLICA IDENTITY Check:' as info,
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'f' THEN '✅ FULL (Good!)'
    WHEN 'd' THEN '❌ DEFAULT (Bad - run enable_realtime_messages.sql)'
    WHEN 'n' THEN '❌ NOTHING (Bad - run enable_realtime_messages.sql)'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relname IN ('messages', 'channels', 'channel_members')
ORDER BY c.relname;

