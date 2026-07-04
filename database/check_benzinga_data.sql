-- ============================================
-- בדיקת נתוני Benzinga במסד הנתונים
-- ============================================

-- 1. ספירת Earnings
SELECT 
  'Earnings' as type,
  COUNT(*) as total_records,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar;

-- 2. ספירת Economic Events
SELECT 
  'Economic Events' as type,
  COUNT(*) as total_records,
  MIN(date)::text as earliest_date,
  MAX(date)::text as latest_date
FROM economic_events
WHERE source = 'Benzinga';

-- 3. דוגמאות Earnings
SELECT 
  'Earnings Sample' as type,
  code,
  report_date,
  before_after_market
FROM earnings_calendar
ORDER BY report_date DESC
LIMIT 5;

-- 4. דוגמאות Economic Events
SELECT 
  'Economics Sample' as type,
  title,
  date,
  time,
  importance
FROM economic_events
WHERE source = 'Benzinga'
ORDER BY date DESC
LIMIT 5;

-- 5. Metadata
SELECT * FROM economic_cache_metadata;

-- 6. הודעה
DO $$
DECLARE
  earnings_count INTEGER;
  economics_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO earnings_count FROM earnings_calendar;
  SELECT COUNT(*) INTO economics_count FROM economic_events WHERE source = 'Benzinga';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 סיכום נתונים:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📈 Earnings: % רשומות', earnings_count;
  RAISE NOTICE '📅 Economic Events: % רשומות', economics_count;
  RAISE NOTICE '';
  
  IF earnings_count > 0 AND economics_count > 0 THEN
    RAISE NOTICE '✅ הכל עובד! יש נתונים במסד!';
  ELSIF earnings_count > 0 THEN
    RAISE NOTICE '⚠️  Earnings עובד, אבל Economics ריק';
    RAISE NOTICE '   בדוק לוגים: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
  ELSIF economics_count > 0 THEN
    RAISE NOTICE '⚠️  Economics עובד, אבל Earnings ריק';
  ELSE
    RAISE NOTICE '❌ אין נתונים - בדוק לוגים!';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
  END IF;
  
  RAISE NOTICE '';
END $$;

