-- יצירת טבלת user_channel_state לניהול קריאת הודעות
-- טבלה זו תשמור לכל משתמש עד איזה הודעה הוא קרא בכל ערוץ

CREATE TABLE IF NOT EXISTS user_channel_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  last_read_message_id uuid REFERENCES messages(id),
  last_read_at timestamptz DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

-- יצירת אינדקסים לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_user_channel_state_user_id ON user_channel_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_state_channel_id ON user_channel_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_state_last_read ON user_channel_state(last_read_message_id);

-- הערה: הטבלה הזו תחליף את השדה last_read_message_id בטבלת channel_members
-- נוכל להסיר אותו אחרי שנעביר את הנתונים
