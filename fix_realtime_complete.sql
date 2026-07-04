-- 1. Add metadata column to messages table if it doesn't exist
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Create user_read_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_read_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS for user_read_events
ALTER TABLE public.user_read_events ENABLE ROW LEVEL SECURITY;

-- Create policies for user_read_events
DROP POLICY IF EXISTS "Users can view their own read events" ON public.user_read_events;
CREATE POLICY "Users can view their own read events" ON public.user_read_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own read events" ON public.user_read_events;
CREATE POLICY "Users can insert/update their own read events" ON public.user_read_events
  FOR ALL USING (auth.uid() = user_id);

-- 3. Enable Realtime for messages and other tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- 4. Add tables to supabase_realtime publication
-- Note: This might fail if the publication doesn't exist or if the table is already added.
-- We'll try to add it safely.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 5. Update RLS policies for messages to ensure Realtime works correctly
-- Allow users to view messages in channels they are members of
DROP POLICY IF EXISTS "View messages in own channels" ON public.messages;
CREATE POLICY "View messages in own channels" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.messages.channel_id 
      AND cm.user_id = auth.uid()
    )
  );

-- Allow users to update their own messages
DROP POLICY IF EXISTS "Update own messages" ON public.messages;
CREATE POLICY "Update own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- Allow users to delete their own messages
DROP POLICY IF EXISTS "Delete own messages" ON public.messages;
CREATE POLICY "Delete own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_read_events_channel_user ON public.user_read_events(channel_id, user_id);

-- 7. Grant permissions
GRANT ALL ON public.user_read_events TO authenticated;
GRANT ALL ON public.user_read_events TO service_role;
