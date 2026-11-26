-- 🧪 טסט מהיר לבדיקת Realtime
-- הרץ את זה אחרי שהרצת את enable_realtime_messages.sql

-- 1. בדוק שREPLICA IDENTITY מוגדר נכון
DO $$
DECLARE
  v_messages_replica TEXT;
  v_channels_replica TEXT;
BEGIN
  SELECT CASE relreplident 
    WHEN 'f' THEN 'FULL' 
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'n' THEN 'NOTHING'
    ELSE 'UNKNOWN'
  END INTO v_messages_replica
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'messages';

  SELECT CASE relreplident 
    WHEN 'f' THEN 'FULL' 
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'n' THEN 'NOTHING'
    ELSE 'UNKNOWN'
  END INTO v_channels_replica
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'channels';

  RAISE NOTICE '✅ Checking REPLICA IDENTITY...';
  RAISE NOTICE 'messages: % (should be FULL)', v_messages_replica;
  RAISE NOTICE 'channels: % (should be FULL)', v_channels_replica;
  
  IF v_messages_replica = 'FULL' AND v_channels_replica = 'FULL' THEN
    RAISE NOTICE '✅ REPLICA IDENTITY is configured correctly!';
  ELSE
    RAISE WARNING '❌ REPLICA IDENTITY is NOT configured correctly!';
    RAISE WARNING 'Run enable_realtime_messages.sql first!';
  END IF;
END $$;

-- 2. בדוק policies
SELECT 
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ Policies look good'
    ELSE '❌ Missing policies - run enable_realtime_messages.sql'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'messages';

-- 3. רשימת כל ה-policies
SELECT 
  '📋 ' || policyname as policy_name,
  cmd as command
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'messages'
ORDER BY policyname;

-- 4. בדוק שיש ערוצים והודעות
SELECT 
  '📊 Database Stats:' as info,
  (SELECT COUNT(*) FROM public.channels) as total_channels,
  (SELECT COUNT(*) FROM public.messages) as total_messages,
  (SELECT COUNT(*) FROM public.channel_members) as total_members;

-- 5. הצג ערוץ לדוגמה
SELECT 
  '📱 Sample Channel:' as info,
  c.id,
  c.name,
  (SELECT COUNT(*) FROM public.channel_members WHERE channel_id = c.id) as members,
  (SELECT COUNT(*) FROM public.messages WHERE channel_id = c.id) as messages
FROM public.channels c
ORDER BY c.created_at DESC
LIMIT 1;

-- תוצאה מצופה:
-- ✅ REPLICA IDENTITY is configured correctly!
-- ✅ Policies look good (4+ policies)
-- 📊 יש ערוצים והודעות

