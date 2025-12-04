# 🔔 עדכונים בלייב עם Push Notifications

## 🎯 מה זה עושה?

מערכת שמעדכנת תוצאות כלכליות **בלייב** ושולחת **Push Notifications** למשתמשים כשמופיעות תוצאות חדשות.

---

## 📋 מה המערכת עושה:

1. **בודקת תוצאות כל 15-30 דקות**
2. **מעדכנת את הטבלה** עם תוצאות חדשות
3. **שולחת Push Notifications** רק על אירועים חשובים:
   - CPI
   - NFP
   - FOMC
   - PPI
   - GDP
   - Unemployment
   - כל אירוע עם `importance: 'high'`

---

## 🚀 הגדרה

### שלב 1: פרוס את הפונקציה המשודרגת

1. **לך ל-Supabase Dashboard** → **Edge Functions**
2. **בחר `update-economic-results`** (או צור חדש אם לא קיים)
3. **העתק את הקוד מ:** `supabase/functions/update-economic-results/index.ts`
4. **פרוס**

---

### שלב 2: צור Cron Job (כל 15-30 דקות)

**הרץ את הקוד הזה ב-SQL Editor:**

```sql
-- יצירת Cron Job לעדכון תוצאות בלייב
SELECT cron.schedule(
  'update-economic-results-live',
  '*/15 * * * *',  -- כל 15 דקות
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/update-economic-results',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

**אפשרויות תדירות:**

| תדירות | Cron Expression | הסבר |
|--------|----------------|------|
| כל 15 דקות | `*/15 * * * *` | ⚡ מהיר מאוד |
| כל 30 דקות | `*/30 * * * *` | ⚡ מהיר |
| כל שעה | `0 * * * *` | ⚖️ מאוזן |
| כל שעתיים | `0 */2 * * *` | 🐌 איטי |

**המלצה:** `*/15 * * * *` (כל 15 דקות) - זה נותן עדכונים מהירים בלי להעמיס על ה-API.

---

## 📱 איך Push Notifications עובדות?

### מה נשלח:

1. **כותרת:** "📊 תוצאה כלכלית חדשה"
2. **תוכן:** 
   - שם האירוע + התוצאה
   - השוואה לתחזית (אם יש)
   - למשל: "CPI - מדד מחירים לצרכן: 3.2% ✅ (תחזית: 3.0%, +6.7%)"

### למי נשלח:

- **כל המשתמשים** שיש להם device token פעיל
- **רק על אירועים חשובים** (high importance)
- **רק כשמופיעה תוצאה חדשה** (לא אם כבר היה actual value)

---

## 🔍 בדיקה

### 1. בדוק שהפונקציה רצה:

```sql
-- בדיקת Cron Jobs
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE '%economic%';
```

### 2. בדוק את הלוגים:

- לך ל-Edge Functions → `update-economic-results` → Logs
- צריך לראות:
  - `✅ Updated: [שם אירוע] - Actual: [תוצאה]`
  - `📱 Sent X push notifications`

### 3. בדוק תוצאות בטבלה:

```sql
-- בדוק אירועים עם תוצאות חדשות
SELECT title, date, time, actual, forecast, importance
FROM economic_events
WHERE actual IS NOT NULL AND actual != ''
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, time DESC
LIMIT 10;
```

---

## ⚙️ התאמה אישית

### לשלוח התראות רק על אירועים מסוימים:

ערוך את הקוד ב-`update-economic-results/index.ts`:

```typescript
// רשימת מילות מפתח לאירועים חשובים
const importantKeywords = [
  'cpi', 'nfp', 'fomc', 'ppi', 'gdp', 
  'unemployment', 'employment', 'retail sales'
]
```

### לשנות את תדירות הבדיקה:

ערוך את ה-Cron Job:
- כל 10 דקות: `*/10 * * * *`
- כל 5 דקות: `*/5 * * * *`

---

## 📊 סיכום

**מה קורה עכשיו:**

1. ⏰ **כל 15 דקות** - הפונקציה בודקת תוצאות חדשות
2. 🔄 **מעדכנת** את הטבלה עם actual values
3. 📱 **שולחת Push Notifications** על אירועים חשובים
4. ✅ **הכל אוטומטי!**

---

## 🎉 הכל מוכן!

המערכת תעדכן תוצאות **בלייב** ותשלח **Push Notifications** למשתמשים!

למחרת תוכל לבדוק בלוגים שהכל עובד. 🚀


