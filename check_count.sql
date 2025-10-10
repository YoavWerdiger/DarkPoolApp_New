-- בדיקה פשוטה של כמות נתונים
SELECT COUNT(*) as total FROM economic_events;

-- בדיקת 5 הראשונים
SELECT id, title, date, importance FROM economic_events LIMIT 5;

