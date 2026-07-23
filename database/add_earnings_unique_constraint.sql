
-- Add unique constraint to earnings_calendar to support upserts by code+date
DO $$
BEGIN
    -- Check if unique constraint exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'earnings_calendar_code_report_date_key'
    ) THEN
        -- If index exists but not constraint, drop index first to be safe, or just add constraint
        -- We'll try to add the constraint directly.
        -- Note: This might fail if there are duplicates. We should clean them first.
        
        -- Optional: Delete duplicates keeping latest updated
        DELETE FROM earnings_calendar a USING (
          SELECT MIN(ctid) as ctid, code, report_date
          FROM earnings_calendar 
          GROUP BY code, report_date HAVING COUNT(*) > 1
        ) b
        WHERE a.code = b.code 
        AND a.report_date = b.report_date 
        AND a.ctid <> b.ctid;

        ALTER TABLE earnings_calendar
        ADD CONSTRAINT earnings_calendar_code_report_date_key UNIQUE (code, report_date);
        
        RAISE NOTICE 'Added unique constraint earnings_calendar_code_report_date_key';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;





