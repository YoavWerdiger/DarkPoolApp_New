-- ============================================
-- שליפה ראשונית של Earnings Calendar
-- ============================================
-- 
-- זה מריץ שליפה ראשונית של כל דיווחי הרווחים
-- עם טווח תאריכים גדול (3 חודשים אחורה + שנה קדימה)

-- ============================================
-- הסינונים הנוכחיים:
-- ============================================
-- ✅ רק מניות US (code שמסתיים ב-.US)
-- ✅ מדלג על מניות מועדפות (-P, -W)
-- ❌ אין סינון לפי importance - נקבל את כל רמות החשיבות (0-5)
-- ❌ אין סינון לפי exchange - נקבל את כל הבורסות

-- ============================================
-- הרצת שליפה ראשונית
-- ============================================

-- אפשרות 1: עם תאריכים ברירת מחדל (3 חודשים אחורה + 3 חודשים קדימה)
SELECT * FROM trigger_earnings_sync();

-- אפשרות 2: עם תאריכים מותאמים אישית (למשל שנה קדימה)
SELECT * FROM trigger_earnings_sync(
  (CURRENT_DATE - INTERVAL '3 months')::DATE,  -- 3 חודשים אחורה
  (CURRENT_DATE + INTERVAL '12 months')::DATE  -- שנה קדימה
);

-- ============================================
-- בדיקת התקדמות
-- ============================================

-- בדוק כמה דיווחים נשמרו:
SELECT COUNT(*) as total_earnings FROM earnings_calendar;

-- בדוק התפלגות לפי תאריך:
SELECT 
  report_date,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY report_date
ORDER BY report_date
LIMIT 20;

-- בדוק התפלגות לפי importance:
SELECT 
  importance,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY importance
ORDER BY importance;

-- בדוק כמה מניות US יש:
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE code LIKE '%.US') as us_stocks,
  COUNT(*) FILTER (WHERE code NOT LIKE '%.US') as non_us_stocks
FROM earnings_calendar;

-- ============================================
-- הערות חשובות:
-- ============================================
-- 1. הפונקציה מחזירה מיד, אבל ה-Edge Function רץ ברקע
-- 2. המתן 5-10 דקות (תלוי בטווח התאריכים)
-- 3. הקוד שולף יום-יום כדי לקבל את כל הדיווחים
-- 4. זה יכול לקחת זמן לטווח גדול (שנה = 365 ימים!)






