# ⏰ הגדרת Cron Job - צעד אחר צעד

## 🎯 מה זה Cron Job?

זה יגרום לפונקציה לרוץ **אוטומטית כל יום ב-06:00** (או בזמן שתבחר).

---

## 📋 שלב 1: לך ל-SQL Editor ב-Supabase

1. **פתח Supabase Dashboard**
2. **לך ל-SQL Editor** (בתפריט השמאלי)
3. **לחץ "+ New Query"**

---

## 📝 שלב 2: הרץ את הקוד הזה

**העתק והדבק את הקוד הבא:**

```sql
-- מחיקת Cron Jobs ישנים (אם יש)
SELECT cron.unschedule('daily-economic-sync');
SELECT cron.unschedule('daily-economic-sync-simple');

-- יצירת Cron Job חדש - כל יום ב-06:00 UTC
SELECT cron.schedule(
  'daily-economic-sync-simple',
  '0 6 * * *',  -- כל יום ב-06:00 UTC (= 09:00 שעון ישראל בחורף, 08:00 בקיץ)
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

**אם השתמשת ב-`sync-economic-calendar` במקום `daily-economic-sync-simple`, שנה את ה-URL:**

```sql
-- במקום daily-economic-sync-simple, השתמש ב-sync-economic-calendar
SELECT cron.schedule(
  'sync-economic-calendar',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/sync-economic-calendar',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

---

## ✅ שלב 3: הרץ את הקוד

1. **הדבק את הקוד ב-SQL Editor**
2. **לחץ "Run"** (או Ctrl+Enter / Cmd+Enter)
3. **אמור להופיע הודעה:** "Success. No rows returned" ✅

---

## 🔍 שלב 4: בדוק שה-Cron Job נוצר

**הרץ את הקוד הזה:**

```sql
-- בדיקה - רשימת כל ה-Cron Jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;
```

**אמור לראות:**
- ✅ `daily-economic-sync-simple` (או `sync-economic-calendar`)
- ✅ `schedule`: `0 6 * * *`
- ✅ `active`: `true`

---

## ⏰ מתי זה ירוץ?

**`'0 6 * * *'`** = כל יום ב-06:00 UTC

**זה אומר:**
- 🕘 **09:00** שעון ישראל בחורף (UTC+2)
- 🕘 **08:00** שעון ישראל בקיץ (UTC+3)

**אם אתה רוצה שעה אחרת:**

| שעה (ישראל) | Cron Expression | הסבר |
|-------------|----------------|------|
| 06:00 (בוקר) | `0 4 * * *` | 04:00 UTC = 06:00 ישראל בחורף |
| 07:00 (בוקר) | `0 5 * * *` | 05:00 UTC = 07:00 ישראל בחורף |
| 08:00 (בוקר) | `0 6 * * *` | 06:00 UTC = 08:00 ישראל בקיץ |
| 09:00 (בוקר) | `0 7 * * *` | 07:00 UTC = 09:00 ישראל בחורף |

---

## 🧪 איך לבדוק שזה עובד?

### 1. בדוק את הלוגים של ה-Cron

```sql
-- לוגים אחרונים של ה-Cron Job
SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname LIKE '%economic%'
)
ORDER BY start_time DESC
LIMIT 10;
```

### 2. בדוק שהאירועים מתעדכנים

- למחרת בבוקר, בדוק את הטבלה `economic_events`
- אמור להיות עוד אירועים מעודכנים

---

## 🔧 פתרון בעיות

### ה-Cron Job לא נוצר:
- ✅ בדוק ש-`pg_cron` extension מופעל:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  ```

### ה-Cron Job לא רץ:
- ✅ בדוק שה-`active` = `true`
- ✅ בדוק את הלוגים עם השאילתה למעלה
- ✅ בדוק שה-URL של הפונקציה נכון

### שגיאת הרשאות:
- ✅ ודא שה-`anon key` נכון
- ✅ בדוק שהפונקציה קיימת ב-Supabase

---

## 🎯 סיכום

**אחרי שתריץ את ה-SQL:**
1. ✅ ה-Cron Job יווצר
2. ✅ הפונקציה תרוץ אוטומטית כל יום ב-06:00 UTC
3. ✅ האירועים יתעדכנו אוטומטית

**זהו!** 🎉

---

## 📝 הערה חשובה

**אם אתה משתמש ב-`sync-economic-calendar`:**
- שנה את ה-URL ב-Cron Job ל-`sync-economic-calendar`
- או השתמש בקוד שמופיע למעלה עם התיקון


