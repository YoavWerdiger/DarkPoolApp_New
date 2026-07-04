-- ============================================
-- Chat Realtime publication + replica identity
-- ============================================
-- Ensures all chat tables are in supabase_realtime so postgres_changes
-- subscriptions succeed. Safe to re-run (duplicate ADD TABLE is caught).
-- ============================================

DO $$
DECLARE
  tables text[] := ARRAY[
    'chat_groups',
    'chat_group_members',
    'chat_messages',
    'chat_message_reactions',
    'chat_message_reads',
    'chat_typing_indicators'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%already member of publication%' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
    END;
  END LOOP;
END $$;

-- DELETE events on chat_group_members need full old row for user_id/group_id filters
ALTER TABLE public.chat_group_members REPLICA IDENTITY FULL;
