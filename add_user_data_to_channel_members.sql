-- הוספת עמודה user_data לטבלת channel_members
-- ================================================

-- 1. הוספת עמודה חדשה
ALTER TABLE channel_members 
ADD COLUMN user_data JSONB DEFAULT '{}';

-- 2. יצירת אינדקס על העמודה החדשה
CREATE INDEX idx_channel_members_user_data 
ON channel_members USING GIN (user_data);

-- 3. עדכון הנתונים הקיימים
-- שלוף את כל חברי הערוצים עם פרטי המשתמשים
UPDATE channel_members 
SET user_data = (
  SELECT jsonb_build_object(
    'full_name', u.full_name,
    'profile_picture', u.profile_picture,
    'phone', u.phone,
    'display_name', u.display_name,
    'email', u.email
  )
  FROM users u 
  WHERE u.id = channel_members.user_id
);

-- 4. יצירת פונקציה לעדכון אוטומטי
CREATE OR REPLACE FUNCTION update_channel_member_user_data()
RETURNS TRIGGER AS $$
BEGIN
  -- עדכן את user_data כשמשתמש משתנה
  IF TG_OP = 'UPDATE' THEN
    UPDATE channel_members 
    SET user_data = jsonb_build_object(
      'full_name', NEW.full_name,
      'profile_picture', NEW.profile_picture,
      'phone', NEW.phone,
      'display_name', NEW.display_name,
      'email', NEW.email
    )
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. יצירת טריגר לעדכון אוטומטי
CREATE TRIGGER trigger_update_channel_member_user_data
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_channel_member_user_data();

-- 6. יצירת פונקציה להוספת חבר חדש עם נתונים
CREATE OR REPLACE FUNCTION add_channel_member_with_user_data(
  p_channel_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS VOID AS $$
DECLARE
  v_user_data JSONB;
BEGIN
  -- שלוף את נתוני המשתמש
  SELECT jsonb_build_object(
    'full_name', full_name,
    'profile_picture', profile_picture,
    'phone', phone,
    'display_name', display_name,
    'email', email
  ) INTO v_user_data
  FROM users 
  WHERE id = p_user_id;
  
  -- הוסף את החבר לערוץ
  INSERT INTO channel_members (channel_id, user_id, role, user_data)
  VALUES (p_channel_id, p_user_id, p_role, v_user_data)
  ON CONFLICT (channel_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    user_data = EXCLUDED.user_data;
END;
$$ LANGUAGE plpgsql;

-- 7. בדיקה שהכל עובד
SELECT 
  cm.channel_id,
  cm.user_id,
  cm.role,
  cm.user_data->>'full_name' as full_name,
  cm.user_data->>'profile_picture' as profile_picture
FROM channel_members cm
LIMIT 5;

-- 8. בדיקת הטריגר
-- נסה לעדכן משתמש ובדוק שהנתונים מתעדכנים אוטומטית
-- UPDATE users SET full_name = 'שם חדש' WHERE id = 'some-user-id';
