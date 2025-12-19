-- ============================================
-- בדיקה מהירה - כמה נתונים יש?
-- ============================================

-- Earnings
SELECT COUNT(*) as earnings_count FROM earnings_calendar;

-- Economic Events (Benzinga)
SELECT COUNT(*) as benzinga_events_count 
FROM economic_events 
WHERE source = 'Benzinga';

-- Economic Events (כל המקורות)
SELECT source, COUNT(*) as count 
FROM economic_events 
GROUP BY source;

-- דוגמאות אחרונות
SELECT title, date, time, importance, source
FROM economic_events
ORDER BY date DESC
LIMIT 5;








