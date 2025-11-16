-- Drop and recreate pinned_messages table and function
-- This script ensures everything is set up correctly

-- Drop function first (if exists)
DROP FUNCTION IF EXISTS get_pinned_messages(UUID);

-- Drop table (if exists) - this will cascade delete indexes and policies
DROP TABLE IF EXISTS pinned_messages CASCADE;

-- Create pinned_messages table
CREATE TABLE pinned_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, message_id)
);

-- Create indexes for better performance
CREATE INDEX idx_pinned_messages_channel_id ON pinned_messages(channel_id);
CREATE INDEX idx_pinned_messages_message_id ON pinned_messages(message_id);
CREATE INDEX idx_pinned_messages_pinned_by ON pinned_messages(pinned_by);

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
  message_content TEXT,
  message_type TEXT,
  message_created_at TIMESTAMP WITH TIME ZONE,
  pinned_by UUID,
  pinned_by_name TEXT,
  pinned_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.message_id,
    m.content as message_content,
    COALESCE(m.type, 'text') as message_type,
    m.created_at as message_created_at,
    pm.pinned_by,
    COALESCE(u_pinner.full_name, u_pinner.display_name, 'משתמש') as pinned_by_name,
    pm.pinned_at
  FROM pinned_messages pm
  INNER JOIN messages m ON pm.message_id = m.id
  LEFT JOIN users u_pinner ON pm.pinned_by = u_pinner.id
  WHERE pm.channel_id = channel_uuid
    -- Check that the user is a member of the channel
    AND EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_uuid
      AND cm.user_id = auth.uid()
    )
  ORDER BY pm.pinned_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pinned_messages(UUID) TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, DELETE ON pinned_messages TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_pinned_messages(UUID) IS 'Returns all pinned messages for a channel with sender and pinner information';

