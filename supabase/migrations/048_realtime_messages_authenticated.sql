-- Allow authenticated clients to join Realtime channels (postgres_changes, etc.)
-- When realtime.messages has RLS enabled but no policies, authenticated joins fail
-- with CHANNEL_ERROR. This policy is required if "Allow public access" is off.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'authenticated can join realtime channels'
  ) THEN
    CREATE POLICY "authenticated can join realtime channels"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
