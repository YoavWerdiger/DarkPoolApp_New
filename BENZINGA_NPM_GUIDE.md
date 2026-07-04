# 🚀 פריסת Benzinga דרך NPM - מדריך מהיר

## ✅ יתרונות
- ✅ אין צורך להתקין Supabase CLI גלובלית
- ✅ פקודות קצרות ונוחות
- ✅ עובד מיד עם `npx`

---

## 📋 הוראות שלב אחר שלב

### שלב 1: התחברות ל-Supabase

```bash
npm run supabase:login
```

זה יפתח את הדפדפן לאימות. אשר את ההתחברות.

---

### שלב 2: חיבור לפרויקט

```bash
npm run supabase:link
```

בחר את הפרויקט שלך מהרשימה, או הזן את ה-Project Reference ID.

**💡 איפה למצוא את ה-Project Reference ID?**
- Dashboard → Settings → General → Reference ID

---

### שלב 3: יצירת טבלאות במסד נתונים

**אפשרות מומלצת:** דרך Supabase Dashboard

1. עבור ל: https://supabase.com/dashboard
2. בחר את הפרויקט שלך
3. לחץ על **SQL Editor**
4. לחץ על **New Query**
5. העתק והדבק את `database/benzinga_economic_events_table.sql`
6. לחץ **Run** (או `Cmd+Enter`)

---

### שלב 4: הגדרת API Key

```bash
npm run supabase:secrets:set
```

זה יגדיר אוטומטית את `BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`

---

### שלב 5: פריסת כל ה-Edge Functions

```bash
npm run benzinga:setup
```

או פריסה ידנית:

```bash
# פרוס הכל ביחד
npm run supabase:deploy:all

# או אחד אחד:
npm run supabase:deploy:earnings
npm run supabase:deploy:economics
npm run supabase:deploy:scheduler
```

---

### שלב 6: בדיקת סטטוס

```bash
npm run supabase:status
```

זה יראה לך:
- API URL
- API Keys
- DB Host
- Studio URL

---

### שלב 7: הגדרת Cron Jobs

עבור ל-Dashboard וצור שני Cron Jobs:

#### Job #1: Earnings (פעמיים ביום - 6:00 ו-18:00)

```sql
SELECT cron.schedule(
  'daily-earnings-sync',
  '0 6,18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

#### Job #2: Economic Calendar (כל 6 שעות)

```sql
SELECT cron.schedule(
  'benzinga-economics-sync',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**💡 איפה למצוא:**
- `[YOUR_PROJECT_REF]` - Dashboard → Settings → General → Reference ID
- `[YOUR_ANON_KEY]` - Dashboard → Settings → API → anon public key

---

### שלב 8: בדיקה וצפייה בלוגים

```bash
# צפה בלוגים של Economics (live)
npm run supabase:logs:economics

# צפה בלוגים של Earnings (live)
npm run supabase:logs:earnings

# צפה בלוגים של Scheduler (live)
npm run supabase:logs:scheduler
```

---

## 🎯 פקודות שימושיות נוספות

### בדיקת חיבור
```bash
npm run supabase:status
```

### הפעלה ידנית של Function (דרך curl)
```bash
# קבל את ה-URLs מ:
npm run supabase:status

# Economics
curl -X POST \
  'https://[PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync' \
  -H 'Authorization: Bearer [ANON_KEY]'

# Earnings
curl -X POST \
  'https://[PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple' \
  -H 'Authorization: Bearer [ANON_KEY]'
```

---

## 📝 רשימת כל הפקודות

| פקודה | תיאור |
|-------|--------|
| `npm run supabase:login` | התחברות ל-Supabase |
| `npm run supabase:link` | חיבור לפרויקט |
| `npm run supabase:status` | צפייה בסטטוס |
| `npm run supabase:secrets:set` | הגדרת API Key |
| `npm run supabase:deploy:earnings` | פריסת Earnings Function |
| `npm run supabase:deploy:economics` | פריסת Economics Function |
| `npm run supabase:deploy:scheduler` | פריסת Scheduler Function |
| `npm run supabase:deploy:all` | פריסת כל ה-Functions |
| `npm run benzinga:setup` | הגדרה מלאה (API Key + Deploy) |
| `npm run supabase:logs:earnings` | לוגים של Earnings |
| `npm run supabase:logs:economics` | לוגים של Economics |
| `npm run supabase:logs:scheduler` | לוגים של Scheduler |

---

## ✅ Checklist

- [ ] `npm run supabase:login` - התחברות
- [ ] `npm run supabase:link` - חיבור לפרויקט
- [ ] יצירת טבלאות דרך SQL Editor
- [ ] `npm run benzinga:setup` - פריסה מלאה
- [ ] הגדרת Cron Jobs ב-Dashboard
- [ ] `npm run supabase:logs:economics` - בדיקת לוגים
- [ ] בדיקת נתונים במסד נתונים

---

## 🚀 Quick Start (מהיר!)

```bash
# 1. התחבר
npm run supabase:login

# 2. התחבר לפרויקט
npm run supabase:link

# 3. צור טבלאות (דרך Dashboard SQL Editor)
# העתק: database/benzinga_economic_events_table.sql

# 4. הגדר והפרוס הכל
npm run benzinga:setup

# 5. בדוק לוגים
npm run supabase:logs:economics

# 6. הגדר Cron Jobs (דרך Dashboard)
```

---

## 🆘 פתרון בעיות

### "command not found: npx"
**פתרון:** וודא ש-Node.js מותקן:
```bash
node --version
npm --version
```

### "Not logged in"
**פתרון:**
```bash
npm run supabase:login
```

### "Project not linked"
**פתרון:**
```bash
npm run supabase:link
```

### "Error deploying function"
**פתרון:** בדוק שהקבצים קיימים:
```bash
ls -la supabase/functions/
```

---

## 📊 בדיקת הצלחה

לאחר הפריסה, בדוק:

### 1. Functions נפרסו
```bash
npm run supabase:status
```

### 2. יש נתונים במסד
עבור ל-Dashboard → SQL Editor:
```sql
SELECT COUNT(*) FROM economic_events_cache WHERE source = 'Benzinga';
SELECT COUNT(*) FROM earnings_calendar;
```

### 3. Functions עובדים
```bash
npm run supabase:logs:economics
```

---

**הצלחה! 🎉**

כל הקוד מוכן - רק צריך להריץ את הפקודות!









