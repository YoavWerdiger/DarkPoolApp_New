-- מחיקת כל אירועי ה-placeholder מהמסד נתונים

DELETE FROM economic_events 
WHERE id LIKE 'placeholder_%' OR source = 'System';

-- בדיקה שנמחק
SELECT COUNT(*) as deleted_count 
FROM economic_events 
WHERE id LIKE 'placeholder_%' OR source = 'System';




