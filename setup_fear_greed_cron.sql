-- ====================================
-- הגדרת Cron Job לעדכון מדד הפחד והתאווה
-- ====================================
-- הרץ קובץ זה ב-SQL Editor של Supabase
-- ⚠️ ודא שה-Edge Function כבר פרוס לפני הרצת זה
--
-- 📊 מידע חשוב:
-- - המדד מתעדכן פעם ביום ב-API המקורי (בדרך כלל בבוקר)
-- - RapidAPI: 500,000 קריאות/חודש בחבילה החינמית! 🎉
-- - CoinMarketCap: לא מספק Fear & Greed Index ישירות
-- - עלות: $0 (כלול בחבילה החינמית)
--
-- 🕐 אפשרויות תדירות (בחר אחת):
--   1. כל 5 דקות:  '*/5 * * * *'   → 288 קריאות/יום = 8,640/חודש (1.7% מהמגבלה!)
--   2. כל 10 דקות: '*/10 * * * *'  → 144 קריאות/יום = 4,320/חודש (0.86% מהמגבלה!)
--   3. כל 15 דקות: '*/15 * * * *'  → 96 קריאות/יום = 2,880/חודש (0.58% מהמגבלה!)
--   4. כל 30 דקות: '*/30 * * * *'  → 48 קריאות/יום = 1,440/חודש (0.29% מהמגבלה!)
--   5. כל שעה:     '0 * * * *'      → 24 קריאות/יום = 720/חודש (0.14% מהמגבלה!)
--   6. כל 3 שעות:  '0 */3 * * *'    → 8 קריאות/יום = 240/חודש (0.05% מהמגבלה!)
--
-- 💡 המלצה: כל 15 דקות - תכוף מספיק, ועדיין רק 0.58% מהמגבלה!
-- ⚠️ הערה: המדד מתעדכן פעם ביום, אז אין צורך לבדוק כל 5 דקות, אבל אם אתה רוצה - למה לא?

-- הפעלת Extension של pg_cron (אם עדיין לא מופעל)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- מחיקת Cron Job ישן (אם קיים)
-- אם זה הפעם הראשונה, דלג על השורה הזו
-- אם ה-job כבר קיים, הסר את ההערה מהשורה הבאה:
-- SELECT cron.unschedule('fear-greed-index-update');

-- יצירת Cron Job חדש - עדכון כל 15 דקות (מומלץ עם 500K/חודש!)
-- המדד מתעדכן פעם ביום, אבל נבדוק כל 15 דקות כדי להיות מעודכנים מיד
SELECT cron.schedule(
  'fear-greed-index-update',           -- שם ה-Job
  '*/15 * * * *',                        -- כל 15 דקות (00:00, 00:15, 00:30, 00:45, 01:00, ...)
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- בדיקת Cron Jobs פעילים
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'fear-greed-index-update';

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE 'Cron Job fear-greed-index-update נוצר בהצלחה!';
  RAISE NOTICE 'העדכון ירוץ כל 15 דקות (96 פעמים ביום)';
  RAISE NOTICE 'עלות: $0 (כלול ב-500,000 קריאות/חודש)';
  RAISE NOTICE 'שימוש: ~2,880 קריאות/חודש (רק 0.58%% מהמגבלה!)';
END $$;

