-- יצירת טבלת ריאקציות להודעות
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL, -- אימוג'י (למשל: 👍, ❤️, 😂, 😮, 😢, 😡)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- משתמש יכול להגיב רק פעם אחת עם אותו אימוג'י להודעה
  UNIQUE(message_id, user_id, emoji)
);

-- יצירת אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions(emoji);

-- הפעלת RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- פוליסות RLS
-- משתמשים יכולים לראות ריאקציות של הודעות שהם יכולים לראות
CREATE POLICY "Users can view reactions to messages they can see"
ON message_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_members cm ON m.channel_id = cm.channel_id
    WHERE m.id = message_reactions.message_id
    AND cm.user_id = auth.uid()
  )
);

-- משתמשים יכולים להוסיף ריאקציות להודעות בקבוצות שהם חברים בהן
CREATE POLICY "Users can add reactions to messages in their channels"
ON message_reactions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_members cm ON m.channel_id = cm.channel_id
    WHERE m.id = message_reactions.message_id
    AND cm.user_id = auth.uid()
    AND message_reactions.user_id = auth.uid()
  )
);

-- משתמשים יכולים לעדכן ריאקציות שלהם
CREATE POLICY "Users can update their own reactions"
ON message_reactions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- משתמשים יכולים למחוק ריאקציות שלהם
CREATE POLICY "Users can delete their own reactions"
ON message_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- פונקציה לקבלת ריאקציות להודעה עם פרטי המשתמשים
CREATE OR REPLACE FUNCTION get_message_reactions(message_id_param UUID)
RETURNS TABLE (
  emoji VARCHAR(10),
  count BIGINT,
  user_ids UUID[],
  user_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mr.emoji,
    COUNT(*)::BIGINT,
    ARRAY_AGG(mr.user_id) as user_ids,
    ARRAY_AGG(u.full_name) as user_names
  FROM message_reactions mr
  JOIN auth.users u ON mr.user_id = u.id
  WHERE mr.message_id = message_id_param
  GROUP BY mr.emoji
  ORDER BY count DESC, emoji;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה להוספת/עדכון ריאקציה
CREATE OR REPLACE FUNCTION toggle_message_reaction(
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
    -- אם יש כבר - מחק (toggle off)
    DELETE FROM message_reactions WHERE id = existing_reaction_id;
    RETURN FALSE; -- ריאקציה הוסרה
  ELSE
    -- אם אין - הוסף (toggle on)
    INSERT INTO message_reactions (message_id, user_id, emoji)
    VALUES (message_id_param, auth.uid(), emoji_param);
    RETURN TRUE; -- ריאקציה נוספה
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
