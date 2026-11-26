-- Create starred_messages table
CREATE TABLE IF NOT EXISTS starred_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  starred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_starred_messages_user_id ON starred_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_starred_messages_message_id ON starred_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_starred_messages_channel_id ON starred_messages(channel_id);

-- Create unique constraint to prevent duplicate stars
CREATE UNIQUE INDEX IF NOT EXISTS idx_starred_messages_unique ON starred_messages(user_id, message_id);

-- Enable RLS
ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own starred messages" ON starred_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can star their own messages" ON starred_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    channel_id IN (
      SELECT channel_id FROM channel_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unstar their own messages" ON starred_messages
  FOR DELETE USING (user_id = auth.uid());

-- Create function to get starred messages for a user
CREATE OR REPLACE FUNCTION get_starred_messages(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  message_id UUID,
  content TEXT,
  type TEXT,
  sender_id UUID,
  sender_name TEXT,
  sender_avatar TEXT,
  channel_id UUID,
  channel_name TEXT,
  starred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.message_id,
    m.content,
    m.type,
    m.sender_id,
    COALESCE(u.full_name, 'משתמש') as sender_name,
    u.profile_picture as sender_avatar,
    sm.channel_id,
    c.name as channel_name,
    sm.starred_at,
    m.created_at
  FROM starred_messages sm
  JOIN messages m ON sm.message_id = m.id
  JOIN channels c ON sm.channel_id = c.id
  LEFT JOIN users u ON m.sender_id = u.id
  WHERE sm.user_id = user_uuid
  ORDER BY sm.starred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if a message is starred by a user
CREATE OR REPLACE FUNCTION is_message_starred(message_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM starred_messages 
    WHERE message_id = message_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_starred_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_message_starred(UUID, UUID) TO authenticated;
