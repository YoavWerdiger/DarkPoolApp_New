-- 🔧 תיקוני בק אנד למערכת הצ'אטים
-- DarkPool App - Chat System Backend Fixes
-- תאריך: 2025-11-25

-- ========================================
-- 1. תיקון סכימת טבלת channels
-- ========================================

-- הוסף עמודות חסרות
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'group';

-- עדכן את ה-trigger ל-updated_at
DROP TRIGGER IF EXISTS update_channels_updated_at ON public.channels;
CREATE TRIGGER update_channels_updated_at 
  BEFORE UPDATE ON public.channels
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 2. תיקון סכימת טבלת messages
-- ========================================

-- הוסף עמודות חסרות
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS viewed_by JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- העתק נתונים מ-reply_to ל-reply_to_message_id אם צריך
UPDATE public.messages 
SET reply_to_message_id = reply_to 
WHERE reply_to IS NOT NULL AND reply_to_message_id IS NULL;

-- ========================================
-- 3. יצירת טבלת user_channel_state
-- ========================================

CREATE TABLE IF NOT EXISTS public.user_channel_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.user_channel_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own channel state" ON public.user_channel_state;
CREATE POLICY "Users can view their own channel state" ON public.user_channel_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own channel state" ON public.user_channel_state;
CREATE POLICY "Users can insert/update their own channel state" ON public.user_channel_state
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_channel_state_user_id ON public.user_channel_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_state_channel_id ON public.user_channel_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_state_last_read ON public.user_channel_state(last_read_message_id);

-- העתק נתונים מ-user_read_events ל-user_channel_state
INSERT INTO public.user_channel_state (user_id, channel_id, last_read_message_id, last_read_at)
SELECT user_id, channel_id, last_read_message_id, last_read_at
FROM public.user_read_events
ON CONFLICT (user_id, channel_id) DO NOTHING;

-- ========================================
-- 4. תיקון RLS Policies ל-channels
-- ========================================

-- UPDATE policy ל-channels
DROP POLICY IF EXISTS "Users can update channels they created" ON public.channels;
CREATE POLICY "Users can update channels they created" ON public.channels
  FOR UPDATE USING (created_by = auth.uid());

-- UPDATE policy גם למנהלים
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
CREATE POLICY "Admins can update channels" ON public.channels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = public.channels.id 
      AND user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ========================================
-- 5. תיקון RLS Policies ל-channel_members
-- ========================================

-- וודא שיש INSERT policy
DROP POLICY IF EXISTS "Join channels" ON public.channel_members;
CREATE POLICY "Join channels" ON public.channel_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own membership" ON public.channel_members;
CREATE POLICY "Users can update their own membership" ON public.channel_members
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- 6. הוספת Indexes לביצועים
-- ========================================

-- Index ל-messages.created_at (כבר קיים אבל נוודא)
CREATE INDEX IF NOT EXISTS idx_messages_created_at_desc 
ON public.messages(created_at DESC);

-- Index ל-channels.is_pinned
CREATE INDEX IF NOT EXISTS idx_channels_is_pinned 
ON public.channels(is_pinned) WHERE is_pinned = TRUE;

-- Index ל-channels.is_public
CREATE INDEX IF NOT EXISTS idx_channels_is_public 
ON public.channels(is_public) WHERE is_public = TRUE;

-- Index ל-messages.reply_to_message_id
CREATE INDEX IF NOT EXISTS idx_messages_reply_to 
ON public.messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- Index ל-messages.mentions (GIN index ל-JSONB)
CREATE INDEX IF NOT EXISTS idx_messages_mentions 
ON public.messages USING GIN (mentions) WHERE mentions IS NOT NULL;

-- ========================================
-- 7. וידוא Realtime מופעל
-- ========================================

-- Enable REPLICA IDENTITY
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.user_channel_state REPLICA IDENTITY FULL;

-- הוסף ל-publication (אם לא קיים)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'channels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'channel_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_channel_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_channel_state;
  END IF;
END $$;

-- ========================================
-- 8. וידוא RLS Policies ל-messages
-- ========================================

-- SELECT policy (כבר קיים אבל נוודא)
DROP POLICY IF EXISTS "View messages in own channels" ON public.messages;
CREATE POLICY "View messages in own channels" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.messages.channel_id 
      AND cm.user_id = auth.uid()
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "Update own messages" ON public.messages;
CREATE POLICY "Update own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- DELETE policy
DROP POLICY IF EXISTS "Delete own messages" ON public.messages;
CREATE POLICY "Delete own messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- ========================================
-- 9. וידוא RLS Policies ל-channels
-- ========================================

-- SELECT policy
DROP POLICY IF EXISTS "View channels for members" ON public.channels;
CREATE POLICY "View channels for members" ON public.channels
  FOR SELECT USING (
    is_public = TRUE OR
    EXISTS (
      SELECT 1 FROM public.channel_members cm 
      WHERE cm.channel_id = public.channels.id 
      AND cm.user_id = auth.uid()
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Create channels" ON public.channels;
CREATE POLICY "Create channels" ON public.channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ========================================
-- 10. וידוא RLS Policies ל-channel_members
-- ========================================

-- SELECT policy
DROP POLICY IF EXISTS "View own channel memberships" ON public.channel_members;
CREATE POLICY "View own channel memberships" ON public.channel_members
  FOR SELECT USING (user_id = auth.uid());

-- ========================================
-- סיכום
-- ========================================

-- כל התיקונים הושלמו!
-- עכשיו צריך:
-- 1. להריץ את הקובץ הזה ב-Supabase SQL Editor
-- 2. לוודא ש-Realtime מופעל ב-Dashboard
-- 3. לבדוק שהכל עובד


