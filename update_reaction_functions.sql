-- עדכון פונקציות ריאקציות עם לוגיקה חדשה
-- מחיקה ויצירה מחדש של הפונקציות

-- מחיקת הפונקציות הקיימות
DROP FUNCTION IF EXISTS get_message_reactions(UUID);
DROP FUNCTION IF EXISTS toggle_reaction(UUID, TEXT);
DROP FUNCTION IF EXISTS get_reaction_details(UUID);

-- יצירת פונקציה לקבלת ריאקציות להודעה (מפושטת)
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

-- יצירת פונקציה להוספה/החלפה של ריאקציה (לוגיקה חדשה)
CREATE OR REPLACE FUNCTION toggle_reaction(
  message_id_param UUID,
  emoji_param TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- מחק ריאקציה קיימת מהמשתמש (אם יש)
  DELETE FROM message_reactions 
  WHERE message_id = message_id_param
  AND user_id = auth.uid();
  
  -- הוסף את הריאקציה החדשה
  INSERT INTO message_reactions (message_id, user_id, emoji)
  VALUES (message_id_param, auth.uid(), emoji_param);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- יצירת פונקציה חדשה לקבלת פירוט מלא של ריאקציות
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
    ARRAY_AGG(u.full_name)::TEXT[]
  FROM message_reactions mr
  JOIN auth.users u ON mr.user_id = u.id
  WHERE mr.message_id = message_id_param
  GROUP BY mr.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
