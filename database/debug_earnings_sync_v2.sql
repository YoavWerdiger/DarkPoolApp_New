-- ============================================
-- דיבוג מפורט - מה קורה עם השליפה?
-- ============================================

-- 1. בדיקה - האם הפונקציה רצה בכלל?
DO $$
DECLARE
  http_response_id BIGINT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקת קריאה ל-Edge Function';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  -- קריאה ל-Edge Function
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-v2',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO http_response_id;
  
  RAISE NOTICE '✅ Request sent. HTTP Response ID: %', http_response_id;
  RAISE NOTICE '';
  RAISE NOTICE '💡 עכשיו לך ל-Supabase Dashboard:';
  RAISE NOTICE '   Functions → daily-earnings-sync-v2 → Logs';
  RAISE NOTICE '';
  RAISE NOTICE '💡 חפש:';
  RAISE NOTICE '   - שגיאות (❌)';
  RAISE NOTICE '   - כמה רשומות התקבלו (📊 Fetched X records)';
  RAISE NOTICE '   - שגיאות upsert (❌ Error upserting)';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
END $$;

-- 2. בדיקת מבנה הטבלה - האם יש את כל השדות?
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'earnings_calendar'
  AND column_name IN ('ticker', 'code', 'report_date', 'eps_estimate', 'revenue_estimate', 'external_id')
ORDER BY column_name;

-- 3. בדיקת constraints - האם יש unique constraint?
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.earnings_calendar'::regclass
  AND contype = 'u'; -- unique constraints

-- 4. בדיקת כמה רשומות יש בכלל בטבלה
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT code) as unique_codes,
  COUNT(DISTINCT ticker) FILTER (WHERE ticker IS NOT NULL) as unique_tickers,
  MIN(report_date) as earliest_date,
  MAX(report_date) as latest_date
FROM earnings_calendar;





