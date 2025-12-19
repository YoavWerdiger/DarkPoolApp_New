-- ============================================
-- בדיקה שהטבלה קיימת
-- ============================================

-- בדיקה אם הטבלה קיימת
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'economic_events_cache'
ORDER BY ordinal_position;

-- בדיקה אם יש נתונים
SELECT COUNT(*) as total_records FROM economic_events_cache;

-- בדיקה אם הטבלה קיימת (דרך pg_tables)
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename = 'economic_events_cache';

-- אם הטבלה לא קיימת, הרץ את זה:
-- database/benzinga_economic_events_table.sql








