-- ============================================================
-- verify_realtime_production.sql
-- הרץ ב-Supabase SQL Editor לפני/אחרי deploy לפרודקשן
-- ============================================================

-- 1) Publication קיים
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication
WHERE pubname = 'supabase_realtime';

-- 2) כל הטבלאות שהאפליקציה מצפה להן (קיימות + בפרסום)
WITH expected AS (
  SELECT unnest(ARRAY[
    'chat_groups',
    'chat_group_members',
    'chat_messages',
    'chat_message_reactions',
    'chat_message_reads',
    'chat_typing_indicators',
    'broker_account_state',
    'broker_positions',
    'broker_open_orders',
    'broker_executions',
    'broker_connections',
    'dark_pool_trades',
    'dark_pool_signals',
    'app_news_clean',
    'economic_events',
    'earnings_calendar'
  ]) AS tablename
),
exists_tbl AS (
  SELECT table_name AS tablename
  FROM information_schema.tables
  WHERE table_schema = 'public'
),
in_pub AS (
  SELECT tablename
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
)
SELECT
  e.tablename,
  CASE WHEN x.tablename IS NOT NULL THEN 'yes' ELSE 'NO TABLE' END AS table_exists,
  CASE WHEN p.tablename IS NOT NULL THEN 'yes' ELSE 'NOT IN PUB' END AS in_realtime,
  CASE
    WHEN x.tablename IS NULL THEN 'skip'
    WHEN p.tablename IS NULL THEN 'FIX: run 047/051'
    ELSE 'ok'
  END AS verdict
FROM expected e
LEFT JOIN exists_tbl x ON x.tablename = e.tablename
LEFT JOIN in_pub p ON p.tablename = e.tablename
ORDER BY verdict DESC, e.tablename;

-- 3) מדיניות realtime.messages ל-authenticated
SELECT policyname, roles::text, cmd, qual::text
FROM pg_policies
WHERE schemaname = 'realtime' AND tablename = 'messages';

-- 4) REPLICA IDENTITY לחברות קבוצה (DELETE)
SELECT
  c.relname,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'f' THEN 'FULL'
    WHEN 'i' THEN 'INDEX'
  END AS replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('chat_group_members', 'chat_messages');

-- 5) טריגר unread על הודעות חדשות
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'after_chat_message_insert_unread';
