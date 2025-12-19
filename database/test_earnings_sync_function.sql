-- ============================================
-- בדיקת הפונקציה trigger_earnings_sync
-- ============================================
-- 
-- זה בודק אם הפונקציה קיימת ופועלת

-- 1. בדיקה אם הפונקציה קיימת
SELECT 
  'Function Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'trigger_earnings_sync'
    ) THEN '✅ Function exists'
    ELSE '❌ Function does not exist - Run trigger_earnings_sync.sql first!'
  END as status;

-- 2. אם הפונקציה קיימת, נפעיל אותה
DO $$
DECLARE
  func_exists BOOLEAN;
  result RECORD;
BEGIN
  -- בדיקה אם הפונקציה קיימת
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'trigger_earnings_sync'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ הפונקציה קיימת - מפעיל אותה...';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    
    -- הפעלת הפונקציה
    FOR result IN 
      SELECT * FROM trigger_earnings_sync()
    LOOP
      RAISE NOTICE '📊 תוצאות:';
      RAISE NOTICE '   ├─ Success: %', result.success;
      RAISE NOTICE '   ├─ Message: %', result.message;
      RAISE NOTICE '   ├─ HTTP Response ID: %', result.http_response_id;
      RAISE NOTICE '   ├─ Date From: %', result.date_from;
      RAISE NOTICE '   └─ Date To: %', result.date_to;
      RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '⏳ המתן 30 שניות ואז בדוק את הלוגים:';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '❌ הפונקציה לא קיימת!';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '💡 מה לעשות:';
    RAISE NOTICE '   1. הרץ את trigger_earnings_sync.sql קודם';
    RAISE NOTICE '   2. אחרי זה הרץ את run_earnings_sync_now.sql';
    RAISE NOTICE '';
  END IF;
END $$;

-- 3. המתן 30 שניות
SELECT pg_sleep(30);

-- 4. בדיקת מצב אחרי
SELECT 
  'After Function Call' as check_type,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN report_date < CURRENT_DATE THEN 1 END) as past_reports,
  COUNT(CASE WHEN report_date = CURRENT_DATE THEN 1 END) as today_reports,
  COUNT(CASE WHEN report_date > CURRENT_DATE THEN 1 END) as future_reports,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar;

-- 5. בדיקת לוגים אחרונים (אם יש גישה)
-- SELECT 
--   timestamp,
--   event_message
-- FROM supabase_logs.logs
-- WHERE function_id = (SELECT id FROM supabase_functions.functions WHERE slug = 'daily-earnings-sync-simple')
-- ORDER BY timestamp DESC
-- LIMIT 10;







