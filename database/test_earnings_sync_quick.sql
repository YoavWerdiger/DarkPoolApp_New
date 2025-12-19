-- ============================================
-- בדיקה מהירה - שליפה של 7 ימים קדימה בלבד
-- ============================================
-- זה יעזור לבדוק אם הפונקציה עובדת

-- 1. בדיקה מהירה - 7 ימים קדימה:
SELECT * FROM trigger_earnings_sync(
  CURRENT_DATE,                              -- היום
  (CURRENT_DATE + INTERVAL '7 days')::DATE  -- 7 ימים קדימה
);

-- 2. המתן 2-3 דקות ואז בדוק:
-- SELECT COUNT(*) FROM earnings_calendar;

-- 3. אם עדיין 0, בדוק את הלוגים ב-Supabase Dashboard:
-- https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions/daily-earnings-sync-simple/logs





