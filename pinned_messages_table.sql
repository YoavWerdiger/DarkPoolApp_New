-- Create pinned_messages table
CREATE TABLE IF NOT EXISTS pinned_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, message_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pinned_messages_channel_id ON pinned_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_message_id ON pinned_messages(message_id);

-- Enable RLS
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view pinned messages in channels they are members of" ON pinned_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = pinned_messages.channel_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Channel admins and owners can pin messages" ON pinned_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = pinned_messages.channel_id 
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Channel admins and owners can unpin messages" ON pinned_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM channel_members 
      WHERE channel_id = pinned_messages.channel_id 
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Function to get pinned messages for a channel
CREATE OR REPLACE FUNCTION get_pinned_messages(channel_uuid UUID)
RETURNS TABLE (
  id UUID,
  message_id UUID,
  message_content TEXT,
  message_type TEXT,
  message_created_at TIMESTAMP WITH TIME ZONE,
  pinned_by UUID,
  pinned_by_name TEXT,
  pinned_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.message_id,
    m.content,
    m.type,
    m.created_at,
    pm.pinned_by,
    u.full_name,
    pm.pinned_at
  FROM pinned_messages pm
  JOIN messages m ON pm.message_id = m.id
  JOIN users u ON pm.pinned_by = u.id
  WHERE pm.channel_id = channel_uuid
  ORDER BY pm.pinned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON pinned_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_pinned_messages(UUID) TO authenticated;
