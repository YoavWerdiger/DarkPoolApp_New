# 📊 מדריך הגדרת מערכת דיווחי תוצאות

## 🎯 סקירה כללית

המערכת כוללת **2 פונקציות בלבד**:

1. **earnings-daily-sync** - סנכרון יומי של דיווחים מתוכננים (30 יום קדימה)
2. **earnings-results-update** - עדכון תוצאות בפועל (פעמיים ביום)

---

## 🚀 שלב 1: פריסת Edge Functions

### 1.1 התחברות ל-Supabase

```bash
npx supabase login
```

### 1.2 פריסת הפונקציות

```bash
# פונקציה 1: סנכרון יומי
npx supabase functions deploy earnings-daily-sync

# פונקציה 2: עדכון תוצאות
npx supabase functions deploy earnings-results-update
```

---

## 🔑 שלב 2: הגדרת Environment Variables

עבור לוח הבקרה של Supabase:

**Settings → Edge Functions → Add new secret**

הוסף:
```
EODHD_API_KEY = <EODHD_API_KEY>
```

---

## ⏰ שלב 3: הגדרת Cron Jobs

### 3.1 הרצת קובץ ההגדרה

בתוך **Supabase SQL Editor**, הרץ את הקובץ:

```sql
-- העתק והדבק את התוכן של setup_earnings_cron.sql
```

### 3.2 זמני ריצה

| Job Name | זמן ריצה (ישראל) | זמן ריצה (UTC) | תיאור |
|----------|------------------|----------------|-------|
| `earnings-daily-sync` | 06:00 | 03:00 | סנכרון יומי - 30 יום קדימה |
| `earnings-results-morning` | 04:30 | 01:30 | עדכון תוצאות BeforeMarket |
| `earnings-results-evening` | 23:00 | 20:00 | עדכון תוצאות AfterMarket |

---

## ✅ שלב 4: בדיקה ראשונית

### 4.1 הרצה ידנית של הפונקציות

```bash
# בדיקת סנכרון יומי
curl -i --location --request POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-sync' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'

# בדיקת עדכון תוצאות
curl -i --location --request POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```

### 4.2 בדיקת Cron Jobs

```sql
-- הצגת כל ה-Jobs
SELECT * FROM cron.job WHERE jobname LIKE 'earnings%';

-- בדיקת היסטוריית ריצות
SELECT * FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname LIKE 'earnings%'
)
ORDER BY start_time DESC
LIMIT 10;
```

---

## 🔄 ניהול ותחזוקה

### הסרת Cron Jobs

```sql
SELECT cron.unschedule('earnings-daily-sync');
SELECT cron.unschedule('earnings-results-morning');
SELECT cron.unschedule('earnings-results-evening');
```

### הפעלה מחדש

פשוט הרץ שוב את `setup_earnings_cron.sql`

---

## 📊 מבנה המערכת

### earnings-daily-sync (פעם ביום)
```
🌅 06:00 Israel Time
├── משיכת נתונים מ-EODHD API
├── טווח: היום + 30 יום
├── ~70 מניות מהאינדקסים הגדולים
└── עדכון טבלת earnings_calendar
```

### earnings-results-update (פעמיים ביום)
```
🌄 04:30 Israel Time (אחרי BeforeMarket)
├── משיכת תוצאות בפועל
├── טווח: 3 ימים אחורה
├── עדכון רק שדות actual/difference/percent
└── ~70 מניות מהאינדקסים הגדולים

🌙 23:00 Israel Time (אחרי AfterMarket)
└── אותה לוגיקה
```

---

## 🎯 מה קורה בפועל?

### יום רגיל:

1. **06:00** - סנכרון יומי רץ
   - מוסיף/מעדכן כל הדיווחים ל-30 יום קדימה
   - משתמשים רואים דיווחים מתוכננים עם `estimate`

2. **04:30** - עדכון תוצאות בוקר
   - מעדכן תוצאות BeforeMarket שפורסמו
   - משתמשים רואים `actual` + `percent` + צבעים

3. **23:00** - עדכון תוצאות ערב
   - מעדכן תוצאות AfterMarket שפורסמו
   - משתמשים רואים עוד תוצאות מעודכנות

---

## 🐛 פתרון בעיות

### הפונקציה לא רצה?

```sql
-- בדוק לוגים
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'earnings-daily-sync'
)
ORDER BY start_time DESC LIMIT 1;
```

### אין נתונים?

1. בדוק ש-EODHD_API_KEY מוגדר
2. בדוק שהפונקציות פרוסות
3. הרץ ידנית את הפונקציה
4. בדוק לוגים ב-Supabase Dashboard

---

## 📱 תצוגה באפליקציה

המשתמשים יראו:

### לפני דיווח:
- 🔮 תחזית (estimate)
- ⏰ זמן מתוכנן (BeforeMarket/AfterMarket)

### אחרי דיווח:
- ✅ תוצאה בפועל (actual)
- 📊 אחוז הפתעה (percent)
- 🎨 צבעים: ירוק (חיובי) / אדום (שלילי)

---

## 🎉 סיימת!

המערכת מוכנה לפעולה. הדיווחים יתעדכנו אוטומטית 3 פעמים ביום! 🚀

