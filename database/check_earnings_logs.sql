-- ============================================
-- בדיקת לוגים של הפונקציה
-- ============================================
-- 
-- זה יראה לנו מה קרה בפונקציה

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 הוראות לבדיקת לוגים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '1. פתח Supabase Dashboard';
  RAISE NOTICE '2. לך ל: Edge Functions → daily-earnings-sync-simple → Logs';
  RAISE NOTICE '3. חפש את הריצה האחרונה';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 מה לחפש:';
  RAISE NOTICE '   ├─ "📅 Splitting date range into daily chunks..."';
  RAISE NOTICE '   ├─ "✅ Day ... completed:" - כמה ימים נשלפו';
  RAISE NOTICE '   ├─ "📈 Total earnings fetched: ..." - כמה דיווחים נשלפו';
  RAISE NOTICE '   ├─ "✅ Earnings sync completed: ..." - כמה נשמרו';
  RAISE NOTICE '   └─ שגיאות (❌) - אם יש';
  RAISE NOTICE '';
  RAISE NOTICE '💡 אם אין לוגים:';
  RAISE NOTICE '   └─ הפונקציה לא רצה - בדוק את הסקריפט SQL';
  RAISE NOTICE '';
  RAISE NOTICE '💡 אם יש "Total earnings fetched: 0":';
  RAISE NOTICE '   └─ Benzinga API לא החזיר דיווחים - בדוק את הפרמטרים';
  RAISE NOTICE '';
  RAISE NOTICE '💡 אם יש "Total earnings fetched: X" אבל "inserted: 0":';
  RAISE NOTICE '   └─ יש בעיה בשמירה - בדוק את prepareEarningsRecord';
  RAISE NOTICE '';
END $$;

-- בדיקה מהירה - כמה דיווחים יש בכלל במסד
SELECT 
  'Total in Database' as check_type,
  COUNT(*) as total_reports,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar;

-- בדיקה - כמה דיווחים יש בטווח השבוע הקרוב
SELECT 
  'Next Week Range' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days');







