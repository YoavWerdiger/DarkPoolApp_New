-- ============================================
-- בדיקת תאריכים של אירועים כלכליים
-- ============================================

-- 1. בדיקת טווח תאריכים
SELECT 
  'Date Range' as check_type,
  MIN(date)::text as earliest,
  MAX(date)::text as latest,
  COUNT(*) as total
FROM economic_events
WHERE source = 'Benzinga';

-- 2. בדיקת תאריכים לפי חודש
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as count
FROM economic_events
WHERE source = 'Benzinga'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month;

-- 3. בדיקת תאריכים עתידיים לעומת עבר
SELECT 
  CASE 
    WHEN date < CURRENT_DATE THEN 'Past'
    WHEN date = CURRENT_DATE THEN 'Today'
    WHEN date > CURRENT_DATE AND date <= CURRENT_DATE + INTERVAL '3 months' THEN 'Next 3 Months'
    ELSE 'Far Future'
  END as time_period,
  COUNT(*) as count
FROM economic_events
WHERE source = 'Benzinga'
GROUP BY 
  CASE 
    WHEN date < CURRENT_DATE THEN 'Past'
    WHEN date = CURRENT_DATE THEN 'Today'
    WHEN date > CURRENT_DATE AND date <= CURRENT_DATE + INTERVAL '3 months' THEN 'Next 3 Months'
    ELSE 'Far Future'
  END
ORDER BY 
  CASE 
    WHEN time_period = 'Past' THEN 1
    WHEN time_period = 'Today' THEN 2
    WHEN time_period = 'Next 3 Months' THEN 3
    ELSE 4
  END;

-- 4. דוגמאות אירועים
SELECT 
  title,
  date,
  time,
  importance,
  country
FROM economic_events
WHERE source = 'Benzinga'
ORDER BY date DESC
LIMIT 10;

-- 5. בדיקת תאריך היום
SELECT 
  CURRENT_DATE as today,
  CURRENT_DATE + INTERVAL '3 months' as three_months_from_now;

-- 6. הודעה
DO $$
DECLARE
  earliest_date DATE;
  latest_date DATE;
  total_count INTEGER;
  past_count INTEGER;
  future_count INTEGER;
BEGIN
  SELECT MIN(date), MAX(date), COUNT(*) 
  INTO earliest_date, latest_date, total_count
  FROM economic_events
  WHERE source = 'Benzinga';
  
  SELECT COUNT(*) INTO past_count
  FROM economic_events
  WHERE source = 'Benzinga' AND date < CURRENT_DATE;
  
  SELECT COUNT(*) INTO future_count
  FROM economic_events
  WHERE source = 'Benzinga' AND date >= CURRENT_DATE;
  
  RAISE NOTICE '';
  RAISE NOTICE '📅 ניתוח תאריכים:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'סה"כ אירועים: %', total_count;
  RAISE NOTICE 'תאריך מוקדם ביותר: %', earliest_date;
  RAISE NOTICE 'תאריך מאוחר ביותר: %', latest_date;
  RAISE NOTICE 'אירועים בעבר: %', past_count;
  RAISE NOTICE 'אירועים בעתיד: %', future_count;
  RAISE NOTICE '';
  
  IF earliest_date > CURRENT_DATE + INTERVAL '1 year' THEN
    RAISE NOTICE '⚠️  תאריכים נראים לא נכונים - הם בעתיד הרחוק!';
    RAISE NOTICE '   ייתכן שיש בעיה עם המרת תאריכים מ-Benzinga';
  ELSIF earliest_date < CURRENT_DATE - INTERVAL '1 month' THEN
    RAISE NOTICE '✅ יש אירועים בעבר - נראה טוב!';
  END IF;
  
  IF future_count > 0 THEN
    RAISE NOTICE '✅ יש אירועים עתידיים - זה תקין!';
  END IF;
  
  RAISE NOTICE '';
END $$;
