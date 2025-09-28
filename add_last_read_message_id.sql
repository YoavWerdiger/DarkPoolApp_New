-- הוספת שדה last_read_message_id לטבלת channel_members
-- כדי לעקוב אחרי ההודעה האחרונה שהמשתמש קרא בכל צ'אט

-- הוספת השדה
ALTER TABLE channel_members 
ADD COLUMN last_read_message_id UUID REFERENCES messages(id);

-- יצירת אינדקס לביצועים טובים יותר
CREATE INDEX idx_channel_members_last_read 
ON channel_members(channel_id, last_read_message_id);

-- עדכון השדה עבור הודעות קיימות (אופציונלי)
-- UPDATE channel_members 
-- SET last_read_message_id = (
--   SELECT id FROM messages 
--   WHERE channel_id = channel_members.channel_id 
--   ORDER BY created_at DESC 
--   LIMIT 1
-- );

-- הערה: השדה יכול להיות NULL אם המשתמש לא קרא אף הודעה עדיין
