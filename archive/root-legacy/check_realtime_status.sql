-- 🔍 בדיקה מקיפה של סטטוס Realtime
-- הרץ את זה ב-Supabase SQL Editor כדי לראות מה המצב

-- 1. בדוק אם publication קיים
SELECT 
  '🔔 Realtime Publication Status:' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ supabase_realtime publication EXISTS'
    ELSE '❌ supabase_realtime publication DOES NOT EXIST'
  END as status
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- 2. בדוק פרטי ה-publication
SELECT 
  '📋 Publication Details:' as info,
  pubname,
  puballtables as all_tables,
  pubinsert as tracks_insert,
  pubupdate as tracks_update,
  pubdelete as tracks_delete
FROM pg_publication
WHERE pubname = 'supabase_realtime';

-- 3. בדוק אילו טבלאות כבר ב-publication
SELECT 
  '📊 Tables in Realtime:' as info,
  schemaname,
  tablename,
  '✅ ENABLED' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 4. בדוק REPLICA IDENTITY
SELECT 
  '🔧 Replica Identity Status:' as info,
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'f' THEN '✅ FULL'
    WHEN 'd' THEN '⚠️  DEFAULT'
    WHEN 'n' THEN '❌ NOTHING'
  END as replica_identity,
  CASE c.relreplident
    WHEN 'f' THEN 'Perfect for realtime'
    WHEN 'd' THEN 'Will work but not optimal'
    WHEN 'n' THEN 'Will NOT work - fix required'
  END as explanation
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relname IN ('messages', 'channels', 'channel_members', 'users')
ORDER BY c.relname;

-- 5. בדוק permissions על הטבלאות
SELECT 
  '🔐 Table Permissions:' as info,
  schemaname,
  tablename,
  'RLS ' || CASE rowsecurity WHEN true THEN '✅ ON' ELSE '❌ OFF' END as security
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('messages', 'channels', 'channel_members', 'users')
ORDER BY tablename;

-- 6. רשימת כל ה-publications (לדיבוג)
SELECT 
  '📚 All Publications:' as info,
  pubname,
  puballtables
FROM pg_publication
ORDER BY pubname;

-- סיכום:
-- אם אתה רואה "supabase_realtime publication EXISTS" = טוב!
-- אם אתה רואה טבלאות ברשימה = עוד יותר טוב!
-- אם אתה רואה REPLICA IDENTITY = FULL = מושלם!

