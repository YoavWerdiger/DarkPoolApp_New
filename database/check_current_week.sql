-- ============================================
-- בדיקת השבוע הקרוב - למה אין דיווחים?
-- ============================================

-- 1. מה התאריך היום?
SELECT 
  'Today' as check_type,
  CURRENT_DATE as today,
  CURRENT_DATE + INTERVAL '7 days' as next_week,
  DATE_TRUNC('week', CURRENT_DATE)::date as current_week_start,
  (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days')::date as current_week_end;

-- 2. כמה דיווחים יש לשבוע הקרוב (7 ימים מהיום)?
SELECT 
  'Next 7 Days' as check_type,
  report_date,
  COUNT(*) as reports_count,
  STRING_AGG(code, ', ' ORDER BY code) as symbols
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
GROUP BY report_date
ORDER BY report_date;

-- 3. כמה דיווחים יש בכלל בטווח של היום עד חודש קדימה?
SELECT 
  'Next Month' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT report_date) as unique_dates,
  MIN(report_date)::text as earliest,
  MAX(report_date)::text as latest
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE
  AND report_date <= CURRENT_DATE + INTERVAL '1 month';

-- 4. מה התאריכים הקרובים ביותר שיש בהם דיווחים?
SELECT 
  'Closest Reports' as check_type,
  report_date,
  COUNT(*) as reports_count,
  STRING_AGG(code, ', ' ORDER BY code) as symbols
FROM earnings_calendar
WHERE report_date >= CURRENT_DATE
GROUP BY report_date
ORDER BY report_date
LIMIT 10;

-- 5. בדיקת דיווחים לשבוע הקרוב - פירוט
DO $$
DECLARE
  today_date DATE := CURRENT_DATE;
  week_end DATE := today_date + INTERVAL '7 days';
  week_count INTEGER;
  closest_date DATE;
  closest_count INTEGER;
BEGIN
  -- כמה דיווחים לשבוע הקרוב
  SELECT COUNT(*) INTO week_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN today_date AND week_end;
  
  -- מה התאריך הקרוב ביותר שיש בו דיווחים?
  SELECT report_date, COUNT(*) INTO closest_date, closest_count
  FROM earnings_calendar
  WHERE report_date >= today_date
  GROUP BY report_date
  ORDER BY report_date
  LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📅 בדיקת השבוע הקרוב';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📆 תאריך היום: %', today_date;
  RAISE NOTICE '📆 שבוע הקרוב (7 ימים): % → %', today_date, week_end;
  RAISE NOTICE '';
  RAISE NOTICE '📊 דיווחים לשבוע הקרוב: %', week_count;
  RAISE NOTICE '';
  
  IF week_count = 0 THEN
    RAISE NOTICE '⚠️  אין דיווחים לשבוע הקרוב!';
    RAISE NOTICE '';
    
    IF closest_date IS NOT NULL THEN
      RAISE NOTICE '📅 התאריך הקרוב ביותר עם דיווחים:';
      RAISE NOTICE '   └─ תאריך: %', closest_date;
      RAISE NOTICE '   └─ כמות: % דיווחים', closest_count;
      RAISE NOTICE '   └─ מרחק: % ימים מהיום', closest_date - today_date;
    ELSE
      RAISE NOTICE '❌ אין דיווחים עתידיים בכלל!';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '💡 אפשרויות:';
    RAISE NOTICE '   1. Benzinga API לא מחזיר דיווחים לשבוע הקרוב (עדיין לא פורסמו)';
    RAISE NOTICE '   2. יש בעיה עם התאריכים בשליפה';
    RAISE NOTICE '   3. צריך לבדוק את הלוגים של הפונקציה';
  ELSE
    RAISE NOTICE '✅ יש דיווחים לשבוע הקרוב!';
  END IF;
  
  RAISE NOTICE '';
END $$;







