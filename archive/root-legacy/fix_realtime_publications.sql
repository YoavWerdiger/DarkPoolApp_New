-- 🔧 תיקון Publications ל-Realtime
-- יש לך publications פעילים! עכשיו נוסיף את הטבלאות

-- 1. בדוק אילו טבלאות כבר בפרסומים
SELECT 
  '📊 Current tables in publications:' as info,
  p.pubname,
  COALESCE(pt.schemaname, 'none') as schema,
  COALESCE(pt.tablename, 'no tables yet') as table
FROM pg_publication p
LEFT JOIN pg_publication_tables pt ON pt.pubname = p.pubname
WHERE p.pubname IN ('supabase_realtime', 'supabase_realtime_messages_publication')
ORDER BY p.pubname, pt.tablename;

-- 2. הוסף את הטבלאות ל-publication הראשי (supabase_realtime)
-- זה מה שSupabase משתמש בו

-- הוסף messages
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  RAISE NOTICE '✅ Added messages to supabase_realtime';
EXCEPTION 
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  messages already in supabase_realtime';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error adding messages: %', SQLERRM;
END $$;

-- הוסף channels
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  RAISE NOTICE '✅ Added channels to supabase_realtime';
EXCEPTION 
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  channels already in supabase_realtime';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error adding channels: %', SQLERRM;
END $$;

-- הוסף channel_members
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
  RAISE NOTICE '✅ Added channel_members to supabase_realtime';
EXCEPTION 
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️  channel_members already in supabase_realtime';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error adding channel_members: %', SQLERRM;
END $$;

-- 3. ודא ש-REPLICA IDENTITY מוגדר (חובה!)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- 4. בדיקת תוצאות - אילו טבלאות כעת בפרסום
SELECT 
  '✅ Final check - Tables in supabase_realtime:' as result,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 5. בדיקת REPLICA IDENTITY
SELECT 
  '🔧 Replica Identity Status:' as check,
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'f' THEN '✅ FULL (Perfect!)'
    WHEN 'd' THEN '⚠️  DEFAULT (Not ideal)'
    WHEN 'n' THEN '❌ NOTHING (Bad!)'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relname IN ('messages', 'channels', 'channel_members', 'users')
ORDER BY c.relname;

-- הצלחה!
-- עכשיו הטבלאות צריכות להיות ב-realtime publication
-- אתחל את האפליקציה ונסה שוב!

