-- יצירת טבלה לניהול אירועים כלכליים שנקראו על ידי משתמשים
-- Economic Events Read Status Management Table

-- טבלת user_read_events לניהול אירועים שנקראו
CREATE TABLE IF NOT EXISTS user_read_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- אינדקס ייחודי למניעת כפילויות
  UNIQUE(user_id, event_id)
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_user_read_events_user_id ON user_read_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_read_events_event_id ON user_read_events(event_id);
CREATE INDEX IF NOT EXISTS idx_user_read_events_read_at ON user_read_events(read_at);

-- RLS (Row Level Security) policies
ALTER TABLE user_read_events ENABLE ROW LEVEL SECURITY;

-- משתמשים יכולים לראות ולעדכן רק את הרשומות שלהם
CREATE POLICY "Users can view their own read events" ON user_read_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read events" ON user_read_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read events" ON user_read_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own read events" ON user_read_events
  FOR DELETE USING (auth.uid() = user_id);

-- פונקציה לקבלת מספר האירועים שלא נקראו עבור משתמש
CREATE OR REPLACE FUNCTION get_unread_events_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  -- כאן אפשר להוסיף לוגיקה מורכבת יותר
  -- לעת עתה פשוט נחזיר 0
  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- הוספת הערות לתיעוד
COMMENT ON TABLE user_read_events IS 'טבלה לניהול אירועים כלכליים שנקראו על ידי משתמשים';
COMMENT ON COLUMN user_read_events.user_id IS 'מזהה המשתמש';
COMMENT ON COLUMN user_read_events.event_id IS 'מזהה האירוע הכלכלי';
COMMENT ON COLUMN user_read_events.read_at IS 'תאריך ושעת קריאת האירוע';
COMMENT ON COLUMN user_read_events.created_at IS 'תאריך יצירת הרשומה';

-- בדיקת יצירת הטבלה
SELECT 'user_read_events table created successfully' AS status;
