# 🚀 התחלה מהירה - 5 דקות!

## פשוט העתק והדבק את הפקודות האלה בטרמינל:

### 1️⃣ התחברות (יפתח דפדפן)
```bash
cd /Users/yoavwerdiger/DarkPoolApp_New-1
npm run supabase:login
```

### 2️⃣ חיבור לפרויקט
```bash
npm run supabase:link
```

בחר את הפרויקט שלך מהרשימה.

### 3️⃣ יצירת טבלאות

**אפשרות א': דרך Dashboard (מומלץ)**
1. פתח: https://supabase.com/dashboard
2. בחר את הפרויקט שלך
3. SQL Editor → New Query
4. העתק והדבק את התוכן של: `database/benzinga_economic_events_table.sql`
5. לחץ Run

**אפשרות ב': דרך קובץ**
```bash
# בדוק את ה-DB URL
npm run supabase:status

# הרץ את הסקריפט (צריך את הסיסמה)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f database/benzinga_economic_events_table.sql
```

### 4️⃣ פריסה מלאה!
```bash
npm run benzinga:setup
```

זה יעשה:
- ✅ הגדרת API Key
- ✅ פריסת כל ה-3 Functions

### 5️⃣ בדיקה
```bash
# צפה בלוגים
npm run supabase:logs:economics
```

---

## 🎯 זהו! עכשיו רק צריך להגדיר Cron Jobs

1. עבור ל: https://supabase.com/dashboard
2. בחר את הפרויקט שלך
3. Database → Cron Jobs → Create a new cron job

### Job #1: Earnings
**Schedule:** `0 6,18 * * *`
```sql
SELECT net.http_post(
  url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple',
  headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb
);
```

### Job #2: Economics  
**Schedule:** `0 */6 * * *`
```sql
SELECT net.http_post(
  url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync',
  headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb
);
```

**איפה למצוא את הערכים:**
```bash
npm run supabase:status
```

זה יראה לך את:
- API URL (יש בו את PROJECT_REF)
- anon key (זה ANON_KEY)

---

## ✅ בדיקה סופית

```sql
-- עבור ל-SQL Editor והרץ:
SELECT COUNT(*) FROM economic_events_cache;
SELECT COUNT(*) FROM earnings_calendar;
```

---

**זהו! המערכת מוכנה! 🎉**
