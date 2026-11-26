-- Add viewed_by column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS viewed_by JSONB DEFAULT '[]'::jsonb;

-- Create index for faster queries on viewed_by
CREATE INDEX IF NOT EXISTS idx_messages_viewed_by ON messages USING GIN (viewed_by);

-- Function to add user to viewed_by array
CREATE OR REPLACE FUNCTION add_user_to_viewed_by(message_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE messages 
  SET viewed_by = viewed_by || to_jsonb(user_uuid::text)
  WHERE id = message_uuid 
  AND NOT (viewed_by ? user_uuid::text);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get viewed_by users with their details
CREATE OR REPLACE FUNCTION get_message_viewers(message_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  profile_picture TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.profile_picture,
    m.created_at as viewed_at
  FROM messages m
  JOIN users u ON u.id::text = ANY(SELECT jsonb_array_elements_text(m.viewed_by))
  WHERE m.id = message_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_user_to_viewed_by(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_viewers(UUID) TO authenticated;
