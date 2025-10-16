-- בדיקת נתונים בטבלה
SELECT COUNT(*) as total FROM earnings_calendar;

-- 10 רשומות לדוגמה
SELECT * FROM earnings_calendar 
ORDER BY report_date DESC 
LIMIT 10;