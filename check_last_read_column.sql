-- בדיקה שהשדה last_read_message_id נוסף לטבלת channel_members
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'channel_members' 
  AND column_name = 'last_read_message_id';

-- בדיקה שהאינדקס נוצר
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'channel_members' 
  AND indexname LIKE '%last_read%';

-- בדיקה שיש נתונים בטבלה
SELECT 
  channel_id,
  user_id,
  last_read_message_id
FROM channel_members 
LIMIT 5;
