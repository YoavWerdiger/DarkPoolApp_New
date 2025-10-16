-- מחיקה מלאה של כל הנתונים בטבלה economic_events

-- מחיקת כל השורות
DELETE FROM economic_events;

-- בדיקה שהטבלה ריקה
SELECT COUNT(*) as remaining_rows FROM economic_events;

-- בדיקת סכמה
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'economic_events'
ORDER BY ordinal_position;




