-- Create pinned_messages table
CREATE TABLE IF NOT EXISTS pinned_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pinned_messages_channel_id ON pinned_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_message_id ON pinned_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_pinned_by ON pinned_messages(pinned_by);

-- Create unique constraint to prevent duplicate pins
CREATE UNIQUE INDEX IF NOT EXISTS idx_pinned_messages_unique ON pinned_messages(channel_id, message_id);

-- Enable RLS
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view pinned messages in channels they are members of" ON pinned_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can pin messages" ON pinned_messages
  FOR INSERT WITH CHECK (
    pinned_by = auth.uid() AND
    channel_id IN (
      SELECT channel_id FROM channel_members 
      WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
    )
  );

CREATE POLICY "Admins and owners can unpin messages" ON pinned_messages
  FOR DELETE USING (
    pinned_by = auth.uid() AND
    channel_id IN (
      SELECT channel_id FROM channel_members 
      WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
    )
  );

-- Create function to get pinned messages for a channel
CREATE OR REPLACE FUNCTION get_pinned_messages(channel_uuid UUID)
RETURNS TABLE (
  id UUID,
  message_id UUID,
  content TEXT,
  type TEXT,
  sender_id UUID,
  sender_name TEXT,
  sender_avatar TEXT,
  pinned_by UUID,
  pinned_by_name TEXT,
  pinned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.message_id,
    m.content,
    m.type,
    m.sender_id,
    COALESCE(m.sender->>'full_name', 'משתמש') as sender_name,
    m.sender->>'avatar_url' as sender_avatar,
    pm.pinned_by,
    COALESCE(pb.sender->>'full_name', 'משתמש') as pinned_by_name,
    pm.pinned_at,
    m.created_at
  FROM pinned_messages pm
  JOIN messages m ON pm.message_id = m.id
  LEFT JOIN messages pb ON pm.pinned_by = pb.sender_id
  WHERE pm.channel_id = channel_uuid
  ORDER BY pm.pinned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pinned_messages(UUID) TO authenticated;
