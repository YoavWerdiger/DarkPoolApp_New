-- תיקון מערכת הריאקשנים - backend
-- תיקון foreign key relationship ויצירת פונקציות

-- וידוא שהטבלה קיימת
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- יצירת אינדקסים
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions(emoji);

-- הפעלת RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- מחיקת פוליסות קיימות
DROP POLICY IF EXISTS "Users can view reactions to messages they can see" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to messages in their channels" ON message_reactions;
DROP POLICY IF EXISTS "Users can update their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON message_reactions;

-- פוליסות RLS חדשות
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

CREATE POLICY "Users can delete their own reactions"
ON message_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- מחיקת פונקציות קיימות
DROP FUNCTION IF EXISTS get_message_reactions(UUID);
DROP FUNCTION IF EXISTS toggle_reaction(UUID, TEXT);
DROP FUNCTION IF EXISTS toggle_reaction(UUID, VARCHAR);
DROP FUNCTION IF EXISTS get_reaction_details(UUID);
DROP FUNCTION IF EXISTS toggle_message_reaction(UUID, VARCHAR);

-- פונקציה לקבלת ריאקציות (ספירה בלבד)
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

-- פונקציה להוספה/הסרה של ריאקציה (toggle)
CREATE OR REPLACE FUNCTION toggle_reaction(
  message_id_param UUID,
  emoji_param TEXT
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

-- פונקציה לקבלת פירוט מלא של ריאקציות (עם פרטי משתמשים)
-- שימוש ב-public.users במקום auth.users
CREATE OR REPLACE FUNCTION get_reaction_details(message_id_param UUID)
RETURNS TABLE (
  emoji TEXT,
  count BIGINT,
  user_ids UUID[],
  user_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mr.emoji::TEXT,
    COUNT(*)::BIGINT,
    ARRAY_AGG(mr.user_id)::UUID[],
    ARRAY_AGG(COALESCE(u.full_name, 'משתמש לא ידוע'))::TEXT[]
  FROM message_reactions mr
  LEFT JOIN public.users u ON mr.user_id = u.id
  WHERE mr.message_id = message_id_param
  GROUP BY mr.emoji
  ORDER BY count DESC, mr.emoji;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


