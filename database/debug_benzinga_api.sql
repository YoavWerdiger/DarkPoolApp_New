-- ============================================
-- בדיקת מה קורה עם Benzinga API
-- ============================================

-- 1. בדוק אם יש נתונים בכלל
SELECT 
  'Total Events' as check_type,
  COUNT(*) as count
FROM economic_events;

-- 2. בדוק לפי מקור
SELECT 
  source,
  COUNT(*) as count
FROM economic_events
GROUP BY source;

-- 3. בדוק Benzinga ספציפית
SELECT 
  'Benzinga Events' as check_type,
  COUNT(*) as count
FROM economic_events
WHERE source = 'Benzinga';

-- 4. בדוק את הטבלה - מה המבנה?
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'economic_events'
ORDER BY ordinal_position;

-- 5. הודעה
DO $$
DECLARE
  total_count INTEGER;
  benzinga_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM economic_events;
  SELECT COUNT(*) INTO benzinga_count FROM economic_events WHERE source = 'Benzinga';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 מצב הטבלה:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'סה"כ אירועים: %', total_count;
  RAISE NOTICE 'אירועי Benzinga: %', benzinga_count;
  RAISE NOTICE '';
  
  IF benzinga_count = 0 THEN
    RAISE NOTICE '❌ אין נתוני Benzinga!';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 בדוק:';
    RAISE NOTICE '   1. לוגים: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
    RAISE NOTICE '   2. סנן ל: benzinga-economics-sync';
    RAISE NOTICE '   3. חפש שגיאות או הודעות על XML';
    RAISE NOTICE '';
    RAISE NOTICE '💡 אפשרויות:';
    RAISE NOTICE '   - ה-API מחזיר XML במקום JSON';
    RAISE NOTICE '   - ה-API Key לא תקף';
    RAISE NOTICE '   - ה-endpoint לא נכון';
    RAISE NOTICE '   - הטבלה לא קיימת או מבנה שונה';
  ELSE
    RAISE NOTICE '✅ יש נתוני Benzinga!';
  END IF;
  
  RAISE NOTICE '';
END $$;









