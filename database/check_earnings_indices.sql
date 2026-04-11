
-- Check indices on earnings_calendar
SELECT 
    i.relname as index_name,
    a.attname as column_name,
    ix.indisunique as is_unique
FROM 
    pg_class t, 
    pg_class i, 
    pg_index ix, 
    pg_attribute a 
WHERE 
    t.oid = ix.indrelid 
    AND i.oid = ix.indexrelid 
    AND a.attrelid = t.oid 
    AND a.attnum = ANY(ix.indkey) 
    AND t.relkind = 'r' 
    AND t.relname = 'earnings_calendar'
ORDER BY 
    t.relname, 
    i.relname;

-- We want a unique constraint on (code, report_date) to allow upserts without ID
-- If it doesn't exist, we should add it.





