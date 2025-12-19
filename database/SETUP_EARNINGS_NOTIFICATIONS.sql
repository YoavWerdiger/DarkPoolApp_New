-- ============================================
-- התקנה מהירה של התראות Earnings
-- ============================================
-- 
-- אחרי שפרסת את 2 ה-Edge Functions, הרץ את הסקריפטים הבאים:
--
-- 1. הרץ את: create_earnings_notifications_trigger.sql
--    (יוצר database trigger להתראות על תוצאות)
--
-- 2. הרץ את: create_earnings_notifications_cron.sql
--    (יוצר cron job להתראות לפני דיווח)
--
-- ============================================
-- בדיקה מהירה - האם הכל עובד?
-- ============================================

-- בדיקת trigger
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'earnings_notification_trigger';

-- בדיקת cron job
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'earnings_notifications_upcoming';

-- בדיקת התראות שנוצרו לאחרונה
SELECT 
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_sent = false) as pending,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour
FROM pending_notifications
WHERE notification_type = 'earnings';

-- ============================================
-- סיכום
-- ============================================
-- 
-- ✅ אם אתה רואה trigger ו-cron job - הכל מוכן!
-- 
-- 💡 לבדיקה:
--    1. עדכן רשומה ב-earnings_calendar עם actual חדש
--    2. בדוק את pending_notifications
--    3. בדוק את הלוגים של earnings-results-notifications




