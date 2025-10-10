-- בדיקת הגדרות Realtime
-- הרץ את הקוד הזה ב-Supabase SQL Editor כדי לבדוק אם הכל מוגדר נכון

-- 1. בדוק REPLICA IDENTITY על הטבלאות
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN relreplident = 'd' THEN 'DEFAULT'
        WHEN relreplident = 'n' THEN 'NOTHING'
        WHEN relreplident = 'f' THEN 'FULL'
        WHEN relreplident = 'i' THEN 'INDEX'
    END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_tables t ON t.tablename = c.relname AND t.schemaname = n.nspname
WHERE schemaname = 'public' 
AND tablename IN ('messages', 'channels', 'channel_members', 'users')
ORDER BY tablename;

-- 2. בדוק RLS policies על messages
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
WHERE schemaname = 'public' 
AND tablename = 'messages'
ORDER BY policyname;

-- 3. בדוק אם יש הודעות בטבלה
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT channel_id) as total_channels,
    MAX(created_at) as latest_message
FROM public.messages;

-- 4. בדוק את הערוצים
SELECT 
    id,
    name,
    created_at,
    (SELECT COUNT(*) FROM public.channel_members WHERE channel_id = channels.id) as member_count,
    (SELECT COUNT(*) FROM public.messages WHERE channel_id = channels.id) as message_count
FROM public.channels
ORDER BY created_at DESC
LIMIT 10;

-- תוצאות מצופות:
-- 1. replica_identity צריך להיות 'FULL' עבור כל הטבלאות
-- 2. צריך להיות לפחות 3 policies על messages (SELECT, INSERT, UPDATE)
-- 3. צריך להיות הודעות בטבלה
-- 4. צריך להיות ערוצים עם חברים

