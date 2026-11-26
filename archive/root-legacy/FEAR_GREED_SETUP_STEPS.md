# 🚀 מדריך הגדרה - מדד הפחד והתאווה

## שלב 1: יצירת הטבלה במסד הנתונים

1. פתח את **Supabase Dashboard**
2. לך ל **SQL Editor**
3. העתק את התוכן מ-`setup_fear_greed_index.sql`
4. הרץ את הקוד
5. ודא שהטבלה נוצרה: `SELECT * FROM fear_and_greed_index;`

## שלב 2: הגדרת API Key ב-Supabase

### דרך Dashboard:
1. לך ל **Settings** > **Edge Functions** > **Secrets**
2. לחץ על **Add new secret**
3. שם: `RAPIDAPI_KEY`
4. ערך: המפתח שלך מ-RapidAPI (או השתמש ב: `1728faf808msh542edbc5ac19c5dp1ac7a7jsna9780db906e3`)
5. שמור

### דרך CLI:
```bash
supabase secrets set RAPIDAPI_KEY=1728faf808msh542edbc5ac19c5dp1ac7a7jsna9780db906e3
```

## שלב 3: פריסת Edge Function

### דרך CLI (מומלץ):
```bash
# ודא שאתה בתיקיית הפרויקט
cd /Users/yoavwerdiger/DarkPoolApp_New-1

# התחבר ל-Supabase (אם עדיין לא)
supabase login

# קשר את הפרויקט (אם עדיין לא)
supabase link --project-ref wpmrtczbfcijoocguime

# פרוס את ה-Function
supabase functions deploy fear-greed-update
```

### דרך Dashboard:
1. לך ל **Edge Functions**
2. לחץ על **Deploy new function**
3. העתק את התוכן מ-`supabase/functions/fear-greed-update/index.ts`
4. שמור

## שלב 4: יצירת Cron Job

1. פתח את **Supabase Dashboard**
2. לך ל **SQL Editor**
3. העתק את התוכן מ-`setup_fear_greed_cron.sql`
4. הרץ את הקוד
5. ודא שה-Cron Job נוצר:
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'fear-greed-index-update';
```

## שלב 5: בדיקה

### בדיקת Edge Function ידנית:
```bash
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ' \
  -H 'Content-Type: application/json'
```

### בדיקת הטבלה:
```sql
SELECT * FROM fear_and_greed_index;
```

### בדיקת Cron Job:
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'fear-greed-index-update';
```

## ✅ מה קורה עכשיו?

- **Cron Job** ירוץ כל 15 דקות
- **Edge Function** יקרא ל-RapidAPI
- הנתונים יישמרו ב-`fear_and_greed_index`
- האפליקציה תקרא מהטבלה (או מה-API ישירות)

## 🔧 פתרון בעיות

### אם ה-Edge Function לא עובד:
1. בדוק שה-`RAPIDAPI_KEY` הוגדר ב-Secrets
2. בדוק את ה-Logs ב-Edge Functions
3. נסה לקרוא ידנית עם curl

### אם ה-Cron Job לא רץ:
1. ודא ש-`pg_cron` מופעל: `CREATE EXTENSION IF NOT EXISTS pg_cron;`
2. בדוק שה-Job פעיל: `SELECT * FROM cron.job WHERE jobname = 'fear-greed-index-update';`
3. בדוק את ה-Logs ב-Supabase

### אם אין נתונים בטבלה:
1. הרץ את ה-Edge Function ידנית (שלב 5)
2. בדוק שה-API Key תקין
3. בדוק את ה-Logs

## 📊 סטטיסטיקות

- **תדירות**: כל 15 דקות
- **קריאות/יום**: 96
- **קריאות/חודש**: 2,880
- **שימוש**: 0.58% מ-500,000
- **עלות**: $0

## 🎉 סיימת!

עכשיו המדד יתעדכן אוטומטית כל 15 דקות במסד הנתונים!


