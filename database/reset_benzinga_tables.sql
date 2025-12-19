-- ============================================
-- איפוס טבלאות לנתוני Benzinga
-- מוחק נתונים ישנים מ-EODHD ומכין לנתוני Benzinga
-- ============================================

-- הודעת אזהרה
DO $$
BEGIN
  RAISE NOTICE '⚠️  מתחיל איפוס טבלאות...';
  RAISE NOTICE '⚠️  פעולה זו תמחק את כל הנתונים הקיימים!';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 1. מחיקת נתוני Earnings ישנים
-- ============================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- מחיקת כל הנתונים מטבלת earnings_calendar
  DELETE FROM earnings_calendar;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE '🗑️  נמחקו % רשומות earnings', deleted_count;
END $$;

-- ============================================
-- 2. מחיקת נתוני Economic Events ישנים
-- ============================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- בדיקה אם הטבלה קיימת
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'economic_events_cache') THEN
    DELETE FROM economic_events_cache;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '🗑️  נמחקו % אירועים כלכליים', deleted_count;
  ELSE
    RAISE NOTICE '📝 טבלת economic_events_cache עדיין לא קיימת';
  END IF;
END $$;

-- ============================================
-- 3. מחיקת Metadata ישן
-- ============================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- בדיקה אם הטבלה קיימת
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'economic_cache_metadata') THEN
    DELETE FROM economic_cache_metadata;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '🗑️  נמחקו % metadata records', deleted_count;
  END IF;
  
  -- מחיקת economic_data_cache_meta אם קיים
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'economic_data_cache_meta') THEN
    DELETE FROM economic_data_cache_meta;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '🗑️  נמחקו % cache meta records', deleted_count;
  END IF;
END $$;

-- ============================================
-- 4. מחיקת נתוני Economic Events מטבלאות אחרות
-- ============================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- economic_events (אם קיים)
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'economic_events') THEN
    DELETE FROM economic_events;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '🗑️  נמחקו % economic events', deleted_count;
  END IF;
END $$;

-- ============================================
-- 5. איפוס Sequences (אם צריך)
-- ============================================

-- לא נוגע ב-sequences כי יש IDs מ-Benzinga

-- ============================================
-- 6. ווידוא שהטבלאות קיימות
-- ============================================

-- יצירת הטבלאות אם לא קיימות (מריץ את הסקריפט של benzinga_economic_events_table.sql)

-- ============================================
-- בדיקת סטטוס אחרי איפוס
-- ============================================

SELECT 
  'earnings_calendar' as table_name,
  COUNT(*) as records_count
FROM earnings_calendar

UNION ALL

SELECT 
  'economic_events_cache' as table_name,
  COUNT(*) as records_count
FROM economic_events_cache
WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'economic_events_cache')

UNION ALL

SELECT 
  'economic_cache_metadata' as table_name,
  COUNT(*) as records_count
FROM economic_cache_metadata
WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'economic_cache_metadata')

ORDER BY table_name;

-- ============================================
-- הודעת סיום
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ איפוס טבלאות הושלם בהצלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 שלבים הבאים:';
  RAISE NOTICE '   1. הרץ: benzinga_economic_events_table.sql (אם עדיין לא)';
  RAISE NOTICE '   2. הפעל Cron Job או הרץ Function ידנית';
  RAISE NOTICE '   3. בדוק שהנתונים החדשים מגיעים מ-Benzinga';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 הכל מוכן ל-Benzinga!';
END $$;








