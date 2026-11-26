-- תיקון הפונקציה get_reaction_details עם שם העמודה הנכון
-- קודם נבדוק מה השמות הנכונים של העמודות

-- מחיקת הפונקציה הקיימת
DROP FUNCTION IF EXISTS get_reaction_details(UUID);

-- יצירת פונקציה חדשה עם בדיקה של שמות העמודות
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
    ARRAY_AGG(
      COALESCE(
        u.raw_user_meta_data->>'full_name',  -- נסה את זה קודם
        u.raw_user_meta_data->>'name',       -- או את זה
        u.email,                             -- או אימייל
        'משתמש לא ידוע'                     -- ברירת מחדל
      )
    )::TEXT[]
  FROM message_reactions mr
  JOIN auth.users u ON mr.user_id = u.id
  WHERE mr.message_id = message_id_param
  GROUP BY mr.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
