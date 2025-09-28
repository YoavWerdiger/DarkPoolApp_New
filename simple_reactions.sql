-- יצירת טבלת ריאקציות פשוטה
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- הפעלת RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- פוליסה פשוטה - כל משתמש מאומת יכול לעשות הכל
CREATE POLICY "Allow all for authenticated users" ON message_reactions
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- פונקציה פשוטה לקבלת ריאקציות
CREATE OR REPLACE FUNCTION get_message_reactions(message_id_param UUID)
RETURNS TABLE (
  emoji VARCHAR(10),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mr.emoji,
    COUNT(*)::BIGINT
  FROM message_reactions mr
  WHERE mr.message_id = message_id_param
  GROUP BY mr.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה פשוטה להוספה/הסרה של ריאקציה
CREATE OR REPLACE FUNCTION toggle_reaction(
  message_id_param UUID,
  emoji_param VARCHAR(10)
)
RETURNS BOOLEAN AS $$
DECLARE
  existing_reaction_id UUID;
BEGIN
  -- בדוק אם יש כבר ריאקציה כזו מהמשתמש
  SELECT id INTO existing_reaction_id
  FROM message_reactions
  WHERE message_id = message_id_param
  AND user_id = auth.uid()
  AND emoji = emoji_param;
  
  IF existing_reaction_id IS NOT NULL THEN
    -- אם יש כבר - מחק
    DELETE FROM message_reactions WHERE id = existing_reaction_id;
    RETURN FALSE;
  ELSE
    -- אם אין - הוסף
    INSERT INTO message_reactions (message_id, user_id, emoji)
    VALUES (message_id_param, auth.uid(), emoji_param);
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
