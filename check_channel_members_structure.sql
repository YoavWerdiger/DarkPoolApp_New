-- בדיקת המבנה של טבלת channel_members
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'channel_members'
ORDER BY ordinal_position;

-- בדיקה מה יש בטבלה
SELECT * FROM channel_members LIMIT 3;
