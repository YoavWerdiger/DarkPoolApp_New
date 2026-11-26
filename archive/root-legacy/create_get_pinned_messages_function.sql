-- Create or replace function to get pinned messages for a channel
-- This function returns pinned messages with full message details and user information

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

-- Add comment
COMMENT ON FUNCTION get_pinned_messages(UUID) IS 'Returns all pinned messages for a channel with sender and pinner information';

