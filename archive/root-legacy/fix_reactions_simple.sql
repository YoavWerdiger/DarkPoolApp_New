-- תיקון פשוט למערכת הריאקשנים

-- יצירת הטבלה אם לא קיימת
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- הפעלת RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- פוליסה פשוטה - כל משתמש מאומת יכול לעשות הכל
DROP POLICY IF EXISTS "Allow all for authenticated users" ON message_reactions;
CREATE POLICY "Allow all for authenticated users" ON message_reactions
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- מחיקת הפונקציות הקיימות
DROP FUNCTION IF EXISTS get_message_reactions(UUID);
DROP FUNCTION IF EXISTS toggle_reaction(UUID, TEXT);
DROP FUNCTION IF EXISTS toggle_reaction(UUID, VARCHAR);

-- יצירת פונקציה פשוטה לקבלת ריאקשנים
CREATE OR REPLACE FUNCTION get_message_reactions(message_id_param UUID)
RETURNS TABLE (
  emoji TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mr.emoji::TEXT,
    COUNT(*)::BIGINT
  FROM message_reactions mr
  WHERE mr.message_id = message_id_param
  GROUP BY mr.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- יצירת פונקציה פשוטה להוספה/הסרה של ריאקשן
CREATE OR REPLACE FUNCTION toggle_reaction(
  message_id_param UUID,
  emoji_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  existing_reaction_id UUID;
BEGIN
  -- בדוק אם יש כבר ריאקשן כזה מהמשתמש
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
